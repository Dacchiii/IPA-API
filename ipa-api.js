// ipa-api.js
(() => {
  const IPA = {};
  let ctx, source, node;

  // ==== AudioWorklet を1ファイルに押し込む ====
  const workletCode = `
  class IPAProcessor extends AudioWorkletProcessor {
    process(inputs) {
      const input = inputs[0];
      if (input && input[0]) {
        this.port.postMessage(input[0].slice());
      }
      return true;
    }
  }
  registerProcessor("ipa-processor", IPAProcessor);
  `;

  async function setupAudio() {
    ctx = new AudioContext();

    const blob = new Blob([workletCode], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    await ctx.audioWorklet.addModule(url);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    source = ctx.createMediaStreamSource(stream);

    node = new AudioWorkletNode(ctx, "ipa-processor");
    source.connect(node);

    node.port.onmessage = e => {
      const float32 = e.data;
      handleAudio(float32, ctx.sampleRate);
    };
  }

  // ==== 超簡易 音声→IPA（仮） ====
  function handleAudio(float32, sampleRate) {
    // エネルギー（無音カット）
    let energy = 0;
    for (let i = 0; i < float32.length; i++) {
      energy += Math.abs(float32[i]);
    }
    energy /= float32.length;
    if (energy < 0.01) return;

    // 超雑な分類（後でFSM化）
    let ipa = "a";
    if (energy < 0.05) ipa = "h";
    else if (energy < 0.1) ipa = "ə";
    else if (energy < 0.2) ipa = "a";

    IPA._buffer.push({ base: ipa });
  }

  // ==== 出力 ====
  IPA._buffer = [];

  IPA.render = () => {
    return "[" + IPA._buffer.map(s => s.base).join("") + "]";
  };

  IPA.clear = () => {
    IPA._buffer.length = 0;
  };

  IPA.start = async () => {
    if (!ctx) await setupAudio();
    await ctx.resume();
  };

  window.IPA = IPA;
})();

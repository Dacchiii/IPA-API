(() => {
  const IPA = {};

  let audioCtx = null;
  let processor = null;
  let source = null;

  let ipaBuffer = "";
  let lastIPA = "";

  const FRAME_SIZE = 2048;
  const SILENCE = 0.01;

  /* ====== public API ====== */

  IPA.start = async function () {
    if (audioCtx) return;

    audioCtx = new AudioContext();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    source = audioCtx.createMediaStreamSource(stream);

    processor = audioCtx.createScriptProcessor(FRAME_SIZE, 1, 1);
    source.connect(processor);
    processor.connect(audioCtx.destination);

    processor.onaudioprocess = e => {
      const frame = e.inputBuffer.getChannelData(0);
      processFrame(frame, audioCtx.sampleRate);
    };
  };

  IPA.render = function () {
    return `[${ipaBuffer}]`;
  };

  IPA.clear = function () {
    ipaBuffer = "";
    lastIPA = "";
  };

  /* ====== signal processing ====== */

  function rms(buf) {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  function zeroCrossingRate(buf, sampleRate) {
    let c = 0;
    for (let i = 1; i < buf.length; i++) {
      if (buf[i - 1] <= 0 && buf[i] > 0) c++;
    }
    return c * sampleRate / buf.length;
  }

  function roughNoise(buf) {
    let d = 0;
    for (let i = 1; i < buf.length; i++) {
      d += Math.abs(buf[i] - buf[i - 1]);
    }
    return d / buf.length;
  }

  /* ====== IPA classification ====== */

  function classify(frame, sampleRate) {
    const v = rms(frame);
    if (v < SILENCE) return "";

    const zcr = zeroCrossingRate(frame, sampleRate);
    const noise = roughNoise(frame);

    // 摩擦音
    if (noise > 0.12) {
      if (zcr > 3000) return "s";
      return "h";
    }

    // 鼻音（かなり荒い）
    if (zcr < 800) return "ŋ";

    // 母音（仮）
    if (zcr > 2200) return "i";
    if (zcr > 1800) return "e";
    if (zcr > 1400) return "a";
    if (zcr > 1100) return "o";
    return "ɯ";
  }

  /* ====== frame handler ====== */

  function processFrame(frame, sampleRate) {
    const ipa = classify(frame, sampleRate);
    if (!ipa || ipa === lastIPA) return;

    ipaBuffer += ipa;
    lastIPA = ipa;
  }

  /* expose */
  window.IPA = IPA;
})();

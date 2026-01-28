(() => {
  const IPA = {};

  let audioCtx, source, processor;

  let buffer = "";
  let state = "silence";

  const FRAME = 2048;
  const SILENCE_TH = 0.01;

  /* ===== public ===== */

  IPA.start = async () => {
    if (audioCtx) return;

    audioCtx = new AudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    source = audioCtx.createMediaStreamSource(stream);

    processor = audioCtx.createScriptProcessor(FRAME, 1, 1);
    source.connect(processor);
    processor.connect(audioCtx.destination);

    processor.onaudioprocess = e => {
      const frame = e.inputBuffer.getChannelData(0);
      const feat = extractFeatures(frame, audioCtx.sampleRate);
      stepFSM(feat);
    };
  };

  IPA.render = () => `[${buffer}]`;
  IPA.clear = () => { buffer = ""; state = "silence"; };

  /* ===== feature extraction ===== */

  function extractFeatures(buf, sr) {
    let sum = 0, zc = 0, diff = 0;

    for (let i = 0; i < buf.length; i++) {
      sum += buf[i] * buf[i];
      if (i > 0) {
        if (buf[i - 1] <= 0 && buf[i] > 0) zc++;
        diff += Math.abs(buf[i] - buf[i - 1]);
      }
    }

    return {
      volume: Math.sqrt(sum / buf.length),
      zcr: zc * sr / buf.length,
      noise: diff / buf.length
    };
  }

  /* ===== FSM ===== */

  function stepFSM(f) {
    switch (state) {
      case "silence":
        if (f.volume > SILENCE_TH) {
          if (f.noise > 0.12) {
            state = "fricative";
            buffer += pickFricative(f);
          } else {
            state = "vowel";
            buffer += pickVowel(f);
          }
        }
        break;

      case "vowel":
        if (f.volume < SILENCE_TH) {
          state = "silence";
        }
        break;

      case "fricative":
        if (f.volume < SILENCE_TH) {
          state = "silence";
        }
        break;
    }
  }

  /* ===== IPA selection (まだ荒くてOK) ===== */

  function pickVowel(f) {
    if (f.zcr > 2200) return "i";
    if (f.zcr > 1800) return "e";
    if (f.zcr > 1400) return "a";
    if (f.zcr > 1100) return "o";
    return "ɯ";
  }

  function pickFricative(f) {
    if (f.zcr > 3000) return "s";
    return "h";
  }

  window.IPA = IPA;
})();

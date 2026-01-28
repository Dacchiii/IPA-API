// ipa-api.js v0.2
// 1-file IPA API using ScriptProcessorNode (GitHub Pages / HTTPS safe)
// Focus: energy + zero-crossing + simple spectrum bands

(() => {
  const IPA = {};
  let ctx, source, processor;

  IPA._segments = [];

  // ==== Utility ==== 
  function rms(buf) {
    let s = 0;
    for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    return Math.sqrt(s / buf.length);
  }

  function zeroCrossingRate(buf) {
    let c = 0;
    for (let i = 1; i < buf.length; i++) {
      if (buf[i - 1] * buf[i] < 0) c++;
    }
    return c / buf.length;
  }

  function spectrumBands(buf) {
    // very rough DFT (slow but simple, v0.2)
    const N = buf.length;
    const bands = { low: 0, mid: 0, high: 0 };

    for (let k = 1; k < N / 2; k++) {
      let re = 0, im = 0;
      for (let n = 0; n < N; n++) {
        const a = 2 * Math.PI * k * n / N;
        re += buf[n] * Math.cos(a);
        im -= buf[n] * Math.sin(a);
      }
      const mag = Math.sqrt(re * re + im * im);

      if (k < N * 0.05) bands.low += mag;
      else if (k < N * 0.15) bands.mid += mag;
      else bands.high += mag;
    }
    return bands;
  }

  // ==== Core classification ==== 
  function classify(buf) {
    const e = rms(buf);
    if (e < 0.01) return null; // silence

    const zcr = zeroCrossingRate(buf);
    const bands = spectrumBands(buf);

    // vowel vs consonant (very rough)
    const isVowel = zcr < 0.15;

    if (isVowel) {
      // vowel space (rough)
      if (bands.high > bands.mid && bands.high > bands.low) return { base: 'i' };
      if (bands.low > bands.mid && bands.low > bands.high) return { base: 'u' };
      if (bands.mid > bands.high && bands.mid > bands.low) return { base: 'a' };
      return { base: 'ə' };
    } else {
      // consonant (placeholder)
      return { base: 'h' };
    }
  }

  // ==== Audio callback ==== 
  function onAudio(buf) {
    const seg = classify(buf);
    if (seg) IPA._segments.push(seg);
  }

  // ==== Public API ==== 
  IPA.start = async () => {
    ctx = new AudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    source = ctx.createMediaStreamSource(stream);

    processor = ctx.createScriptProcessor(1024, 1, 1);
    source.connect(processor);
    processor.connect(ctx.destination);

    processor.onaudioprocess = e => {
      const buf = e.inputBuffer.getChannelData(0);
      onAudio(buf);
    };
  };

  IPA.render = () => {
    return '[' + IPA._segments.map(s => s.base).join('') + ']';
  };

  IPA.clear = () => {
    IPA._segments.length = 0;
  };

  window.IPA = IPA;
})();

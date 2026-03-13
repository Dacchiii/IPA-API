(() => {
  const IPA = {};

  let audioCtx, source, processor;
  let buffer = "";
  let state = "silence";
  const FRAME = 2048;
  const SILENCE_TH = 0.01;

  /* ===== public API ===== */
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
      sum += buf[i]*buf[i];
      if (i>0) { if(buf[i-1]<=0&&buf[i]>0) zc++; diff+=Math.abs(buf[i]-buf[i-1]); }
    }
    return { volume: Math.sqrt(sum/buf.length), zcr: zc*sr/buf.length, noise: diff/buf.length };
  }

  /* ===== FSM ===== */
  function stepFSM(f) {
    switch(state){
      case "silence":
        if(f.volume>SILENCE_TH){
          if(f.noise>0.12){ state="fricative"; buffer+=pickConsonant(f); }
          else{ state="vowel"; buffer+=pickVowel(f); }
        }
        break;

      case "vowel":
        buffer+=pickDiacritic(f, buffer.slice(-1)); // 補助記号
        if(f.volume<SILENCE_TH) state="silence";
        break;

      case "fricative":
        if(f.volume<SILENCE_TH) state="silence";
        break;
    }
  }

  /* ===== IPA selection ===== */
  function pickVowel(f){
    const z=f.zcr;
    if(z>2500) return "i";
    if(z>2200) return "e";
    if(z>1800) return "a";
    if(z>1500) return "o";
    if(z>1200) return "ɯ";
    if(z>1000) return "y";
    if(z>800) return "ø";
    if(z>600) return "ɛ";
    if(z>400) return "œ";
    if(z>300) return "ɜ";
    if(z>200) return "ɞ";
    if(z>150) return "ɔ";
    return "ɑ";
  }

  function pickConsonant(f){
    const z=f.zcr;
    if(z>3500) return "s";
    if(z>3000) return "ʃ";
    if(z>2500) return "h";
    if(z>2000) return "p";
    if(z>1800) return "t";
    if(z>1600) return "k";
    if(z>1400) return "m";
    if(z>1200) return "n";
    if(z>1000) return "ŋ";
    return "r";
  }

  function pickDiacritic(f, last){
    let out = "";
    // 長音っぽい場合
    if(f.volume>0.2) out+="ː";
    // 鼻音化っぽい場合
    if(last==="a"||last==="o"||last==="e") out+="̃";
    // 母音無声化っぽい
    if(f.zcr>4000) out+="̥";
    return out;
  }

  window.IPA = IPA;
})();

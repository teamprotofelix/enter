/* Fat arcade combat audio — Web Audio only, no files. */
const SFX = (() => {
  let ctx, master, sfxG, musG, comp, muted = false, musicOn = false, ttsOff = false;
  let started = false;
  let musicTimer = 0;
  let step = 0;

  const bass = [82.41, 82.41, 98, 82.41, 110, 110, 73.42, 65.41];

  function boot() {
    if (started) {
      if (ctx.state === "suspended") ctx.resume();
      return;
    }
    started = true;
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = function () { koVoice = null; koVoicePick(); };
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.92;
    master.connect(ctx.destination);

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 6;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.003;
    comp.release.value = 0.14;

    sfxG = ctx.createGain();
    sfxG.gain.value = 0.88;
    sfxG.connect(comp);
    comp.connect(master);

    musG = ctx.createGain();
    musG.gain.value = 0.2;
    musG.connect(master);
  }

  function env(node, a, s, t, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + s);
    node.connect(g);
    g.connect(sfxG);
    return g;
  }

  function tone(type, freq, dur, peak, t, slide) {
    if (!started || muted) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    env(o, 0.004, dur, t, peak);
    o.start(t);
    o.stop(t + dur + 0.04);
  }

  function noise(dur, peak, t, freq, type) {
    if (!started || muted) return;
    const n = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = type || "lowpass";
    f.frequency.value = freq || 900;
    src.connect(f);
    env(f, 0.003, dur, t, peak);
    src.start(t);
    src.stop(t + dur + 0.04);
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function punchSwing() {
    const t = now();
    noise(0.09, 0.22, t, 2200, "highpass");
    tone("sine", 520, 0.08, 0.12, t, 140);
  }

  function kickSwing() {
    const t = now();
    noise(0.12, 0.28, t, 1100, "highpass");
    tone("sine", 180, 0.12, 0.16, t, 70);
    tone("triangle", 90, 0.1, 0.14, t, 40);
  }

  function punchHit(combo) {
    const t = now();
    const c = Math.min(combo || 1, 10);
    noise(0.11, 0.48, t, 1600, "highpass");
    noise(0.16, 0.42, t, 380);
    tone("sine", 52 + c * 5, 0.22, 0.62, t, 28);
    tone("triangle", 110 + c * 8, 0.12, 0.28, t, 50);
    tone("square", 190 + c * 18, 0.045, 0.22, t);
    if (c >= 3) tone("square", 740 + c * 20, 0.04, 0.14, t + 0.018);
    if (c >= 6) {
      noise(0.08, 0.28, t + 0.03, 2400, "highpass");
      tone("sine", 70, 0.18, 0.3, t + 0.02, 30);
    }
  }

  function kickHit(combo) {
    const t = now();
    const c = Math.min(combo || 1, 10);
    noise(0.16, 0.55, t, 500);
    noise(0.1, 0.38, t, 2000, "highpass");
    tone("sine", 42 + c * 3, 0.28, 0.72, t, 22);
    tone("sawtooth", 95, 0.12, 0.26, t, 36);
    tone("square", 160 + c * 12, 0.06, 0.2, t);
    if (c >= 3) tone("triangle", 420, 0.05, 0.16, t + 0.02);
  }

  function superHit() {
    const t = now();
    noise(0.32, 0.62, t, 320);
    noise(0.14, 0.4, t, 2200, "highpass");
    tone("sine", 38, 0.42, 0.8, t, 18);
    tone("sawtooth", 90, 0.24, 0.32, t, 32);
    tone("square", 220, 0.08, 0.2, t);
    tone("square", 440, 0.1, 0.16, t + 0.05);
    tone("triangle", 660, 0.12, 0.14, t + 0.1);
  }

  function shot() {
    const t = now();
    noise(0.06, 0.22, t, 2600, "highpass");
    tone("square", 880, 0.05, 0.14, t, 220);
    tone("sine", 240, 0.07, 0.12, t, 80);
  }

  function dash() {
    const t = now();
    noise(0.16, 0.32, t, 900, "highpass");
    tone("sawtooth", 160, 0.14, 0.18, t, 420);
  }

  function whoosh() {
    noise(0.12, 0.22, now(), 1600, "highpass");
  }

  function jump() {
    tone("square", 280, 0.1, 0.1, now(), 480);
  }

  function land() {
    const t = now();
    noise(0.08, 0.2, t, 400);
    tone("sine", 70, 0.1, 0.18, t, 36);
  }

  function hurt() {
    const t = now();
    tone("sawtooth", 150, 0.22, 0.28, t, 48);
    noise(0.16, 0.3, t, 500);
  }

  function ko() {
    const t = now();
    noise(0.55, 0.7, t, 240);
    tone("sine", 48, 0.6, 0.78, t, 16);
    tone("sawtooth", 110, 0.42, 0.28, t, 28);
    tone("square", 180, 0.2, 0.18, t + 0.08, 60);
    tone("triangle", 90, 0.35, 0.22, t + 0.16, 30);
  }

  function burst() {
    const t = now();
    noise(0.28, 0.4, t, 700);
    tone("square", 392, 0.1, 0.22, t);
    tone("square", 523, 0.12, 0.24, t + 0.07);
    tone("square", 784, 0.16, 0.26, t + 0.14);
    tone("sine", 60, 0.3, 0.35, t, 28);
  }

  function ui() {
    tone("square", 720, 0.05, 0.14, now());
    tone("sine", 480, 0.06, 0.08, now());
  }

  function hover() {
    tone("square", 980, 0.035, 0.08, now());
  }

  function pick() {
    const t = now();
    tone("square", 620, 0.05, 0.14, t);
    tone("square", 880, 0.08, 0.16, t + 0.05);
  }

  function win() {
    const t = now();
    tone("square", 523, 0.1, 0.2, t);
    tone("square", 659, 0.1, 0.2, t + 0.09);
    tone("square", 784, 0.12, 0.22, t + 0.18);
    tone("square", 1046, 0.22, 0.26, t + 0.3);
    tone("sine", 80, 0.3, 0.2, t, 40);
  }

  function medal() {
    const t = now();
    tone("square", 523, 0.1, 0.2, t);
    tone("square", 659, 0.1, 0.2, t + 0.09);
    tone("square", 784, 0.1, 0.2, t + 0.18);
    tone("square", 1046, 0.14, 0.24, t + 0.28);
    tone("square", 1318, 0.28, 0.28, t + 0.4);
  }

  function special() {
    const t = now();
    tone("sawtooth", 90, 0.22, 0.28, t, 520);
    noise(0.2, 0.32, t, 800);
    tone("square", 330, 0.1, 0.16, t + 0.08);
  }

  const VOX = {
    "다낚아": { hz: 220, f1: 760, f2: 1280, pitch: 1.12, rate: 1.12 },
    "오른손": { hz: 175, f1: 620, f2: 1100, pitch: 0.88, rate: 1.08 },
    "박엄살": { hz: 310, f1: 900, f2: 1600, pitch: 1.35, rate: 0.98 },
    "앞으로빵빵": { hz: 150, f1: 540, f2: 980, pitch: 0.78, rate: 1.18 },
    "남사기관": { hz: 185, f1: 680, f2: 1180, pitch: 0.92, rate: 1.05 },
    "앙큼기사": { hz: 275, f1: 860, f2: 1500, pitch: 1.28, rate: 1.15 },
    "빠뜨렀슈": { hz: 135, f1: 480, f2: 900, pitch: 0.7, rate: 0.92 },
    "깨발랄지나아C": { hz: 390, f1: 980, f2: 1750, pitch: 1.55, rate: 1.28 },
    "우정신프로": { hz: 305, f1: 920, f2: 1580, pitch: 1.38, rate: 1.1 },
    "빌런": { hz: 125, f1: 430, f2: 820, pitch: 0.62, rate: 0.9 },
    "골프보다구찌": { hz: 195, f1: 700, f2: 1220, pitch: 0.95, rate: 1.2 },
    "버디요정": { hz: 350, f1: 940, f2: 1680, pitch: 1.48, rate: 1.08 },
    "기라성": { hz: 230, f1: 780, f2: 1320, pitch: 1.08, rate: 1.22 },
    "김탁구": { hz: 145, f1: 520, f2: 960, pitch: 0.74, rate: 1.14 },
    "커피 친구": { hz: 205, f1: 720, f2: 1240, pitch: 1.0, rate: 1.06 },
  };

  const talkCd = {};
  let koVoice = null;

  function voxOf(name) {
    return VOX[name] || { hz: 200, f1: 720, f2: 1200, pitch: 1, rate: 1.1 };
  }

  function koVoicePick() {
    if (koVoice) return koVoice;
    if (!window.speechSynthesis) return null;
    const list = window.speechSynthesis.getVoices() || [];
    koVoice = list.find((v) => v.lang && v.lang.toLowerCase().indexOf("ko") === 0) || null;
    return koVoice;
  }

  function grunt(name, kind) {
    if (!started || muted) return;
    const v = voxOf(name);
    const t = now();
    const hurt = kind === "hurt" || kind === "ko";
    const atk = kind === "atk" || kind === "hit";
    const f0 = v.hz * (hurt ? 0.9 : atk ? 1.12 : 1);
    const dur = hurt ? 0.22 : kind === "ko" ? 0.38 : 0.13;
    const peak = hurt ? 0.62 : 0.48;

    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(45, hurt ? f0 * 0.52 : f0 * 1.28), t + dur * 0.85);

    const bp1 = ctx.createBiquadFilter();
    bp1.type = "bandpass";
    bp1.frequency.value = v.f1;
    bp1.Q.value = 5.5;
    const bp2 = ctx.createBiquadFilter();
    bp2.type = "bandpass";
    bp2.frequency.value = v.f2;
    bp2.Q.value = 4.2;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    o.connect(bp1);
    bp1.connect(g);
    o.connect(bp2);
    bp2.connect(g);
    g.connect(sfxG);
    o.start(t);
    o.stop(t + dur + 0.04);

    noise(hurt ? 0.16 : 0.07, hurt ? 0.22 : 0.1, t, v.f2, "bandpass");
    if (hurt) tone("triangle", f0 * 0.5, 0.14, 0.18, t, f0 * 0.28);
  }

  function cancelTalk() {
    try {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    } catch (err) { /* ignore */ }
  }

  function talk(name, text, kind, force) {
    if (muted || ttsOff || !text) return;
    const wait = kind === "ko" || kind === "win" || kind === "pick" ? 80 : 850;
    const n = performance.now();
    const key = name + ":" + (kind || "x");
    if (!force && talkCd[key] && talkCd[key] > n) return;
    talkCd[key] = n + wait;

    const syn = window.speechSynthesis;
    if (!syn) return;
    try {
      syn.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = voxOf(name);
      u.lang = "ko-KR";
      u.pitch = Math.max(0.1, Math.min(2, v.pitch));
      u.rate = Math.max(0.7, Math.min(1.4, v.rate * (kind === "hurt" ? 1.08 : 1)));
      u.volume = 0.95;
      const voice = koVoicePick();
      if (voice) u.voice = voice;
      syn.speak(u);
    } catch (err) { /* no TTS */ }
  }

  function tick() {
    if (!started || muted || !musicOn) return;
    const t = now();
    if (t < musicTimer) return;
    const beat = 0.2;
    musicTimer = t + beat;
    const i = step % bass.length;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = bass[i];
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g);
    g.connect(musG);
    o.start(t);
    o.stop(t + 0.18);
    if (step % 2 === 0) {
      noise(0.055, 0.14, t, 160);
      tone("sine", 52, 0.07, 0.16, t, 32);
    }
    if (step % 4 === 2) noise(0.04, 0.1, t, 2800, "highpass");
    step++;
  }

  return {
    boot,
    punchSwing,
    kickSwing,
    punchHit,
    kickHit,
    superHit,
    shot,
    dash,
    whoosh,
    jump,
    land,
    hurt,
    ko,
    burst,
    ui,
    hover,
    pick,
    win,
    medal,
    special,
    grunt,
    talk,
    cancelTalk,
    tick,
    setMuted(v) {
      muted = !!v;
      if (muted) cancelTalk();
    },
    isMuted() { return muted; },
    setTts(on) {
      ttsOff = !on;
      if (ttsOff) cancelTalk();
    },
    isTts() { return !ttsOff; },
    setMusic(v) { musicOn = !!v; if (musicOn) { boot(); musicTimer = 0; } },
    isMusic() { return musicOn; },
    started() { return started; },
  };
})();

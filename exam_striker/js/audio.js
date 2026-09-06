/* Procedural arcade audio — Web Audio, no files. */
const SFX = (() => {
  let ctx, master, sfxG, musG, muted = false, musicOn = false;
  let musicTimer = 0;
  let step = 0;
  let started = false;

  const bass = [110, 110, 82.4, 110, 130.81, 130.81, 98, 87.31];
  const arp = [440, 523.25, 659.25, 783.99, 659.25, 523.25, 392, 329.63];

  function boot() {
    if (started) {
      if (ctx.state === "suspended") ctx.resume();
      return;
    }
    started = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.72;
    master.connect(ctx.destination);
    sfxG = ctx.createGain();
    sfxG.gain.value = 0.42;
    sfxG.connect(master);
    musG = ctx.createGain();
    musG.gain.value = 0.16;
    musG.connect(master);
  }

  function env(node, a, s, t, peak) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
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
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    env(o, 0.008, dur, t, peak);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, peak, t, hp) {
    if (!started || muted) return;
    const n = 2 * ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = hp ? "highpass" : "lowpass";
    f.frequency.value = hp || 900;
    src.connect(f);
    env(f, 0.004, dur, t, peak);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function shoot(power) {
    const t = now();
    tone("square", 880 + power * 70 + Math.random() * 40, 0.045, 0.07, t, 420);
  }

  function hit() {
    const t = now();
    tone("square", 240, 0.05, 0.08, t, 90);
    noise(0.05, 0.08, t, 1200);
  }

  function explode(big) {
    const t = now();
    noise(big ? 0.32 : 0.14, big ? 0.28 : 0.16, t, 700);
    tone("sawtooth", big ? 140 : 220, big ? 0.28 : 0.12, 0.14, t, 40);
  }

  function pickup() {
    const t = now();
    tone("square", 523, 0.07, 0.1, t);
    tone("square", 659, 0.08, 0.1, t + 0.06);
    tone("square", 784, 0.12, 0.12, t + 0.12);
  }

  function bomb() {
    const t = now();
    noise(0.4, 0.32, t, 400);
    tone("sine", 180, 0.45, 0.2, t, 40);
    tone("sawtooth", 90, 0.5, 0.12, t, 30);
  }

  function graze() {
    tone("square", 1900 + Math.random() * 200, 0.025, 0.035, now());
  }

  function hurt() {
    const t = now();
    tone("sawtooth", 160, 0.25, 0.18, t, 50);
    noise(0.2, 0.2, t, 500);
  }

  function die() {
    const t = now();
    noise(0.5, 0.3, t, 350);
    tone("sawtooth", 200, 0.55, 0.2, t, 40);
  }

  function warning() {
    const t = now();
    tone("square", 440, 0.18, 0.12, t);
    tone("square", 330, 0.18, 0.12, t + 0.2);
    tone("square", 440, 0.18, 0.12, t + 0.4);
    tone("square", 330, 0.22, 0.12, t + 0.6);
  }

  function ui() {
    tone("square", 660, 0.06, 0.08, now());
  }

  function quizOk() {
    const t = now();
    tone("square", 523, 0.08, 0.14, t);
    tone("square", 659, 0.09, 0.14, t + 0.07);
    tone("square", 784, 0.1, 0.16, t + 0.14);
    tone("square", 1046, 0.2, 0.18, t + 0.24);
  }

  function quizBad() {
    const t = now();
    tone("sawtooth", 240, 0.18, 0.16, t, 90);
    tone("square", 180, 0.22, 0.14, t + 0.06, 70);
    noise(0.18, 0.14, t, 500);
  }

  function shield() {
    tone("sine", 300, 0.12, 0.1, now(), 120);
  }

  function transform() {
    const t = now();
    tone("square", 392, 0.07, 0.1, t);
    tone("square", 523, 0.08, 0.11, t + 0.06);
    tone("square", 784, 0.14, 0.14, t + 0.12, 1175);
  }

  function phoenix() {
    const t = now();
    tone("sawtooth", 180, 0.4, 0.16, t, 520);
    noise(0.28, 0.18, t, 900);
  }

  function tickMusic(dt) {
    if (!started || muted || !musicOn) return;
    const stepDur = 60 / 138 / 4;
    musicTimer += dt;
    while (musicTimer >= stepDur) {
      musicTimer -= stepDur;
      const t = now();
      const i = step & 7;
      const b = bass[i];
      if (b) {
        const o = ctx.createOscillator();
        o.type = "triangle";
        o.frequency.value = b;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g);
        g.connect(musG);
        o.start(t);
        o.stop(t + 0.2);
      }
      if ((step & 1) === 0) {
        const o = ctx.createOscillator();
        o.type = "square";
        o.frequency.value = arp[(step >> 1) & 7];
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.07, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
        o.connect(g);
        g.connect(musG);
        o.start(t);
        o.stop(t + 0.12);
      }
      if ((step & 3) === 0) noise(0.04, 0.04, t, 4000);
      step++;
    }
  }

  return {
    boot,
    shoot,
    hit,
    explode,
    pickup,
    bomb,
    graze,
    hurt,
    die,
    warning,
    ui,
    quizOk,
    quizBad,
    shield,
    transform,
    phoenix,
    tickMusic,
    startMusic() { musicOn = true; },
    stopMusic() { musicOn = false; },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.72;
      return muted;
    },
    get muted() { return muted; },
    get ready() { return started; },
  };
})();

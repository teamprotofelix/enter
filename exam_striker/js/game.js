(() => {
  "use strict";

  const W = 480;
  const H = 720;
  const STEP = 1 / 120;
  const HI_KEY = "voidstriker_hi";
  const COL_KEY = "voidstriker_bosscol";

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");
  const $ = (id) => document.getElementById(id);

  const sprites = {};
  const keys = new Set();
  const mouse = { x: W / 2, y: H * 0.78, on: false, down: false, moved: 0 };

  let viewScale = 1;
  let drawScale = 1;
  let mode = "title";
  let acc = 0;
  let last = 0;
  let timeScale = 1;
  let slowRec = 0;
  let freeze = 0;
  let shake = 0;
  let flash = 0;
  let flashCol = [255, 255, 255];
  let scroll = 0;
  let clock = 0;
  let rank = 0;
  let score = 0;
  const MEDAL_KEY = "voidstriker_medals";
  let high = Number(storageGet(HI_KEY, "0") || 0);
  let chain = 0;
  let chainT = 0;
  let bombCd = 0;
  let fireCd = 0;
  let toastT = 0;
  let schedule = [];
  let stageClearT = 0;
  let wantBomb = 0;
  let stars = [];
  let shock = [];
  let floats = [];
  let ready = false;
  let gates = [];
  let chainGateUsed = { 10: false, 25: false, 50: false };
  let bossQueue = [];
  let field = { type: null, t: 0, scoreMul: 1, emp: false, surge: false, spawn: 0 };
  let stageBossName = "";
  let storyT = 0;
  let halfLine = false;
  let storyQueue = [];
  let quiz = { on: false, phase: "off", t: 0, cd: 7, used: [], answer: true, q: "" };
  let quizBannerT = 0;

  const BOSS_NAMES = [
    "다낚아", "오른손", "박엄살", "앞으로빵빵", "남사기관", "앙큼기사",
    "빠뜨렀슈", "깨발랄지나아C", "우정신프로", "빌런", "골프보다구찌", "버디요정",
    "기라성", "김탁구",
  ];

  const FORM_ORDER = ["striker", "lancer", "raider", "core", "phantom", "berserk"];
  const FORM_INFO = {
    striker: { name: "STRIKER", ko: "스트라이커", speed: 720, focus: 240, hitR: 4.2, scale: 1, hue: 0 },
    lancer: { name: "LANCER", ko: "랜서", speed: 540, focus: 200, hitR: 4.2, scale: 1.1, hue: 210 },
    raider: { name: "RAIDER", ko: "레이더", speed: 880, focus: 310, hitR: 3.5, scale: 0.88, hue: 100 },
    core: { name: "CORE OVER", ko: "코어 오버", speed: 600, focus: 210, hitR: 6.8, scale: 1.1, hue: 0 },
    phantom: { name: "PHANTOM", ko: "팬텀", speed: 750, focus: 250, hitR: 4.2, scale: 1, hue: 270 },
    berserk: { name: "BERSERK", ko: "버서크", speed: 860, focus: 860, hitR: 5.4, scale: 1.28, hue: -25, timed: 10 },
  };

  const player = {
    x: W / 2,
    y: H * 0.78,
    vx: 0,
    hitR: 4.2,
    grazeR: 16,
    lives: 3,
    bombs: 3,
    power: 0,
    shield: false,
    inv: 0,
    dead: false,
    deadT: 0,
    tilt: 0,
    focus: false,
    form: "striker",
    formT: 0,
    phoenixT: 0,
    phoenixUsed: false,
    trail: [],
    daze: 0,
  };

  class Pool {
    constructor(factory, n) {
      this.factory = factory;
      this.cap = n;
      this.free = [];
      this.live = [];
      for (let i = 0; i < n; i++) this.free.push(factory());
    }
    get() {
      let o = this.free.pop();
      if (o) {
        o.alive = true;
        this.live.push(o);
        return o;
      }
      if (this.live.length < this.cap) {
        o = this.factory();
        o.alive = true;
        this.live.push(o);
        return o;
      }
      o = this.live.shift();
      o.alive = true;
      this.live.push(o);
      return o;
    }
    sweep() {
      const live = this.live;
      let w = 0;
      for (let i = 0; i < live.length; i++) {
        const o = live[i];
        if (o.alive) live[w++] = o;
        else this.free.push(o);
      }
      live.length = w;
    }
  }

  const pBullets = new Pool(() => ({
    alive: false, x: 0, y: 0, vx: 0, vy: 0, r: 3.2, dmg: 1, pierce: 0, home: false, w: 4.4, h: 22, hue: "#4df0ff",
  }), 280);
  const eBullets = new Pool(() => ({
    alive: false, x: 0, y: 0, vx: 0, vy: 0, r: 5, color: "#ff5a7a", rice: false, grazed: false,
    g: 0, effect: "", wob: 0, bounce: 0,
  }), 700);
  const enemies = new Pool(() => ({
    alive: false, kind: "wasp", x: 0, y: 0, hp: 1, maxHp: 1, r: 16, w: 40, h: 40,
    score: 100, age: 0, fire: 0, every: 1, move: "dive", speed: 160, bx: 0, data: 0,
    flash: 0, drop: "none", phase: 0, ang: 0, spin: 0, tx: 0, ty: 0, left: 0,
    bounty: false, ramCd: 0, bossName: "", drawScale: 1, assassin: false, snapState: 0,
  }), 96);
  const pickups = new Pool(() => ({ alive: false, x: 0, y: 0, vy: 40, kind: "gem", t: 0 }), 40);
  const parts = new Pool(() => ({
    alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0.4, r: 2, color: "#fff", drag: 1.4,
  }), 900);

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pad(n, w) { return String(Math.max(0, n | 0)).padStart(w, "0"); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function angTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
  function off(x, y, m) {
    m = m == null ? 50 : m;
    return x < -m || y < -m || x > W + m || y > H + m;
  }

  function loadImg(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function loadSprite(name) {
    return loadImg("assets/sprites/" + name + ".png").catch(() => {
      if (typeof SPRITES !== "undefined" && SPRITES[name]) return loadImg(SPRITES[name]);
      throw new Error("missing sprite " + name);
    });
  }

  function storageGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : v;
    } catch (err) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (err) { /* private mode */ }
  }

  function resize() {
    const app = (document.getElementById("playwrap") || document.getElementById("app")).getBoundingClientRect();
    const scale = Math.min(app.width / W, app.height / H);
    viewScale = scale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = Math.round(W * scale);
    const cssH = Math.round(H * scale);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    drawScale = scale * dpr;
    ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0);
    stage.style.width = cssW + "px";
    stage.style.height = cssH + "px";
  }

  function pointerToGame(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
    };
  }

  function emit(x, y, n, o) {
    o = o || {};
    n = Math.min(n, 40);
    for (let i = 0; i < n; i++) {
      const p = parts.get();
      if (!p) break;
      const a = o.a != null ? o.a + (Math.random() - 0.5) * (o.spread || 0.8) : Math.random() * Math.PI * 2;
      const s = rand(o.smin || 30, o.smax || 160);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s + (o.vx || 0);
      p.vy = Math.sin(a) * s + (o.vy || 0);
      p.life = o.life || 0.4;
      p.max = p.life;
      p.r = o.r || rand(1.4, 3.2);
      p.color = o.color || "#4df0ff";
      p.drag = o.drag || 1.6;
    }
  }

  function floatText(x, y, text, color, extra) {
    if (floats.length > 36) floats.shift();
    extra = extra || {};
    const life = extra.life || 0.7;
    floats.push({ x, y, text, color: color || "#fff", life: life, max: life, big: !!extra.big });
  }

  function toast(msg, dur, kind) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.remove("ok", "bad");
    if (kind) el.classList.add(kind);
    el.classList.add("show");
    toastT = dur == null ? 1.35 : dur;
  }

  function addScore(base, x, y, show) {
    const n = Math.floor(base * (1 + chain * 0.12) * (field.scoreMul || 1));
    score += n;
    if (score > high) {
      high = score;
      storageSet(HI_KEY, String(high));
    }
    $("score").textContent = pad(score, 7);
    $("hi").textContent = pad(high, 7);
    if (show !== false) floatText(x, y - 8, String(n), "#ffd45a");
  }

  function bumpChain(x, y) {
    chain++;
    chainT = 2.2;
    if (chain === 10 || chain === 25 || chain === 50 || chain === 100) {
      floatText(x, y + 14, "CHAIN " + chain, "#ff3d9a");
    }
    if ((chain === 10 || chain === 25 || chain === 50) && !chainGateUsed[chain]) {
      chainGateUsed[chain] = true;
      spawnGate();
    }
  }

  function pShot(x, y, vx, vy, dmg, extra) {
    extra = extra || {};
    const b = pBullets.get();
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.r = extra.r || 3.4;
    b.dmg = dmg || 1;
    b.pierce = extra.pierce || 0;
    b.home = !!extra.home;
    b.w = extra.w || 4.4;
    b.h = extra.h || 22;
    b.hue = extra.hue || "#4df0ff";
    b.lastHit = null;
  }

  function eShot(x, y, vx, vy, r, color, rice, extra) {
    extra = extra || {};
    const b = eBullets.get();
    b.x = x;
    b.y = y;
    b.vx = vx;
    b.vy = vy;
    b.r = r || 5;
    b.color = color || "#ff5a7a";
    b.rice = !!rice;
    b.grazed = false;
    b.g = extra.g || 0;
    b.effect = extra.effect || "";
    b.wob = extra.wob || 0;
    b.bounce = extra.bounce || 0;
  }

  function themeOf() {
    return (typeof BOSS_THEMES !== "undefined" && BOSS_THEMES[stageBossName]) || null;
  }

  function setStoryPortrait(name) {
    const art = $("storyArt");
    if (!art) return;
    const th = (typeof BOSS_THEMES !== "undefined" && BOSS_THEMES[name]) || themeOf();
    const img = th && th.art && sprites[th.art];
    art.style.backgroundImage = img ? "url('" + img.src + "')" : "none";
  }

  function showStory(who, text, sys) {
    const line = $("storyLine");
    const whoEl = $("storyWho");
    if (!line || !text) return;
    if (whoEl) whoEl.textContent = sys ? "SYSTEM" : (who || "");
    line.textContent = text;
    line.classList.remove("pop");
    void line.offsetWidth;
    line.classList.add("pop");
    if (!sys && who) setStoryPortrait(who);
  }

  function pushStory(who, text, sys) {
    if (!text) return;
    storyQueue.push({ who: who || "", text: text, sys: !!sys });
  }

  function pumpStory() {
    if (!storyQueue.length) return false;
    const msg = storyQueue.shift();
    showStory(msg.who, msg.text, msg.sys);
    return true;
  }

  function loadCol() {
    try {
      const c = JSON.parse(storageGet(COL_KEY, "{}") || "{}");
      if (c["구찌"] && !c["골프보다구찌"]) {
        c["골프보다구찌"] = true;
        delete c["구찌"];
        storageSet(COL_KEY, JSON.stringify(c));
      }
      return c;
    } catch (err) { return {}; }
  }

  function saveCol(c) {
    storageSet(COL_KEY, JSON.stringify(c));
  }

  function loadMedals() {
    const n = Number(storageGet(MEDAL_KEY, "0") || 0);
    return n > 0 ? n : 0;
  }

  function medalTiers(n) {
    let bronze = n;
    let silver = 0;
    let gold = 0;
    let plat = 0;
    while (bronze >= 5) { bronze -= 5; silver++; }
    while (silver >= 5) { silver -= 5; gold++; }
    while (gold >= 5) { gold -= 5; plat++; }
    return { plat: plat, gold: gold, silver: silver, bronze: bronze };
  }

  function renderMedals() {
    const box = $("medals");
    if (!box) return;
    const t = medalTiers(loadMedals());
    box.innerHTML = "";
    function add(kind, count) {
      for (let i = 0; i < count; i++) {
        const m = document.createElement("i");
        m.className = "medal " + kind;
        box.appendChild(m);
      }
    }
    add("plat", t.plat);
    add("gold", t.gold);
    add("silver", t.silver);
    add("bronze", t.bronze);
    box.style.display = loadMedals() > 0 ? "flex" : "none";
  }

  function renderCollection() {
    const list = $("colList");
    const count = $("colCount");
    if (!list) return;
    const col = loadCol();
    let n = 0;
    list.innerHTML = "";
    BOSS_NAMES.forEach((name) => {
      const th = (typeof BOSS_THEMES !== "undefined" && BOSS_THEMES[name]) || {};
      const li = document.createElement("li");
      if (col[name]) { li.className = "got"; n++; }
      if (name === stageBossName) li.classList.add("current");
      const i = document.createElement("i");
      const b = document.createElement("b");
      b.textContent = name;
      li.appendChild(i);
      li.appendChild(b);
      list.appendChild(li);
    });
    if (count) count.textContent = n + " / " + BOSS_NAMES.length;
    renderMedals();
  }

  function collectBoss(name) {
    if (!name) return;
    const col = loadCol();
    const first = !col[name];
    if (!first) {
      renderCollection();
      return;
    }
    col[name] = true;
    const got = BOSS_NAMES.filter((k) => col[k]).length;
    if (got >= BOSS_NAMES.length) {
      storageSet(MEDAL_KEY, String(loadMedals() + 1));
      saveCol({});
      renderCollection();
      toast("훈장 획득", 2);
      showStory("SYSTEM", BOSS_NAMES.length + "/" + BOSS_NAMES.length + " 완성. 훈장을 받았다. 컬렉션이 다시 열린다.", true);
    } else {
      saveCol(col);
      renderCollection();
      toast("COLLECTED", 1.4);
    }
  }

  function aimed(x, y, speed) {
    const a = angTo(x, y, player.x, player.y);
    return { vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, a };
  }

  function ring(x, y, n, speed, rot, r, color) {
    for (let i = 0; i < n; i++) {
      const a = rot + (i * Math.PI * 2) / n;
      eShot(x, y, Math.cos(a) * speed, Math.sin(a) * speed, r, color);
    }
  }

  function nway(x, y, base, n, spread, speed, r, color, rice) {
    const start = base - (spread * (n - 1)) / 2;
    for (let i = 0; i < n; i++) {
      const a = start + i * spread;
      eShot(x, y, Math.cos(a) * speed, Math.sin(a) * speed, r, color, rice);
    }
  }

  function spawnPickup(x, y, kind) {
    const p = pickups.get();
    p.x = x;
    p.y = y;
    p.vy = 55;
    p.kind = kind;
    p.t = 0;
  }

  function spawnEnemy(kind, x, y, extra) {
    extra = extra || {};
    const e = enemies.get();
    const def = DEFS[kind];
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.bx = x;
    e.hp = (extra.hp || def.hp) * (1 + rank * 0.18);
    e.maxHp = e.hp;
    e.r = def.r;
    e.w = def.w;
    e.h = def.h;
    e.score = def.score;
    e.age = 0;
    e.fire = extra.fire != null ? extra.fire : def.every * 0.4;
    e.every = (extra.every || def.every) / (1 + rank * 0.1);
    e.move = extra.move || def.move;
    e.speed = (extra.speed || def.speed) * (1 + rank * 0.06);
    e.data = extra.data || 0;
    e.flash = 0;
    e.drop = extra.drop || def.drop;
    e.phase = 0;
    e.ang = extra.ang || 0;
    e.spin = extra.spin || def.spin || 0;
    e.tx = extra.tx || x;
    e.ty = extra.ty || 150;
    e.left = extra.left || 8;
    e.bounty = !!extra.bounty;
    e.ramCd = 0;
    e.bossName = extra.bossName || "";
    e.drawScale = 1;
    e.assassin = false;
    e.snapState = 0;
    e.correct = !!extra.correct;
    e.letter = extra.letter || "";
    if (extra.score) e.score = extra.score;
    if (extra.w) e.w = extra.w;
    if (extra.h) e.h = extra.h;
    if (extra.r) e.r = extra.r;
    return e;
  }

  const DEFS = {
    wasp: { hp: 3, r: 16, w: 44, h: 46, score: 150, every: 1.35, move: "dive", speed: 175, drop: "gem12" },
    crab: { hp: 12, r: 26, w: 72, h: 60, score: 420, every: 1.05, move: "sine", speed: 78, drop: "gem30" },
    tank: { hp: 36, r: 30, w: 70, h: 84, score: 900, every: 1.15, move: "slow", speed: 52, drop: "gem70" },
    spinner: { hp: 20, r: 24, w: 58, h: 58, score: 640, every: 0.11, move: "hover", speed: 70, drop: "gem25", spin: 2.4 },
    boss: { hp: 560, r: 52, w: 210, h: 114, score: 20000, every: 0.9, move: "boss", speed: 40, drop: "bomb" },
    asteroid: { hp: 7, r: 20, w: 40, h: 40, score: 70, every: 99, move: "fall", speed: 150, drop: "none" },
    transport: { hp: 90, r: 38, w: 128, h: 58, score: 2800, every: 1.7, move: "cross", speed: 68, drop: "cargo" },
    quiz: { hp: 3, r: 28, w: 64, h: 64, score: 900, every: 0.85, move: "quiz", speed: 0, drop: "none" },
  };

  function maybeDrop(e) {
    const d = e.drop;
    if (d === "bomb") {
      spawnPickup(e.x, e.y, "bomb");
      spawnPickup(e.x - 24, e.y + 10, "gem");
      spawnPickup(e.x + 24, e.y + 10, "gem");
      return;
    }
    if (d === "form") {
      spawnPickup(e.x, e.y, "form");
      return;
    }
    if (d === "cargo") {
      spawnPickup(e.x, e.y, "form");
      spawnPickup(e.x - 28, e.y + 8, "gem");
      spawnPickup(e.x + 28, e.y + 8, "bomb");
      spawnPickup(e.x - 14, e.y + 22, "shield");
      spawnPickup(e.x + 14, e.y + 22, "gem");
      return;
    }
    if (d === "gem70" || (d && d.startsWith("gem") && Math.random() < Number(d.slice(3)) / 100)) {
      spawnPickup(e.x, e.y, Math.random() < 0.12 ? "shield" : "gem");
    } else if (Math.random() < 0.05) {
      spawnPickup(e.x, e.y, "form");
    } else if (Math.random() < 0.04) {
      spawnPickup(e.x, e.y, "bomb");
    }
  }

  function killEnemy(e, fromBomb) {
    e.alive = false;
    const big = e.kind === "boss" || e.kind === "tank" || e.kind === "transport";
    emit(e.x, e.y, big ? 46 : 22, {
      color: e.kind === "wasp" ? "#ff8a4a" : e.kind === "crab" ? "#ff4db8" : "#ffd45a",
      smax: big ? 340 : 220,
      life: big ? 0.55 : 0.38,
    });
    if (shock.length > 24) shock.shift();
    shock.push({ x: e.x, y: e.y, r: 8, vr: big ? 380 : 260, life: 0.28 });
    SFX.explode(big);
    if (!fromBomb) {
      bumpChain(e.x, e.y);
      addScore(e.score, e.x, e.y);
      freeze = Math.max(freeze, e.kind === "boss" ? 0.09 : 0.028);
      shake = Math.max(shake, big ? 10 : 4);
    } else {
      addScore(e.score * 0.4, e.x, e.y, false);
    }
    maybeDrop(e);
    if (e.kind === "quiz") return;
    if (e.kind === "boss") {
      const th = themeOf();
      collectBoss(e.bossName || stageBossName);
      if (th) { storyQueue = []; showStory(e.bossName || stageBossName, th.defeat, false); }
      toast("STAGE CLEAR", 1.8);
      flash = 0.55;
      stageClearT = 2.4;
    }
  }

  function hurtEnemy(e, dmg, fromBomb) {
    if (e.kind === "quiz") return;
    e.hp -= dmg;
    e.flash = 0.06;
    if (e.hp <= 0) killEnemy(e, fromBomb);
    else if (!fromBomb) SFX.hit();
  }

  function formShot(px, py, ox, oy, ang, dmg, spd, extra) {
    const a = -Math.PI / 2 + ang;
    pShot(px + ox, py + oy, Math.cos(a) * spd, Math.sin(a) * spd, dmg, extra);
  }

  function fireSpread(px, py, pw, spd, focus, extra) {
    extra = extra || {};
    const shot = (ox, oy, ang, dmg) => formShot(px, py, ox, oy, ang * focus, dmg || 1, spd, extra);
    if (pw <= 0) shot(0, -18, 0, extra.dmg || 1);
    else if (pw === 1) { shot(-10, -14, 0); shot(10, -14, 0); }
    else if (pw === 2) { shot(-14, -12, 0); shot(0, -20, 0, 1.2); shot(14, -12, 0); }
    else if (pw === 3) {
      shot(-16, -10, -0.1); shot(-6, -18, -0.03);
      shot(6, -18, 0.03); shot(16, -10, 0.1);
    } else {
      shot(-18, -8, -0.16); shot(-9, -16, -0.06);
      shot(0, -22, 0, 1.25); shot(9, -16, 0.06); shot(18, -8, 0.16);
      if (pw >= 5) { shot(-30, 8, -0.46); shot(30, 8, 0.46); }
    }
  }

  function firePlayer() {
    if (player.dead) return;
    const p = player;
    const form = p.form || "striker";
    const pw = form === "berserk" ? 5 : p.power;
    const focus = p.focus && form !== "berserk" ? 0.45 : 1;
    if (form === "lancer") {
      const extra = { pierce: 12, r: 5, w: 7, h: 40, hue: "#c9a6ff" };
      formShot(p.x, p.y, 0, -22, 0, 2.4, 1100, extra);
      if (pw >= 3) {
        formShot(p.x, p.y, -10, -16, -0.04, 1.6, 1100, extra);
        formShot(p.x, p.y, 10, -16, 0.04, 1.6, 1100, extra);
      }
    } else if (form === "raider") {
      const n = 1 + Math.min(pw, 3);
      const extra = { home: true, r: 2.6, w: 3, h: 10, hue: "#7dff9a" };
      for (let i = 0; i < n; i++) {
        const ang = (i - (n - 1) / 2) * 0.14 * focus;
        formShot(p.x, p.y, (i - (n - 1) / 2) * 8, -14, ang, 0.7, 640, extra);
      }
    } else if (form === "core") {
      fireSpread(p.x, p.y, Math.max(pw, 3), 820, 0.28, { hue: "#fff6c8", r: 4, dmg: 1.45 });
      formShot(p.x, p.y, -6, -8, 0, 1.2, 780, { hue: "#fff" });
      formShot(p.x, p.y, 6, -8, 0, 1.2, 780, { hue: "#fff" });
    } else if (form === "phantom") {
      fireSpread(p.x, p.y, pw, 900, focus, { hue: "#d8b0ff" });
      const t6 = p.trail[6];
      const t12 = p.trail[12];
      if (t6) formShot(t6.x, t6.y, 0, -12, 0, 0.55, 880, { hue: "#b48cff", r: 2.8 });
      if (t12) formShot(t12.x, t12.y, 0, -12, 0, 0.55, 880, { hue: "#b48cff", r: 2.8 });
    } else if (form === "berserk") {
      fireSpread(p.x, p.y, 5, 980, 1, { hue: "#ff6b4a", r: 4, dmg: 1.35 });
    } else {
      fireSpread(p.x, p.y, pw, 940, focus, {});
    }
    SFX.shoot(pw);
    emit(p.x, p.y - 16, 2, { color: "#8af7ff", smin: 20, smax: 70, a: -Math.PI / 2, spread: 0.4, life: 0.12, r: 1.6 });
  }

  function setForm(id) {
    const f = FORM_INFO[id] || FORM_INFO.striker;
    player.form = id;
    player.hitR = f.hitR;
    player.grazeR = f.hitR + 12;
    player.formT = f.timed || 0;
    toast(f.ko, 1.15);
    floatText(player.x, player.y - 18, f.name, "#ffd45a");
    emit(player.x, player.y, 22, { color: "#ffd45a", smax: 240, life: 0.4 });
    if (SFX.transform) SFX.transform();
    const el = $("formName");
    if (el) el.textContent = f.name;
    syncHud();
  }

  function cycleForm() {
    const i = FORM_ORDER.indexOf(player.form);
    setForm(FORM_ORDER[(i + 1) % FORM_ORDER.length]);
  }

  function startPhoenix() {
    player.phoenixUsed = true;
    player.phoenixT = 10;
    player.inv = 10;
    player.lives = Math.max(1, player.lives);
    toast("PHOENIX", 1.6);
    flash = 0.6;
    shake = 12;
    if (SFX.phoenix) SFX.phoenix();
    emit(player.x, player.y, 50, { color: "#ffb347", smax: 360, life: 0.65 });
  }

  function spawnGate() {
    if (gates.some((g) => !g.taken && g.life > 0)) return;
    gates.push({ x: W / 2, y: 150, w: 110, h: 64, life: 7.5, taken: false });
    toast("CHAIN GATE", 1.3);
    SFX.warning();
  }

  function shuffleBosses() {
    bossQueue = BOSS_NAMES.slice();
    for (let i = bossQueue.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = bossQueue[i];
      bossQueue[i] = bossQueue[j];
      bossQueue[j] = tmp;
    }
  }

  function nextBossName() {
    if (!bossQueue.length) shuffleBosses();
    return bossQueue.pop();
  }

  function startFieldEvent(type, dur) {
    field.type = type;
    field.t = dur;
    field.spawn = 0.1;
    field.emp = type === "emp";
    field.surge = type === "surge";
    field.scoreMul = type === "surge" ? 2 : 1;
    const tag = $("eventTag");
    if (type === "asteroid") {
      toast("ASTEROID STORM", 1.8);
      if (tag) { tag.textContent = "ASTEROID STORM"; tag.classList.add("on"); }
    } else if (type === "emp") {
      toast("EMP BLACKOUT", 1.8);
      if (tag) { tag.textContent = "EMP BLACKOUT"; tag.classList.add("on"); }
    } else if (type === "surge") {
      toast("CORE SURGE", 1.8);
      if (tag) { tag.textContent = "CORE SURGE  x2"; tag.classList.add("on"); }
    }
    SFX.warning();
    flash = 0.35;
    const th = themeOf();
    if (th) pushStory(stageBossName, pick(th.taunts));
  }

  function endFieldEvent() {
    field.type = null;
    field.t = 0;
    field.emp = false;
    field.surge = false;
    field.scoreMul = 1;
    const tag = $("eventTag");
    if (tag) { tag.textContent = ""; tag.classList.remove("on"); }
  }

  function spawnBounty(x, y) {
    const e = spawnEnemy("wasp", x, y, {
      hp: 20,
      speed: 90,
      move: "hover",
      ty: 150,
      left: 9,
      drop: "form",
      score: 3200,
      bounty: true,
    });
    toast("BOUNTY", 1.2);
    return e;
  }

  function hideQuizBanner() {
    const el = $("quizBanner");
    if (el) el.classList.remove("on", "ok", "bad", "timeout");
    quizBannerT = 0;
  }

  function showQuizBanner(text, count) {
    const el = $("quizBanner");
    if (!el) return;
    el.classList.remove("ok", "bad", "timeout");
    el.innerHTML = "<div class='k'>심사기준 OX</div><div class='q'></div><div class='verdict'></div><div class='count'></div>";
    el.querySelector(".q").textContent = text;
    const c = el.querySelector(".count");
    if (count != null && count > 0) c.textContent = String(count);
    else c.textContent = quiz.phase === "live" ? "정답 글자를 먹어라" : "";
    el.classList.add("on");
  }

  function quizAnswerLetter() {
    return quiz.answer ? "O" : "X";
  }

  function wrapQuizLine(text, maxChars) {
    const src = String(text || "");
    if (src.length <= maxChars) return [src];
    const lines = [];
    let s = src;
    while (s.length > maxChars && lines.length < 3) {
      let cut = maxChars;
      const sp = s.lastIndexOf(" ", maxChars);
      if (sp > 10) cut = sp;
      lines.push(s.slice(0, cut).trim());
      s = s.slice(cut).trim();
    }
    if (s) lines.push(s);
    return lines;
  }

  function showQuizVerdict(ok, eaten, timeout) {
    const ate = eaten || "-";
    quiz.phase = "result";
    quiz.t = 2.6;
    quiz.on = true;
    quiz.resultOk = !timeout && !!ok;
    quiz.eaten = timeout ? "" : ate;
    quiz.timeout = !!timeout;
    hideQuizBanner();
    timeScale = Math.min(timeScale, 0.28);
    slowRec = Math.max(slowRec, 0.55);
    if (ok && !timeout) {
      flash = 0.72;
      flashCol = [77, 240, 255];
      if (SFX.quizOk) SFX.quizOk();
      else SFX.pickup();
    } else {
      flash = 0.78;
      flashCol = [255, 61, 154];
      if (SFX.quizBad) SFX.quizBad();
      else SFX.hurt();
    }
  }

  function drawQuizVerdict() {
    if (quiz.phase !== "result") return;
    const ok = !!quiz.resultOk;
    const timeout = !!quiz.timeout;
    const ans = quizAnswerLetter();
    const fade = Math.min(1, quiz.t / 0.35);
    const qLines = wrapQuizLine(quiz.q, 22);
    const boxH = 118 + qLines.length * 18;
    const top = H * 0.40;
    ctx.save();
    ctx.globalAlpha = 0.62 * fade;
    ctx.fillStyle = timeout || !ok ? "rgba(40, 4, 18, 0.82)" : "rgba(4, 28, 40, 0.82)";
    ctx.fillRect(28, top, W - 56, boxH);
    ctx.strokeStyle = timeout || !ok ? "rgba(255,61,154,0.85)" : "rgba(77,240,255,0.85)";
    ctx.lineWidth = 3;
    ctx.strokeRect(28, top, W - 56, boxH);
    ctx.globalAlpha = fade;
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.font = '700 13px "Malgun Gothic", "Segoe UI", sans-serif';
    ctx.fillStyle = "#d7e8ff";
    for (let i = 0; i < qLines.length; i++) {
      ctx.fillText(qLines[i], W / 2, top + 24 + i * 18);
    }
    const headY = top + 40 + qLines.length * 18;
    ctx.font = '800 38px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = "#000";
    const head = timeout ? "시간 초과" : ok ? "정답!" : "오답!";
    ctx.strokeText(head, W / 2, headY);
    ctx.fillStyle = timeout || !ok ? "#ff3d9a" : "#4df0ff";
    ctx.fillText(head, W / 2, headY);
    ctx.font = '800 20px "Segoe UI", "Malgun Gothic", sans-serif';
    ctx.lineWidth = 6;
    const sub = timeout
      ? "정답은  " + ans
      : "먹은 글자  " + (quiz.eaten || "-") + "     정답은  " + ans;
    ctx.strokeText(sub, W / 2, headY + 36);
    ctx.fillStyle = "#fff";
    ctx.fillText(sub, W / 2, headY + 36);
    ctx.restore();
  }

  function clearQuizLetters(keep) {
    for (let i = 0; i < enemies.live.length; i++) {
      const e = enemies.live[i];
      if (e.alive && e.kind === "quiz" && e !== keep) e.alive = false;
    }
  }

  function endQuiz(timeout) {
    if (quiz.phase === "off") return;
    clearQuizLetters(null);
    if (timeout && (quiz.phase === "preview" || quiz.phase === "live")) {
      showQuizVerdict(false, "", true);
      return;
    }
    quiz.on = false;
    quiz.phase = "off";
    quiz.cd = 8 + Math.random() * 5;
    hideQuizBanner();
  }

  function spawnQuizMarks() {
    const o = spawnEnemy("quiz", 120, 200, {
      letter: "O",
      correct: quiz.answer === true,
      move: "quiz",
      data: 0,
      ty: 240,
      every: 99,
    });
    const x = spawnEnemy("quiz", 360, 320, {
      letter: "X",
      correct: quiz.answer === false,
      move: "quiz",
      data: 1,
      ty: 280,
      every: 99,
    });
    o.qvx = 110 * (Math.random() < 0.5 ? -1 : 1);
    o.qvy = 90 * (Math.random() < 0.5 ? -1 : 1);
    x.qvx = 120 * (Math.random() < 0.5 ? -1 : 1);
    x.qvy = 95 * (Math.random() < 0.5 ? -1 : 1);
  }

  function startQuiz() {
    if (quiz.phase !== "off" || typeof QUIZ === "undefined" || !QUIZ.length) return;
    if (clock < 4 || clock > 70) return;
    const remain = [];
    for (let i = 0; i < QUIZ.length; i++) if (quiz.used.indexOf(i) < 0) remain.push(i);
    const idx = remain.length ? pick(remain) : ((Math.random() * QUIZ.length) | 0);
    if (quiz.used.indexOf(idx) < 0) quiz.used.push(idx);
    if (quiz.used.length >= QUIZ.length) quiz.used = [];
    const item = QUIZ[idx];
    quiz.on = true;
    quiz.phase = "preview";
    quiz.t = 5;
    quiz.count = 5;
    quiz.answer = !!item.a;
    quiz.q = item.q;
    showQuizBanner(item.q, 5);
    SFX.ui();
  }

  function eatQuiz(e) {
    if (!e || !e.alive || e.kind !== "quiz") return;
    if (quiz.phase !== "live") return;
    const eaten = e.letter || (e.correct === quiz.answer ? (quiz.answer ? "O" : "X") : (quiz.answer ? "X" : "O"));
    const ok = !!e.correct;
    e.alive = false;
    clearQuizLetters(null);
    if (ok) {
      addScore(1400, e.x, e.y, false);
      emit(e.x, e.y, 28, { color: "#4df0ff", smax: 280, life: 0.5 });
      spawnPickup(e.x, e.y, Math.random() < 0.5 ? "gem" : "form");
      shake = Math.max(shake, 6);
    } else {
      emit(e.x, e.y, 22, { color: "#ff3d9a", smax: 240, life: 0.45 });
    }
    if (!ok) hitPlayer();
    showQuizVerdict(ok, eaten, false);
  }

  function doBomb() {
    if (mode !== "play" || player.dead || player.bombs <= 0 || bombCd > 0) return;
    player.bombs--;
    bombCd = 0.55;
    player.inv = Math.max(player.inv, 1);
    timeScale = 0.22;
    slowRec = 0.55;
    shake = 20;
    flash = 0.75;
    SFX.bomb();
    if (shock.length > 24) shock.shift();
    shock.push({ x: player.x, y: player.y, r: 12, vr: 640, life: 0.5 });
    let cancelled = 0;
    for (let i = 0; i < eBullets.live.length; i++) {
      const b = eBullets.live[i];
      if (!b.alive) continue;
      b.alive = false;
      emit(b.x, b.y, 3, { color: "#ffd45a", smax: 90, life: 0.3, r: 1.8 });
      cancelled++;
    }
    if (cancelled) addScore(8 * cancelled, player.x, player.y - 24, false);
    for (let i = 0; i < enemies.live.length; i++) {
      const e = enemies.live[i];
      if (e.alive) hurtEnemy(e, e.kind === "boss" ? 42 : 30, true);
    }
    syncHud();
  }

  function hitPlayer() {
    if (player.inv > 0 || player.dead) return;
    if (player.shield) {
      player.shield = false;
      player.inv = 1.15;
      emit(player.x, player.y, 28, { color: "#7af0ff", smax: 240, life: 0.4 });
      SFX.shield();
      shake = 8;
      return;
    }
    chain = 0;
    chainT = 0;
    shake = 16;
    flash = 0.85;
    timeScale = 0.14;
    slowRec = 0.65;
    SFX.hurt();
    emit(player.x, player.y, 36, { color: "#4df0ff", smax: 300, life: 0.5 });
    if (player.power > 0) {
      player.power--;
      spawnPickup(player.x + rand(-20, 20), player.y - 28, "gem");
    }
    player.lives--;
    if (player.lives <= 0) {
      if (!player.phoenixUsed && player.power === 0) {
        startPhoenix();
      } else {
        player.lives = 0;
        player.dead = true;
        player.deadT = 1.55;
        SFX.die();
        emit(player.x, player.y, 60, { color: "#ffffff", smax: 380, life: 0.7 });
      }
    } else {
      player.inv = 2.25;
      if (player.lives === 1 && player.power === 0 && !player.phoenixUsed) startPhoenix();
    }
    syncHud();
  }

  function updatePlayer(dt) {
    const p = player;
    if (p.dead) {
      p.deadT -= dt;
      if (p.deadT <= 0) gameOver();
      return;
    }
    p.inv = Math.max(0, p.inv - dt);
    if (p.phoenixT > 0) {
      p.phoenixT -= dt;
      if (p.phoenixT <= 0) p.inv = Math.max(p.inv, 0.8);
    }
    if (p.formT > 0) {
      p.formT -= dt;
      if (p.formT <= 0 && p.form === "berserk") {
        p.power = Math.max(0, p.power - 1);
        setForm("striker");
      }
    }
    const info = FORM_INFO[p.form] || FORM_INFO.striker;
    p.focus = p.form !== "berserk" && (keys.has("ShiftLeft") || keys.has("ShiftRight") || keys.has("Shift"));
    if (p.daze > 0) p.daze -= dt;
    const speedMul = p.daze > 0 ? 0.38 : 1;
    const speed = (p.focus ? info.focus : info.speed) * speedMul;
    let ax = 0;
    let ay = 0;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) ax -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) ax += 1;
    if (keys.has("ArrowUp") || keys.has("KeyW")) ay -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) ay += 1;
    if (ax || ay) {
      const m = Math.hypot(ax, ay) || 1;
      p.x += (ax / m) * speed * dt;
      p.y += (ay / m) * speed * dt;
      mouse.on = false;
    } else if (mouse.on) {
      if (speedMul < 1) {
        p.x = lerp(p.x, mouse.x, 0.12);
        p.y = lerp(p.y, mouse.y, 0.12);
      } else {
        p.x = mouse.x;
        p.y = mouse.y;
      }
    }
    p.x = clamp(p.x, 18, W - 18);
    p.y = clamp(p.y, 24, H - 22);
    p.tilt = lerp(p.tilt, ax * -0.22, 1 - Math.pow(0.001, dt));
    p.trail.unshift({ x: p.x, y: p.y });
    if (p.trail.length > 18) p.trail.length = 18;
    p._trailTick = (p._trailTick || 0) + 1;
    if (p._trailTick % 3 === 0) {
      emit(p.x - 8, p.y + 20, 1, { color: "#4df0ff", a: Math.PI / 2, spread: 0.35, smin: 20, smax: 70, life: 0.14, r: 1.5, vx: -p.tilt * 40 });
      emit(p.x + 8, p.y + 20, 1, { color: "#7af6ff", a: Math.PI / 2, spread: 0.35, smin: 20, smax: 70, life: 0.14, r: 1.5, vx: -p.tilt * 40 });
    }

    fireCd -= dt;
    let rate = Math.max(0.046, 0.078 - p.power * 0.005);
    if (p.form === "lancer") rate = 0.11;
    else if (p.form === "raider") rate = 0.042;
    else if (p.form === "core") rate = 0.052;
    else if (p.form === "berserk") rate = 0.04;
    if (fireCd <= 0) {
      fireCd = rate;
      firePlayer();
    }
    if (wantBomb > 0) {
      wantBomb -= dt;
      doBomb();
    }
    bombCd = Math.max(0, bombCd - dt);
  }

  function fireEnemy(e) {
    const r = 1 + rank * 0.1;
    const spd = (v) => v * r;
    if (e.kind === "asteroid") return;
    if (e.kind === "quiz") {
      if (!e.correct) {
        const a = aimed(e.x, e.y, spd(150));
        eShot(e.x, e.y + 10, a.vx, a.vy, 5.5, "#ff3d9a", true);
      }
      return;
    }
    if (e.kind === "boss") {
      fireBoss(e);
      return;
    }
    if (fireMinionThemed(e, r, spd)) return;
    if (e.kind === "transport") {
      const a = aimed(e.x, e.y + 16, spd(130));
      eShot(e.x - 20, e.y + 18, a.vx, a.vy, 5.5, "#ffd45a", true);
      eShot(e.x + 20, e.y + 18, a.vx, a.vy, 5.5, "#ffd45a", true);
      return;
    }
    if (e.kind === "wasp") {
      const a = aimed(e.x, e.y + 12, spd(165));
      eShot(e.x, e.y + 14, a.vx, a.vy, 4.8, "#ff8a4a", true);
    } else if (e.kind === "crab") {
      const a = aimed(e.x, e.y + 16, spd(150));
      nway(e.x, e.y + 18, a.a, 3, 0.22, spd(150), 5.2, "#ff4db8", true);
    } else if (e.kind === "tank") {
      const a = aimed(e.x, e.y + 28, spd(190));
      eShot(e.x - 10, e.y + 30, a.vx, a.vy, 7.5, "#ffb347");
      eShot(e.x + 10, e.y + 30, a.vx, a.vy, 7.5, "#ffb347");
      nway(e.x, e.y + 20, Math.PI / 2, 5, 0.18, spd(130), 4.6, "#ff7a3a", true);
    } else if (e.kind === "spinner") {
      e.ang += 0.38;
      eShot(e.x, e.y, Math.cos(e.ang) * spd(135), Math.sin(e.ang) * spd(135), 4.6, "#ffd45a", true);
      eShot(e.x, e.y, Math.cos(e.ang + Math.PI) * spd(135), Math.sin(e.ang + Math.PI) * spd(135), 4.6, "#ffd45a", true);
    } else if (e.kind === "boss") {
      fireBoss(e);
    }
  }

  function fireMinionThemed(e, r, spd) {
    const name = stageBossName;
    const th = themeOf();
    const col = (th && th.bullet) || "#ff5a7a";
    if (!name) return false;
    if (name === "앞으로빵빵") {
      eShot(e.x, e.y + 12, 0, spd(190), 5, col, true);
      e.every = Math.min(e.every, 0.72);
      return true;
    }
    if (name === "기라성") {
      const a = aimed(e.x, e.y, spd(200));
      eShot(e.x, e.y + 8, a.vx, a.vy, 4.6, col, true);
      return true;
    }
    if (name === "김탁구") {
      const a = rand(-0.9, 0.9) + Math.PI / 2;
      const sp = spd(160);
      eShot(e.x, e.y + 8, Math.cos(a) * sp, Math.sin(a) * sp, 5, col, true, { bounce: 2 });
      return true;
    }
    if (name === "다낚아") {
      nway(e.x, e.y + 10, Math.PI / 2, 3, 0.32, spd(115), 4.4, col, true);
      return true;
    }
    if (name === "오른손") {
      const a = aimed(e.x, e.y, spd(240));
      eShot(e.x, e.y + 10, a.vx, a.vy, 6.2, col);
      return true;
    }
    if (name === "박엄살") {
      if (clock < 42) eShot(e.x, e.y + 10, 0, spd(75), 5.2, "#ffd0ea", true);
      else {
        const a = aimed(e.x, e.y, spd(230));
        eShot(e.x, e.y + 8, a.vx, a.vy, 3.8, "#ff3d6e", true);
      }
      return true;
    }
    if (name === "남사기관") {
      const a = aimed(e.x, e.y, spd(190));
      eShot(e.x, e.y + 10, a.vx + (Math.random() < 0.5 ? -55 : 55), a.vy, 5, col, true, { wob: 70 });
      return true;
    }
    if (name === "앙큼기사") {
      const a = aimed(e.x, e.y, spd(70));
      eShot(e.x, e.y + 8, a.vx, a.vy * 0.35, 6.4, "#f6f1e0", false, { g: 270 });
      return true;
    }
    if (name === "빠뜨렀슈") {
      eShot(e.x, e.y + 8, rand(-40, 40), spd(85), 8, col, false, { wob: 55 });
      return true;
    }
    if (name === "깨발랄지나아C") {
      const a0 = Math.random() * Math.PI * 2;
      eShot(e.x, e.y, Math.cos(a0) * spd(145), Math.sin(a0) * spd(145), 4.2, col, true);
      eShot(e.x, e.y, Math.cos(a0 + 1.2) * spd(145), Math.sin(a0 + 1.2) * spd(145), 4.2, col, true);
      return true;
    }
    if (name === "우정신프로") {
      const a = aimed(e.x, e.y, spd(135));
      if (Math.random() < 0.6) eShot(e.x, e.y + 8, a.vx, a.vy, 6.2, "#ff9ad4", false, { effect: "praise" });
      else eShot(e.x, e.y + 8, a.vx, a.vy, 4.4, col, true);
      return true;
    }
    if (name === "빌런") {
      const a = aimed(e.x, e.y, spd(160));
      eShot(e.x, e.y + 8, a.vx, a.vy, 3.6, col, true);
      return true;
    }
    if (name === "골프보다구찌") {
      if (Math.random() < 0.45) eShot(e.x, e.y + 8, rand(-30, 30), spd(120), 6.4, "#b6f0c0", false, { effect: "heckle", wob: 70 });
      else eShot(e.x, e.y + 8, rand(-50, 50), spd(95), 5.2, col, true);
      return true;
    }
    if (name === "버디요정") {
      e.ang += 0.45;
      eShot(e.x, e.y, Math.cos(e.ang) * spd(125), Math.sin(e.ang) * spd(125), 4.2, col, true);
      return true;
    }
    return false;
  }

  function fireBoss(e) {
    const pct = e.hp / e.maxHp;
    const r = 1 + rank * 0.08;
    const name = e.bossName || stageBossName;
    const th = themeOf();
    const col = (th && th.bullet) || "#ff4db8";
    const x = e.x;
    const y = e.y + 10;
    const left = e.x - 70;
    const right = e.x + 70;
    if (!halfLine && pct <= 0.5 && th) {
      halfLine = true;
      pushStory(name, pick(th.taunts));
    }
    if (name === "다낚아") {
      nway(x, y, Math.PI / 2, 7, 0.16, 130 * r, 4.6, col, true);
      if (pct < 0.55) {
        const a = aimed(x, y, 90 * r);
        eShot(x, y, a.vx, a.vy, 7, "#ffd45a", false, { wob: 40 });
      }
      e.every = 0.72 / r;
      return;
    }
    if (name === "오른손") {
      const a = aimed(x, y, 280 * r);
      eShot(x + 18, y, a.vx, a.vy, 7.2, col);
      nway(x, y, a.a, pct < 0.5 ? 5 : 3, 0.14, 240 * r, 6, col);
      e.every = 0.58 / r;
      return;
    }
    if (name === "박엄살") {
      if (pct > 0.48) {
        eShot(x - 20, y, -20, 90 * r, 5.5, "#ffd0ea", true);
        eShot(x + 20, y, 20, 90 * r, 5.5, "#ffd0ea", true);
        e.every = 1.05 / r;
      } else {
        if (!e.assassin) {
          e.assassin = true;
          toast("암살 모드", 1.4);
          storyQueue = [];
          showStory(name, "조신은 여기까지.", false);
          flash = 0.4;
        }
        const a = aimed(x, y, 260 * r);
        nway(x, y, a.a, 4, 0.09, 250 * r, 4, "#ff3d6e", true);
        e.every = 0.32 / r;
      }
      return;
    }
    if (name === "앞으로빵빵") {
      eShot(x, y, 0, 220 * r, 5.4, col, true);
      eShot(x - 26, y + 8, 0, 200 * r, 5, col, true);
      eShot(x + 26, y + 8, 0, 200 * r, 5, col, true);
      if (pct < 0.45) eShot(x, y + 12, 0, 260 * r, 6.2, "#fff1c4", true);
      e.every = 0.4 / r;
      return;
    }
    if (name === "기라성") {
      const a = aimed(x, y, 230 * r);
      nway(x, y, a.a, 3, 0.14, 220 * r, 5, col, true);
      eShot(left, y, -40, 180 * r, 4.8, "#ffe066", true);
      eShot(right, y, 40, 180 * r, 4.8, "#ffe066", true);
      e.every = 0.5 / r;
      return;
    }
    if (name === "김탁구") {
      const dir = pick([-1.1, -0.5, 0.5, 1.1, Math.PI / 2]);
      const sp = 170 * r;
      eShot(x - 18, y, Math.cos(dir) * sp, Math.abs(Math.sin(dir)) * sp + 40, 5.5, col, true, { bounce: 3 });
      eShot(x + 18, y, Math.cos(-dir) * sp, Math.abs(Math.sin(-dir)) * sp + 40, 5.5, col, true, { bounce: 3 });
      if (pct < 0.5) {
        const a = aimed(x, y, 90 * r);
        eShot(x, y, a.vx * 0.4, 60, 7, "#ffe08a", false, { g: 240, bounce: 1 });
      }
      e.every = 0.48 / r;
      return;
    }
    if (name === "남사기관") {
      e.pitch = ((e.pitch || 0) + 1) % 3;
      if (e.pitch === 0) {
        const a = aimed(x, y, 340 * r);
        eShot(x, y, a.vx, a.vy, 6.5, "#fff");
      } else if (e.pitch === 1) {
        const a = aimed(x, y, 170 * r);
        eShot(x, y, a.vx + 110, a.vy, 5.5, col, true, { wob: 90 });
      } else {
        const a = aimed(x, y, 95 * r);
        eShot(x, y, a.vx, a.vy, 7.5, "#ffd45a");
      }
      e.every = 0.62 / r;
      return;
    }
    if (name === "앙큼기사") {
      const a = aimed(x, y, 80 * r);
      eShot(x - 16, y, a.vx - 30, 40, 7, "#f4f0e0", false, { g: 240 });
      eShot(x, y, a.vx, 20, 7, "#f4f0e0", false, { g: 250 });
      eShot(x + 16, y, a.vx + 30, 40, 7, "#f4f0e0", false, { g: 240 });
      if (pct < 0.45) {
        const d = aimed(x, y, 280 * r);
        eShot(x, y, d.vx, d.vy, 5.5, "#c9a227");
      }
      e.every = 0.7 / r;
      return;
    }
    if (name === "빠뜨렀슈") {
      ring(x, y, 10, 95 * r, e.age, 8, col);
      eShot(x - 24, y, -15, 40, 7, "#ffee99", false, { g: 180, wob: 30 });
      eShot(x + 24, y, 15, 40, 7, "#ffee99", false, { g: 180, wob: 30 });
      e.every = 0.68 / r;
      return;
    }
    if (name === "깨발랄지나아C") {
      if (Math.random() < 0.1) toast("아이씨!", 0.55);
      ring(x, y, 12, 140 * r, Math.random() * 6, 4.6, col);
      nway(x, y, Math.random() * Math.PI, 5, 0.4, 160 * r, 4.4, "#fff38a", true);
      e.every = 0.42 / r;
      return;
    }
    if (name === "우정신프로") {
      nway(x, y, Math.PI / 2, 5, 0.2, 120 * r, 6.5, "#ff9ad4", false);
      for (let i = -2; i <= 2; i++) {
        eShot(x + i * 16, y + 8, i * 20, 110 * r, 6.2, "#ffb7dc", false, { effect: "praise" });
      }
      const a = aimed(x, y, 170 * r);
      eShot(x, y, a.vx, a.vy, 5, "#fff");
      e.every = 0.75 / r;
      return;
    }
    if (name === "빌런") {
      e.cue = ((e.cue || 0) + 1) % 4;
      if (e.cue === 0) {
        const a = aimed(x, y, 210 * r);
        nway(x, y, a.a, 5, 0.08, 210 * r, 3.4, col, true);
        if (Math.random() < 0.4) showStory(name, "큐.", false);
      } else if (e.cue === 1) {
        eShot(x - 40, y, -20, 190 * r, 3.2, "#fff", true);
        eShot(x, y, 0, 220 * r, 3.2, "#fff", true);
        eShot(x + 40, y, 20, 190 * r, 3.2, "#fff", true);
      } else if (e.cue === 2) {
        ring(x, y, 8, 130 * r, e.age, 3.6, col);
      } else {
        const a = aimed(x, y, 260 * r);
        eShot(x, y, a.vx, a.vy, 4.2, "#ffd45a", true);
      }
      e.every = 0.52 / r;
      return;
    }
    if (name === "골프보다구찌") {
      if (Math.random() < 0.22) floatText(x, y - 42, pick(["어허!", "나이스~?", "기침!"]), "#7edc8a");
      ring(x, y, 6, 90 * r, e.age, 6.8, "#b6f0c0");
      eShot(x - 18, y + 8, -25, 40, 6.6, "#d4ffda", false, { effect: "heckle", wob: 80, g: 40 });
      eShot(x + 18, y + 8, 25, 40, 6.6, "#d4ffda", false, { effect: "heckle", wob: 80, g: 40 });
      const a = aimed(x, y, 70 * r);
      eShot(x, y, a.vx, 30, 7, "#f4f0e0", false, { g: 220 });
      if (pct < 0.5) nway(x, y, Math.PI / 2, 5, 0.16, 150 * r, 4.8, col, true);
      e.every = 0.62 / r;
      return;
    }
    if (name === "버디요정") {
      e.ang += 0.55;
      eShot(x, y, Math.cos(e.ang) * 130 * r, Math.sin(e.ang) * 130 * r, 4.6, col, true);
      eShot(x, y, Math.cos(e.ang + 2.1) * 120 * r, Math.sin(e.ang + 2.1) * 120 * r, 4.6, col, true);
      if (pct < 0.4) ring(x, y, 8, 100 * r, e.ang, 4.2, "#fff");
      e.every = 0.2 / r;
      return;
    }
    nway(x, y, Math.PI / 2, 5, 0.16, 160 * r, 5.4, col, true);
    e.every = 0.8 / r;
  }

  function updateEnemies(dt) {
    for (let i = 0; i < enemies.live.length; i++) {
      const e = enemies.live[i];
      if (!e.alive) continue;
      e.age += dt;
      e.flash = Math.max(0, e.flash - dt);
      e.ang += e.spin * dt;
      if (e.move === "dive") {
        e.y += e.speed * dt;
        e.x = e.bx + Math.sin(e.age * 2.2 + e.data) * (e.data || 16);
      } else if (e.move === "sine") {
        e.y += e.speed * dt;
        e.x = e.bx + Math.sin(e.age * 1.8) * 70;
      } else if (e.move === "slow") {
        e.y += e.speed * dt;
      } else if (e.move === "diag") {
        e.x += e.speed * dt * (e.data || 1);
        e.y += e.speed * 0.7 * dt;
      } else if (e.move === "hover") {
        if (e.y < e.ty) e.y += e.speed * dt;
        else {
          e.x = e.bx + Math.sin(e.age * 1.1) * 90;
          e.left -= dt;
          if (e.left <= 0) {
            e.move = "dive";
            if (e.bounty) e.speed = 260;
          }
        }
      } else if (e.move === "boss") {
        if (e.phase === 0) {
          e.y += 70 * dt;
          if (e.y >= 128) { e.y = 128; e.phase = 1; }
        } else if (e.bossName === "빌런") {
          e.x = W / 2 + Math.sin(e.age * 1.18) * 126;
          e.y = 120 + Math.sin(e.age * 1.6) * 16;
        } else {
          e.x = W / 2 + Math.sin(e.age * 0.55) * 108;
          e.y = 128 + Math.sin(e.age * 0.9) * 10;
        }
      } else if (e.move === "fall") {
        e.y += e.speed * dt;
        e.x += (e.data || 0) * 40 * dt;
        e.ang += dt * 1.4;
      } else if (e.move === "cross") {
        e.x += e.speed * (e.data || 1) * dt;
        e.y += Math.sin(e.age * 1.4) * 18 * dt;
      } else if (e.move === "quiz") {
        e.x += (e.qvx || 110) * dt;
        e.y += (e.qvy || 90) * dt;
        if (e.x < 46 && e.qvx < 0) e.qvx *= -1;
        if (e.x > W - 46 && e.qvx > 0) e.qvx *= -1;
        if (e.y < 110 && e.qvy < 0) e.qvy *= -1;
        if (e.y > H - 90 && e.qvy > 0) e.qvy *= -1;
        e.x = clamp(e.x, 46, W - 46);
        e.y = clamp(e.y, 110, H - 90);
      }
      if (e.kind !== "boss") {
        if (stageBossName === "빠뜨렀슈") e.x += Math.sin(e.age * 6) * 50 * dt;
        if (stageBossName === "버디요정") e.x += Math.sin(e.age * 3.2) * 42 * dt;
        if (stageBossName === "깨발랄지나아C") e.x += Math.sin(e.age * 11) * 28 * dt;
      }
      if (e.kind === "boss" && e.bossName === "빌런") {
        e.w = 132;
        e.h = 176;
        e.r = 38;
      }
      const fireScale = (field.surge ? 1.55 : 1) * (field.emp ? 0.5 : 1);
      if (e.y > 40 && e.y < H + 20) {
        e.fire -= dt * fireScale;
        if (e.fire <= 0) {
          e.fire = e.every;
          if (e.y < H - 40) fireEnemy(e);
        }
      }
      if (e.kind !== "boss" && e.kind !== "quiz" && off(e.x, e.y, 80)) e.alive = false;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      if (e.kind === "quiz") {
        if (dx * dx + dy * dy < (e.r + 16) * (e.r + 16)) eatQuiz(e);
        continue;
      }
      if (!player.dead && dx * dx + dy * dy < (e.r + player.hitR) * (e.r + player.hitR)) {
        if (player.phoenixT > 0) {
          e.ramCd -= dt;
          if (e.ramCd <= 0) {
            e.ramCd = 0.1;
            hurtEnemy(e, 14, true);
          }
        } else {
          hitPlayer();
        }
      }
    }
  }

  function updateBullets(dt) {
    for (let i = 0; i < pBullets.live.length; i++) {
      const b = pBullets.live[i];
      if (!b.alive) continue;
      if (b.home) {
        let best = null;
        let bestD = 160000;
        for (let j = 0; j < enemies.live.length; j++) {
          const e = enemies.live[j];
          if (!e.alive || e.kind === "quiz") continue;
          const ddx = e.x - b.x;
          const ddy = e.y - b.y;
          const d2 = ddx * ddx + ddy * ddy;
          if (d2 < bestD) { bestD = d2; best = e; }
        }
        if (best) {
          const a = angTo(b.x, b.y, best.x, best.y);
          const spd = Math.hypot(b.vx, b.vy) || 620;
          b.vx = lerp(b.vx, Math.cos(a) * spd, 0.12);
          b.vy = lerp(b.vy, Math.sin(a) * spd, 0.12);
        }
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (off(b.x, b.y, 20)) { b.alive = false; continue; }
      for (let j = 0; j < enemies.live.length; j++) {
        const e = enemies.live[j];
        if (!e.alive || e.kind === "quiz") continue;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (dx * dx + dy * dy < (e.r + b.r) * (e.r + b.r)) {
          if (b.lastHit === e) continue;
          b.lastHit = e;
          emit(b.x, b.y, 4, { color: "#c8ffff", smax: 90, life: 0.18, r: 1.4 });
          hurtEnemy(e, b.dmg, false);
          if (b.pierce > 0) b.pierce--;
          else { b.alive = false; break; }
        }
      }
    }
    const bulletSlow = field.emp ? 0.42 : 1;
    for (let i = 0; i < eBullets.live.length; i++) {
      const b = eBullets.live[i];
      if (!b.alive) continue;
      if (b.g) b.vy += b.g * dt;
      if (b.wob) b.x += Math.sin(clock * 7 + b.y * 0.04) * b.wob * dt;
      if (b.bounce > 0) {
        if (b.x < 12 && b.vx < 0) { b.vx *= -1; b.bounce--; }
        if (b.x > W - 12 && b.vx > 0) { b.vx *= -1; b.bounce--; }
        if (b.y > H - 14 && b.vy > 0) { b.vy *= -0.88; b.bounce--; }
      }
      b.x += b.vx * dt * bulletSlow;
      b.y += b.vy * dt * bulletSlow;
      if (off(b.x, b.y, 16)) { b.alive = false; continue; }
      if (player.dead) continue;
      const dx = b.x - player.x;
      const dy = b.y - player.y;
      const d2 = dx * dx + dy * dy;
      const hit = player.hitR + b.r * 0.72;
      const graze = player.grazeR + b.r;
      if (d2 < hit * hit) {
        b.alive = false;
        if (b.effect === "praise") {
          player.daze = Math.max(player.daze, 1.05);
          floatText(player.x, player.y - 18, "칭찬 과다", "#ff9ad4");
          SFX.ui();
        } else if (b.effect === "heckle") {
          player.daze = Math.max(player.daze, 1.15);
          floatText(player.x, player.y - 18, "구찌!", "#7edc8a");
          SFX.ui();
        } else {
          hitPlayer();
        }
      } else if (!b.grazed && d2 < graze * graze) {
        b.grazed = true;
        addScore(20, b.x, b.y, false);
        chainT = Math.min(2.2, chainT + 0.12);
        SFX.graze();
        emit(b.x, b.y, 3, { color: "#ffffff", smax: 80, life: 0.2, r: 1.2 });
      }
    }
  }

  function updatePickups(dt) {
    for (let i = 0; i < pickups.live.length; i++) {
      const p = pickups.live[i];
      if (!p.alive) continue;
      p.t += dt;
      p.vy = Math.min(130, p.vy + 40 * dt);
      p.y += p.vy * dt;
      p.x += Math.sin(p.t * 3) * 18 * dt;
      if (p.y > H + 30) { p.alive = false; continue; }
      const dx = p.x - player.x;
      const dy = p.y - player.y;
      const magnet = player.y < H * 0.28 ? 260 : 140;
      const dist = Math.hypot(dx, dy);
      if (dist < 52 || player.y < H * 0.28) {
        if (dist > 1) {
          p.x -= (dx / dist) * magnet * dt;
          p.y -= (dy / dist) * magnet * dt;
        }
      }
      if (dist < 22 && !player.dead) {
        p.alive = false;
        SFX.pickup();
        if (p.kind === "gem") {
          player.power = Math.min(5, player.power + 1);
          addScore(300, p.x, p.y);
          floatText(p.x, p.y, "POWER UP", "#4df0ff");
        } else if (p.kind === "bomb") {
          player.bombs = Math.min(6, player.bombs + 1);
          addScore(500, p.x, p.y);
          floatText(p.x, p.y, "BOMB", "#ffd45a");
        } else if (p.kind === "shield") {
          player.shield = true;
          addScore(400, p.x, p.y);
          floatText(p.x, p.y, "SHIELD", "#7af0ff");
        } else if (p.kind === "form") {
          addScore(800, p.x, p.y);
          cycleForm();
        }
        emit(p.x, p.y, 12, { color: "#fff", smax: 140, life: 0.3 });
        syncHud();
      }
    }
  }

  function updateParts(dt) {
    for (let i = 0; i < parts.live.length; i++) {
      const p = parts.live[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.max(0, 1 - p.drag * dt);
      p.vy *= Math.max(0, 1 - p.drag * dt);
    }
    for (let i = shock.length - 1; i >= 0; i--) {
      const s = shock[i];
      s.life -= dt;
      s.r += s.vr * dt;
      if (s.life <= 0) shock.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y -= 28 * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
  }

  function buildSchedule(r) {
    rank = r;
    schedule = [];
    halfLine = false;
    if (quiz.phase !== "off") endQuiz(false);
    stageBossName = nextBossName();
    const th = themeOf();
    storyQueue = [];
    storyT = 0;
    setStoryPortrait(stageBossName);
    pushStory("시스템", "STAGE " + (r + 1) + "  " + stageBossName, true);
    if (th && th.minion) pushStory("시스템", th.minion + "이 몰려온다.", true);
    if (th && th.intro) th.intro.forEach((line) => pushStory(stageBossName, line));
    pumpStory();
    renderCollection();
    const t = (at, fn) => schedule.push({ at, fn, done: false });
    const mul = 1 + r * 0.12;
    t(0.3, () => toast(stageBossName, 1.6));
    t(1.5, () => {
      for (let i = 0; i < 5; i++) spawnEnemy("wasp", 70 + i * 85, -36 - Math.abs(i - 2) * 16, { data: 12 });
    });
    t(5.2, () => {
      for (let i = 0; i < 6; i++) spawnEnemy("wasp", 50 + i * 76, -40, { move: "sine", speed: 150 });
    });
    t(9.0, () => {
      spawnEnemy("crab", -40, 80, { move: "diag", speed: 110, data: 1, drop: "gem40" });
      spawnEnemy("crab", W + 40, 120, { move: "diag", speed: 110, data: -1, drop: "gem40" });
    });
    t(12.8, () => {
      for (let i = 0; i < 8; i++) spawnEnemy("wasp", 40 + (i % 8) * 56, -30 - i * 22, { move: "dive", speed: 195 });
    });
    t(17.2, () => spawnEnemy("tank", W / 2, -70, { drop: "gem80" }));
    t(19.2, () => spawnBounty(W / 2, -50));
    t(21.0, () => {
      for (let i = 0; i < 4; i++) spawnEnemy("wasp", 90 + i * 100, -40, { move: "sine" });
      spawnEnemy("crab", W / 2, -50, { move: "sine", speed: 70 });
    });
    t(22.5, () => startFieldEvent("asteroid", 15));
    t(25.5, () => spawnEnemy("spinner", W / 2, -40, { ty: 150, left: 7 }));
    t(30.0, () => {
      spawnEnemy("tank", 130, -80);
      spawnEnemy("tank", 350, -110);
    });
    t(32.2, () => {
      const fromLeft = Math.random() < 0.5;
      spawnEnemy("transport", fromLeft ? -60 : W + 60, 160, {
        move: "cross",
        data: fromLeft ? 1 : -1,
        drop: "cargo",
      });
      toast("SUPPLY TRAIN", 1.4);
    });
    t(35.5, () => {
      for (let i = 0; i < 3; i++) spawnEnemy("crab", 90 + i * 150, -60 - i * 20, { move: "sine" });
    });
    t(40.5, () => startFieldEvent("emp", 12));
    t(41.0, () => {
      spawnEnemy("spinner", 140, -40, { ty: 140, left: 6 });
      spawnEnemy("spinner", 340, -40, { ty: 170, left: 6 });
      for (let i = 0; i < 5; i++) spawnEnemy("wasp", 60 + i * 90, -30, { speed: 210 });
    });
    t(48.0, () => {
      for (let i = 0; i < 10; i++) {
        spawnEnemy("wasp", i % 2 === 0 ? 70 : W - 70, -20 - i * 18, { move: "diag", data: i % 2 === 0 ? 1 : -1, speed: 160 });
      }
    });
    t(48.5, () => spawnBounty(rand(120, 360), -50));
    t(54.0, () => {
      spawnEnemy("tank", W / 2, -80, { drop: "gem90" });
      spawnEnemy("crab", 100, -50);
      spawnEnemy("crab", 380, -50);
      startFieldEvent("surge", 15);
    });
    t(60.5, () => {
      spawnEnemy("spinner", W / 2, -50, { ty: 120, left: 8 });
      for (let i = 0; i < 6; i++) spawnEnemy("wasp", 50 + i * 76, -40, { speed: 180 * mul });
    });
    t(68.0, () => {
      for (let i = 0; i < 4; i++) spawnEnemy("crab", 80 + i * 107, -70, { move: "sine", speed: 85 });
    });
    t(74.0, () => {
      toast("WARNING", 2);
      SFX.warning();
      const cur = themeOf();
      if (cur) { storyQueue = []; showStory(stageBossName, cur.warn, false); }
    });
    t(78.5, () => {
      const name = stageBossName;
      const thNow = themeOf();
      const b = spawnEnemy("boss", W / 2, -90, {
        hp: DEFS.boss.hp * (1 + r * 0.35),
        drop: "bomb",
        bossName: name,
      });
      if (thNow && sprites[thNow.art]) {
        if (name === "빌런") { b.w = 132; b.h = 176; b.r = 38; }
        else { b.w = 150; b.h = 168; b.r = 44; }
      }
      b.phase = 0;
      $("bossbar").classList.add("on");
      const bn = $("bossName");
      if (bn) bn.textContent = name;
      toast(name, 2);
      const cur = themeOf();
      if (cur) { storyQueue = []; showStory(name, cur.enter, false); }
    });
  }

  function updateDirector(dt) {
    clock += dt;
    for (let i = 0; i < schedule.length; i++) {
      const ev = schedule[i];
      if (!ev.done && clock >= ev.at) {
        ev.done = true;
        ev.fn();
      }
    }
    if (stageClearT > 0) {
      stageClearT -= dt;
      if (stageClearT <= 0) {
        $("bossbar").classList.remove("on");
        rank++;
        clock = 0;
        buildSchedule(rank);
        player.inv = Math.max(player.inv, 1.2);
        player.bombs = Math.min(6, player.bombs + 1);
        addScore(5000, player.x, player.y);
        floatText(W / 2, H / 2, "BONUS 5000", "#ffd45a");
        syncHud();
      }
    }
    if (quiz.phase === "preview") {
      quiz.t -= dt;
      const c = Math.max(1, Math.ceil(quiz.t));
      if (c !== quiz.count) {
        quiz.count = c;
        showQuizBanner(quiz.q, c);
      }
      if (quiz.t <= 0) {
        quiz.phase = "live";
        quiz.t = 12;
        spawnQuizMarks();
        showQuizBanner(quiz.q, 0);
      }
    } else if (quiz.phase === "live") {
      quiz.t -= dt;
      if (quiz.t <= 0) endQuiz(true);
    } else if (quiz.phase === "result") {
      quiz.t -= dt;
      if (quiz.t <= 0) {
        quiz.on = false;
        quiz.phase = "off";
        quiz.cd = 7 + Math.random() * 4;
        hideQuizBanner();
      }
    } else {
      quiz.cd -= dt;
      if (quiz.cd <= 0) startQuiz();
    }
  }

  function updateGates(dt) {
    for (let i = gates.length - 1; i >= 0; i--) {
      const g = gates[i];
      g.life -= dt;
      g.y += 28 * dt;
      if (!g.taken && !player.dead &&
          Math.abs(player.x - g.x) < g.w * 0.5 &&
          Math.abs(player.y - g.y) < g.h * 0.5) {
        g.taken = true;
        let n = 0;
        for (let k = 0; k < eBullets.live.length; k++) {
          const b = eBullets.live[k];
          if (!b.alive) continue;
          b.alive = false;
          emit(b.x, b.y, 3, { color: "#ffd45a", smax: 90, life: 0.28, r: 1.6 });
          n++;
        }
        if (n) addScore(12 * n, player.x, player.y - 20, false);
        addScore(1200, g.x, g.y);
        toast("GATE BONUS", 1.2);
        flash = 0.4;
        SFX.pickup();
      }
      if (g.life <= 0 || g.y > H + 40) gates.splice(i, 1);
    }
  }

  function updateStars(dt) {
    scroll += 28 * dt;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.y += (40 + s.z * 90) * dt;
      if (s.y > H) { s.y = -4; s.x = Math.random() * W; }
    }
  }

  function update(dt) {
    if (mode !== "play") return;
    if (freeze > 0) { freeze -= dt; return; }
    if (slowRec > 0) {
      slowRec -= dt;
      timeScale = lerp(timeScale, 1, 1 - Math.pow(0.02, dt));
      if (slowRec <= 0) timeScale = 1;
    }
    const t = dt * timeScale;
    shake = Math.max(0, shake - 18 * dt);
    flash = Math.max(0, flash - 1.6 * dt);
    if (chainT > 0) {
      chainT -= dt;
      if (chainT <= 0) {
        chain = 0;
        chainGateUsed = { 10: false, 25: false, 50: false };
      }
    }
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) {
        const tEl = $("toast");
        tEl.classList.remove("show", "ok", "bad");
      }
    }
    if (field.t > 0) {
      field.t -= dt;
      if (field.type === "asteroid") {
        field.spawn -= dt;
        if (field.spawn <= 0) {
          field.spawn = 0.42;
          spawnEnemy("asteroid", rand(28, W - 28), -36, {
            speed: rand(120, 230),
            data: rand(-1.2, 1.2),
          });
        }
      }
      if (field.t <= 0) endFieldEvent();
    }
    storyT += dt;
    const storyWait = storyQueue.length ? 2.15 : 9.5;
    if (storyT > storyWait) {
      storyT = 0;
      if (!pumpStory()) {
        const th = themeOf();
        if (th) showStory(stageBossName, pick(th.taunts), false);
      }
    }
    updateGates(t);
    updateStars(t);
    updateDirector(t);
    updatePlayer(t);
    updateEnemies(t);
    updateBullets(t);
    updatePickups(t);
    updateParts(t);
    pBullets.sweep();
    eBullets.sweep();
    enemies.sweep();
    pickups.sweep();
    parts.sweep();
  }

  function drawQuizMark(e) {
    const pulse = 1 + 0.06 * Math.sin(performance.now() / 90);
    const col = e.letter === "O" ? "#4df0ff" : "#ffd45a";
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.scale(pulse, pulse);
    ctx.globalCompositeOperation = "lighter";
    if (e.letter === "O") {
      ctx.strokeStyle = col;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = col;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(-18, -18);
      ctx.lineTo(18, 18);
      ctx.moveTo(18, -18);
      ctx.lineTo(-18, 18);
      ctx.stroke();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, -18);
      ctx.lineTo(18, 18);
      ctx.moveTo(18, -18);
      ctx.lineTo(-18, 18);
      ctx.stroke();
    }
    if (e.flash > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.beginPath();
      ctx.arc(0, 0, 28, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAsteroid(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.ang);
    ctx.fillStyle = "#6a6258";
    ctx.strokeStyle = "#c9bba8";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = e.r * (0.72 + Math.abs(Math.sin(i * 1.7 + e.data)) * 0.4);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawSprite(img, x, y, w, h, rot, flashAmt) {
    if (!img) return;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (flashAmt > 0) ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawGlowBall(x, y, r, color) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.35, color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.fillStyle = "#04070f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0);
    const sx = shake ? rand(-shake, shake) : 0;
    const sy = shake ? rand(-shake, shake) : 0;
    ctx.save();
    ctx.translate(sx, sy);

    const neb = sprites.nebula;
    if (neb) {
      const nh = W * (neb.height / neb.width);
      let ny = -(scroll * 0.35 % nh);
      ctx.globalAlpha = 1;
      ctx.drawImage(neb, 0, ny, W, nh);
      ctx.drawImage(neb, 0, ny + nh, W, nh);
    }

    ctx.fillStyle = "#c8f6ff";
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      ctx.globalAlpha = 0.25 + s.z * 0.45;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < gates.length; i++) {
      const g = gates[i];
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 90);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = g.taken ? "rgba(255,212,90,0.35)" : "rgba(77,240,255," + (0.45 + pulse * 0.4) + ")";
      ctx.lineWidth = 3;
      ctx.strokeRect(g.x - g.w / 2, g.y - g.h / 2, g.w, g.h);
      ctx.strokeStyle = g.taken ? "rgba(255,212,90,0.2)" : "rgba(255,61,154,0.55)";
      ctx.strokeRect(g.x - g.w / 2 + 8, g.y - g.h / 2 + 8, g.w - 16, g.h - 16);
      ctx.restore();
    }

    for (let i = 0; i < pickups.live.length; i++) {
      const p = pickups.live[i];
      if (!p.alive) continue;
      const bob = Math.sin(p.t * 6) * 3;
      if (p.kind === "form") {
        drawSprite(sprites.gem, p.x, p.y + bob, 28, 28, p.t * 2, 0);
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "#c9a6ff";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        const img = sprites[p.kind] || sprites.gem;
        drawSprite(img, p.x, p.y + bob, 26, 26, 0, 0);
      }
    }

    for (let i = 0; i < enemies.live.length; i++) {
      const e = enemies.live[i];
      if (!e.alive) continue;
      if (e.kind === "quiz") {
        drawQuizMark(e);
        continue;
      }
      if (e.kind === "asteroid") {
        drawAsteroid(e);
        continue;
      }
      const th = themeOf();
      let img = sprites[e.kind];
      if (e.kind === "boss" && th && sprites[th.art]) img = sprites[th.art];
      else if (e.kind !== "boss" && th && sprites[th.minionArt]) img = sprites[th.minionArt];
      else if (e.kind === "transport") img = sprites.tank;
      let rot = e.kind === "spinner" ? e.ang : 0;
      if (e.kind === "boss" && e.bossName === "버디요정") rot = Math.sin(e.age * 4.2) * 0.28;
      ctx.save();
      if (e.kind === "boss" && e.assassin) ctx.filter = "hue-rotate(-25deg) saturate(1.7)";
      if (e.bounty) ctx.filter = "sepia(1) saturate(4) hue-rotate(8deg) brightness(1.25)";
      if (e.flash > 0) ctx.globalCompositeOperation = "lighter";
      drawSprite(img, e.x, e.y, e.w, e.h, rot, 0);
      ctx.restore();
      if (e.bounty) {
        ctx.save();
        ctx.font = '700 9px "Segoe UI", "Malgun Gothic", sans-serif';
        ctx.fillStyle = "#ffd45a";
        ctx.textAlign = "center";
        ctx.fillText("BOUNTY", e.x, e.y - e.h * 0.55);
        ctx.restore();
      }
    }

    for (let i = 0; i < pBullets.live.length; i++) {
      const b = pBullets.live[i];
      if (!b.alive) continue;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.translate(b.x, b.y);
      const col = b.hue || "#4df0ff";
      const grd = ctx.createLinearGradient(0, 10, 0, -16);
      grd.addColorStop(0, "rgba(77,240,255,0)");
      grd.addColorStop(0.5, col);
      grd.addColorStop(1, "#fff");
      ctx.fillStyle = grd;
      ctx.fillRect(-(b.w || 3.6) / 2, -(b.h || 14) + 4, b.w || 3.6, b.h || 14);
      ctx.restore();
    }

    for (let i = 0; i < eBullets.live.length; i++) {
      const b = eBullets.live[i];
      if (!b.alive) continue;
      if (b.rice) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.r * 1.6, b.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(0, 0, b.r * 0.55, b.r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        drawGlowBall(b.x, b.y, b.r, b.color);
      }
    }

    for (let i = 0; i < parts.live.length; i++) {
      const p = parts.live[i];
      if (!p.alive) continue;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    for (let i = 0; i < shock.length; i++) {
      const s = shock[i];
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(255,255,255," + Math.max(0, s.life * 2) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (!player.dead) {
      const pw = player.power;
      const info = FORM_INFO[player.form] || FORM_INFO.striker;
      const py = mode === "title" ? player.y + Math.sin(performance.now() / 420) * 7 : player.y;
      const sw = 62 * info.scale;
      const sh = 76 * info.scale;
      if (player.form === "phantom") {
        const t6 = player.trail[6];
        const t12 = player.trail[12];
        ctx.save();
        ctx.globalAlpha = 0.28;
        if (t12) drawSprite(sprites.player, t12.x, t12.y, sw * 0.9, sh * 0.9, player.tilt, 0);
        ctx.globalAlpha = 0.45;
        if (t6) drawSprite(sprites.player, t6.x, t6.y, sw * 0.95, sh * 0.95, player.tilt, 0);
        ctx.restore();
      }
      ctx.save();
      if (player.inv > 0) ctx.globalAlpha = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(performance.now() / 70));
      if (player.phoenixT > 0) {
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(255,180,70," + (0.4 + 0.4 * Math.sin(performance.now() / 50)) + ")";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(player.x, py, 34 + Math.sin(performance.now() / 40) * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (info.hue) ctx.filter = "hue-rotate(" + info.hue + "deg) saturate(1.35)";
      if (player.form === "berserk") ctx.filter = "hue-rotate(-25deg) saturate(1.8) brightness(1.15)";
      if (player.form === "core") ctx.filter = "brightness(1.35) saturate(0.7)";
      if (pw >= 4 || player.form === "core" || player.form === "berserk") {
        const ox = 28 * info.scale;
        const oy = 10;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = player.form === "berserk" ? "#ff6b4a" : "#4df0ff";
        ctx.beginPath();
        ctx.arc(player.x - ox, py + oy, 5, 0, Math.PI * 2);
        ctx.arc(player.x + ox, py + oy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      drawSprite(sprites.player, player.x, py, sw, sh, player.tilt, 0);
      ctx.filter = "none";
      if (player.shield) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(122,240,255," + (0.45 + Math.sin(performance.now() / 120) * 0.25) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(player.x, py, 32 * info.scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      if (player.focus || player.form === "core") {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(player.x, py + 2, player.hitR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#4df0ff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(player.x, py + 2, player.hitR + 2.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }

    if (chain >= 2) {
      $("chain").textContent = "CHAIN " + chain;
      $("chain").classList.add("on");
    } else $("chain").classList.remove("on");

    ctx.textAlign = "center";
    for (let i = 0; i < floats.length; i++) {
      const f = floats[i];
      ctx.globalAlpha = Math.max(0, f.life / (f.max || 0.7));
      ctx.fillStyle = f.color;
      if (f.big) {
        ctx.font = '800 26px "Segoe UI", "Malgun Gothic", sans-serif';
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillText(f.text, f.x, f.y);
      } else {
        ctx.font = '700 11px "Segoe UI", "Malgun Gothic", sans-serif';
        ctx.fillText(f.text, f.x, f.y);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    drawQuizVerdict();

    if (field.emp) {
      ctx.fillStyle = "rgba(20, 8, 40," + (0.22 + 0.08 * Math.sin(performance.now() / 70)) + ")";
      ctx.fillRect(0, 0, W, H);
    }
    if (field.surge) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "rgba(255, 61, 154, 0.06)";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (flash > 0) {
      const fc = flashCol || [255, 255, 255];
      ctx.fillStyle = "rgba(" + fc[0] + "," + fc[1] + "," + fc[2] + "," + (flash * 0.5) + ")";
      ctx.fillRect(0, 0, W, H);
    }

    const boss = liveBoss();
    if (boss) {
      const pct = clamp(boss.hp / boss.maxHp, 0, 1);
      $("bossfill").style.transform = "scaleX(" + pct + ")";
      $("bossbar").classList.add("on");
      const bn = $("bossName");
      if (bn && boss.bossName) bn.textContent = boss.bossName;
    } else if (stageClearT <= 0) {
      $("bossbar").classList.remove("on");
    }
  }

  function liveBoss() {
    for (let i = 0; i < enemies.live.length; i++) {
      const e = enemies.live[i];
      if (e.alive && e.kind === "boss") return e;
    }
    return null;
  }

  function syncHud() {
    $("score").textContent = pad(score, 7);
    $("hi").textContent = pad(high, 7);
    $("titleHi").textContent = "HI-SCORE " + pad(high, 7);
    const ch = $("chain");
    if (chain >= 2) {
      ch.textContent = "CHAIN " + chain;
      ch.classList.add("on");
    } else ch.classList.remove("on");
    const lives = $("lives").children;
    for (let i = 0; i < lives.length; i++) lives[i].style.visibility = i < player.lives ? "visible" : "hidden";
    const bombs = $("bombs").children;
    for (let i = 0; i < bombs.length; i++) bombs[i].style.visibility = i < player.bombs ? "visible" : "hidden";
    const power = $("power").children;
    for (let i = 0; i < power.length; i++) power[i].className = i <= player.power ? "on" : "";
    const fn = $("formName");
    if (fn) {
      const info = FORM_INFO[player.form] || FORM_INFO.striker;
      fn.textContent = player.formT > 0 ? info.name + " " + Math.ceil(player.formT) : info.name;
    }
  }

  function clearPools() {
    for (const p of [pBullets, eBullets, enemies, pickups, parts]) {
      for (const o of p.live) o.alive = false;
      p.sweep();
    }
    shock.length = 0;
    floats.length = 0;
    gates.length = 0;
  }

  function resetWorld() {
    clearPools();
    score = 0;
    chain = 0;
    chainT = 0;
    clock = 0;
    rank = 0;
    freeze = 0;
    shake = 0;
    flash = 0;
    flashCol = [255, 255, 255];
    timeScale = 1;
    slowRec = 0;
    bombCd = 0;
    fireCd = 0;
    stageClearT = 0;
    scroll = 0;
    chainGateUsed = { 10: false, 25: false, 50: false };
    endFieldEvent();
    shuffleBosses();
    player.x = W / 2;
    player.y = H * 0.78;
    player.lives = 3;
    player.bombs = 3;
    player.power = 0;
    player.shield = false;
    player.inv = 1.6;
    player.dead = false;
    player.tilt = 0;
    player.form = "striker";
    player.formT = 0;
    player.phoenixT = 0;
    player.phoenixUsed = false;
    player.hitR = 4.2;
    player.grazeR = 16;
    player.trail = [];
    player.daze = 0;
    storyT = 0;
    stageBossName = "";
    storyQueue = [];
    quiz = { on: false, phase: "off", t: 0, cd: 6.5, used: [], answer: true, q: "" };
    hideQuizBanner();
    showStory("심사기준 스트라이커", "네이밍 보스를 격파하라", true);
    $("bossbar").classList.remove("on");
    $("toast").classList.remove("show");
    const fn = $("formName");
    if (fn) fn.textContent = "STRIKER";
    buildSchedule(0);
    syncHud();
  }

  function showMenu(which) {
    $("menus").classList.remove("hidden");
    $("scrTitle").hidden = which !== "title";
    $("scrPause").hidden = which !== "pause";
    $("scrOver").hidden = which !== "over";
    $("hud").classList.toggle("on", which === "pause");
    stage.classList.toggle("playing", false);
  }

  function hideMenus() {
    $("menus").classList.add("hidden");
    $("hud").classList.add("on");
    stage.classList.add("playing");
  }

  function startRun() {
    SFX.boot();
    SFX.ui();
    SFX.startMusic();
    resetWorld();
    mode = "play";
    hideMenus();
  }

  function pause() {
    if (mode !== "play") return;
    mode = "pause";
    showMenu("pause");
  }

  function resume() {
    if (mode !== "pause") return;
    mode = "play";
    hideMenus();
  }

  function toTitle() {
    mode = "title";
    SFX.stopMusic();
    clearPools();
    player.dead = false;
    player.x = W / 2;
    player.y = H * 0.78;
    showMenu("title");
    $("hud").classList.remove("on");
    $("bossbar").classList.remove("on");
    endFieldEvent();
    stageBossName = "";
    renderCollection();
    syncHud();
  }

  function gameOver() {
    mode = "over";
    SFX.stopMusic();
    $("overScore").textContent = "SCORE " + pad(score, 7) + "   HI " + pad(high, 7);
    showMenu("over");
  }

  function loop(ts) {
    if (document.hidden) {
      last = 0;
      acc = 0;
      requestAnimationFrame(loop);
      return;
    }
    if (!last) last = ts;
    let dt = (ts - last) / 1000;
    last = ts;
    if (dt > 0.05) dt = 0.05;
    if (mode === "play") {
      acc += dt;
      while (acc >= STEP) {
        update(STEP);
        acc -= STEP;
      }
    } else acc = 0;
    render();
    if (mode === "title") {
      scroll += 18 * dt;
      updateStars(dt);
    }
    SFX.tickMusic(dt);
    requestAnimationFrame(loop);
  }

  function bindInput() {
    window.addEventListener("keydown", (e) => {
      SFX.boot();
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      keys.add(e.code);
      if (e.code === "KeyM") {
        const m = SFX.toggleMute();
        $("btnMute").textContent = m ? "SOUND OFF" : "SOUND ON";
      }
      if (e.code === "Enter") {
        if (mode === "title") startRun();
        else if (mode === "over") startRun();
        else if (mode === "pause") resume();
      }
      if (e.code === "Escape" || e.code === "KeyP") {
        if (mode === "play") pause();
        else if (mode === "pause") resume();
      }
      if (e.code === "KeyX" || e.code === "KeyZ" || e.code === "Space" || e.code === "KeyB") wantBomb = 0.12;
    });
    window.addEventListener("keyup", (e) => keys.delete(e.code));

    canvas.addEventListener("pointerdown", (e) => {
      SFX.boot();
      const p = pointerToGame(e);
      mouse.x = p.x;
      mouse.y = p.y;
      mouse.on = true;
      mouse.down = true;
      if (e.button === 2) wantBomb = 0.12;
      if (mode === "title") startRun();
    });
    canvas.addEventListener("pointermove", (e) => {
      const p = pointerToGame(e);
      mouse.x = p.x;
      mouse.y = p.y;
      mouse.on = true;
    });
    canvas.addEventListener("pointerup", () => { mouse.down = false; });
    canvas.addEventListener("pointerleave", () => { mouse.on = false; });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length >= 2) wantBomb = 0.12;
    }, { passive: true });

    $("btnStart").onclick = startRun;
    $("btnResume").onclick = resume;
    $("btnQuit").onclick = toTitle;
    $("btnRetry").onclick = startRun;
    $("btnTitle").onclick = toTitle;
    $("btnMute").onclick = () => {
      SFX.boot();
      const m = SFX.toggleMute();
      $("btnMute").textContent = m ? "SOUND OFF" : "SOUND ON";
    };
  }

  async function init() {
    resize();
    window.addEventListener("resize", resize);
    stars = Array.from({ length: 70 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      z: Math.random(),
      s: Math.random() < 0.8 ? 1 : 2,
    }));
    const names = ["player", "wasp", "crab", "tank", "spinner", "boss", "bomb", "gem", "shield", "nebula"];
    if (typeof BOSS_THEMES !== "undefined") {
      Object.keys(BOSS_THEMES).forEach((k) => {
        const th = BOSS_THEMES[k];
        if (th.art) names.push(th.art);
        if (th.minionArt) names.push(th.minionArt);
      });
    }
    await Promise.all(names.map(async (n) => {
      try { sprites[n] = await loadSprite(n); }
      catch (err) { console.warn("sprite skip", n); }
    }));
    ready = true;
    bindInput();
    renderCollection();
    showStory("심사기준 스트라이커", "정답 글자를 먹어라", true);
    syncHud();
    showMenu("title");
    requestAnimationFrame(loop);
    if (new URLSearchParams(location.search).get("play") === "1") startRun();
  }

  init().catch((err) => {
    console.error(err);
    $("toast").textContent = "LOAD FAIL";
    $("toast").classList.add("show");
  });
})();
 
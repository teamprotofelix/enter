(() => {
  "use strict";

  const W = 960;
  const H = 540;
  const GROUND = 468;
  const STEP = 1 / 120;
  const COL_KEY = "battlechamp_col";
  const MEDAL_KEY = "battlechamp_medals";
  const TTS_KEY = "battlechamp_tts";
  const HITS = ["퍽!", "딱!", "콰앙!", "시원!", "묵직!", "짱!", "깔끔!", "굿!"];
  const HITS_OK = ["시원하다!", "스트레스 OUT", "속이 뚫린다", "한 방!"];

  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const stage = document.getElementById("stage");
  const $ = (id) => document.getElementById(id);

  const sprites = {};
  const mouse = { x: W * 0.28, y: H * 0.7, on: false, vx: 0, vy: 0 };
  const swipeBuf = [];
  let wantPunch = 0;
  let wantKick = 0;

  let viewScale = 1;
  let drawScale = 1;
  let mode = "title";
  let acc = 0;
  let last = 0;
  let freeze = 0;
  let shake = 0;
  let flash = 0;
  let clock = 0;
  let timeScale = 1;
  let banner = { text: "", t: 0, sub: "" };
  let ready = false;

  let playerName = "";
  let foeName = "";
  let queue = [];
  let roundI = 0;
  let pF = null;
  let eF = null;
  let extras = [];
  let raidN = 0;
  let fightClock = 0;
  let vsT = 0;
  let koT = 0;
  let koWinner = null;
  let pausedFrom = "fight";
  let currentColName = "";

  const parts = [];
  const shocks = [];
  const floats = [];
  const projs = [];
  const afters = [];
  const stars = [];

  const cam = { x: 0, y: 0, z: 1 };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function hexRgb(hex) {
    const h = (hex || "#ffffff").replace("#", "");
    const n = parseInt(h.length === 3 ? h[0]+h[0]+h[1]+h[1]+h[2]+h[2] : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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

  function loadImg(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function resize() {
    const app = ($("playwrap") || $("app")).getBoundingClientRect();
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

  function noteMouse(x, y) {
    const t = performance.now();
    swipeBuf.push({ x: x, y: y, t: t });
    const cut = t - 110;
    while (swipeBuf.length && swipeBuf[0].t < cut) swipeBuf.shift();
    if (swipeBuf.length >= 2) {
      const a = swipeBuf[0];
      const b = swipeBuf[swipeBuf.length - 1];
      const dt = Math.max(16, b.t - a.t);
      mouse.vx = (b.x - a.x) / dt * 1000;
      mouse.vy = (b.y - a.y) / dt * 1000;
    }
    mouse.x = x;
    mouse.y = y;
  }

  function diff() {
    const n = Math.max(1, CHAR_NAMES.length - 2);
    return clamp(roundI / n, 0, 1);
  }

  function emit(x, y, n, o) {
    o = o || {};
    n = Math.min(n, 48);
    for (let i = 0; i < n; i++) {
      const a = o.a != null ? o.a + (Math.random() - 0.5) * (o.spread || 1.2) : Math.random() * Math.PI * 2;
      const s = rand(o.smin || 40, o.smax || 220);
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * s + (o.vx || 0),
        vy: Math.sin(a) * s + (o.vy || 0),
        life: o.life || 0.4,
        max: o.life || 0.4,
        r: o.r || rand(2, 5.5),
        color: o.color || "#fff",
        drag: o.drag || 2.2,
        g: o.g || 0,
      });
      if (parts.length > 420) parts.shift();
    }
  }

  function shock(x, y, color, max) {
    shocks.push({ x, y, r: 6, max: max || 70, life: 0.22, color: color || "#fff" });
    if (shocks.length > 24) shocks.shift();
  }

  function floatText(x, y, text, color, extra) {
    extra = extra || {};
    if (floats.length > 40) floats.shift();
    const life = extra.life || 0.7;
    floats.push({
      x, y, text, color: color || "#fff",
      life, max: life, big: !!extra.big,
      vy: extra.vy != null ? extra.vy : -70,
    });
  }

  function showBanner(text, sub, dur) {
    banner.text = text;
    banner.sub = sub || "";
    banner.t = dur == null ? 1.1 : dur;
  }

  function loadCol() {
    try {
      return JSON.parse(storageGet(COL_KEY, "{}") || "{}");
    } catch (err) { return {}; }
  }
  function saveCol(c) { storageSet(COL_KEY, JSON.stringify(c)); }
  function loadMedals() {
    const n = Number(storageGet(MEDAL_KEY, "0") || 0);
    return n > 0 ? n : 0;
  }
  function medalTiers(n) {
    let bronze = n, silver = 0, gold = 0, plat = 0;
    while (bronze >= 5) { bronze -= 5; silver++; }
    while (silver >= 5) { silver -= 5; gold++; }
    while (gold >= 5) { gold -= 5; plat++; }
    return { plat, gold, silver, bronze };
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
    CHAR_NAMES.forEach((name) => {
      const th = charOf(name);
      const li = document.createElement("li");
      if (col[name]) { li.className = "got"; n++; }
      if (name === currentColName) li.classList.add("current");
      const img = document.createElement("img");
      img.alt = "";
      const spr = sprites[th.art];
      if (spr) img.src = spr.src;
      const b = document.createElement("b");
      b.textContent = name;
      const em = document.createElement("em");
      em.textContent = th.title;
      b.appendChild(em);
      li.appendChild(img);
      li.appendChild(b);
      list.appendChild(li);
    });
    if (count) count.textContent = n + " / " + CHAR_NAMES.length;
    renderMedals();
  }

  function collectBoss(name) {
    if (!name) return false;
    const col = loadCol();
    if (col[name]) {
      renderCollection();
      return false;
    }
    col[name] = true;
    const got = CHAR_NAMES.filter((k) => col[k]).length;
    if (got >= CHAR_NAMES.length) {
      storageSet(MEDAL_KEY, String(loadMedals() + 1));
      saveCol({});
      renderCollection();
      showBanner("훈장 획득", "컬렉션이 다시 열린다", 2.2);
      if (typeof SFX !== "undefined") SFX.medal();
      return true;
    }
    saveCol(col);
    renderCollection();
    return false;
  }

  const PAD = 58;
  const YMIN = 78;
  const YMAX = 500;

  function makeFighter(name, x, facing) {
    const def = charOf(name);
    return {
      name, def, x, y: H * 0.55, vx: 0, vy: 0,
      facing, hp: def.hp, maxHp: def.hp,
      state: "idle", stateT: 0, atk: null, slot: "",
      hitDone: false, hitsLeft: 0, hitClock: 0, activeT: 0,
      inv: 0, flash: 0, tilt: 0, squash: 1, stretch: 1,
      combo: 0, comboT: 0, slowT: 0,
      bubble: "", bubbleT: 0, sayCd: 0,
      stress: 100, burstT: 0,
      scale: def.scale || 1,
      aiT: 0.5 + Math.random() * 0.5,
      aiStrafe: Math.random() < 0.5 ? 1 : -1,
      aimX: facing, aimY: 0, zone: "mid",
      spd: 0, lastX: x, lastY: H * 0.55,
    };
  }

  function say(f, text, dur) {
    if (!f || !text) return;
    f.bubble = text;
    f.bubbleT = dur == null ? 1.55 : dur;
  }

  function livingFoes() {
    const list = [];
    if (eF && eF.hp > 0 && eF.state !== "ko") list.push(eF);
    for (let i = 0; i < extras.length; i++) {
      const f = extras[i];
      if (f && f.hp > 0 && f.state !== "ko") list.push(f);
    }
    return list;
  }

  function allActors() {
    const list = [];
    if (pF) list.push(pF);
    if (eF) list.push(eF);
    for (let i = 0; i < extras.length; i++) if (extras[i]) list.push(extras[i]);
    return list;
  }

  function nearestFoe(from) {
    const list = livingFoes();
    if (!list.length) return eF;
    let best = list[0], bd = 1e9;
    for (let i = 0; i < list.length; i++) {
      const d = Math.hypot(list[i].x - from.x, list[i].y - from.y);
      if (d < bd) { bd = d; best = list[i]; }
    }
    return best;
  }

  function otherOf(f) {
    if (f === pF) return nearestFoe(f);
    return pF;
  }

  function canAct(f) {
    return f && f.state !== "hurt" && f.state !== "ko" && f.state !== "win" &&
      f.state !== "dash" && f.state !== "spin" && f.state !== "burst" &&
      f.state !== "punch" && f.state !== "kick" && f.state !== "special";
  }

  function busyAtk(f) {
    return f.state === "punch" || f.state === "kick" || f.state === "dash" ||
      f.state === "spin" || f.state === "burst" || f.state === "special";
  }

  function aimVec(f) {
    const o = otherOf(f);
    if (!o) return { ang: f.facing > 0 ? 0 : Math.PI, dx: f.facing, dy: 0, zone: "mid" };
    let dx = o.x - f.x, dy = o.y - f.y;
    const len = Math.hypot(dx, dy) || 1;
    return { ang: Math.atan2(dy, dx), dx: dx / len, dy: dy / len, zone: "mid" };
  }

  function swipeAim(f) {
    const o = aimVec(f);
    if (f !== pF) {
      const foe = otherOf(f);
      if (foe) {
        if (foe.y > f.y + 48) return { ang: Math.atan2(0.9, 0.2 * f.facing), dx: 0.22 * f.facing, dy: 0.97, zone: "down" };
        if (foe.y < f.y - 48) return { ang: Math.atan2(-0.9, 0.2 * f.facing), dx: 0.22 * f.facing, dy: -0.97, zone: "up" };
      }
      return o;
    }
    const mag = Math.hypot(mouse.vx, mouse.vy);
    if (mag < 280) return o;
    const sx = mouse.vx / mag;
    const sy = mouse.vy / mag;
    if (sy > 0.5) return { ang: Math.atan2(0.92, 0.18 * f.facing), dx: 0.2 * f.facing, dy: 0.98, zone: "down" };
    if (sy < -0.5) return { ang: Math.atan2(-0.92, 0.18 * f.facing), dx: 0.2 * f.facing, dy: -0.98, zone: "up" };
    if (sx * f.facing > 0.4) return { ang: Math.atan2(sy * 0.25, f.facing), dx: f.facing, dy: sy * 0.3, zone: "fwd" };
    if (sx * f.facing < -0.4) return { ang: Math.atan2(sy * 0.2, -f.facing), dx: -f.facing, dy: sy * 0.25, zone: "back" };
    return { ang: Math.atan2(sy * 0.35 + o.dy * 0.65, sx), dx: sx, dy: sy * 0.45 + o.dy * 0.55, zone: "side" };
  }

  function startAtk(f, slot) {
    if (!f || f.state === "ko" || f.state === "win" || f.state === "hurt") return false;
    if (busyAtk(f) && !(f.hitDone && (f.state === "punch" || f.state === "kick"))) return false;

    let used = f.def[slot];
    let visual = slot;
    if (f.burstT > 0 && slot !== "special") {
      used = f.def.special;
      visual = "special";
    }
    if (!used) return false;

    const a = swipeAim(f);
    f.aimX = a.dx;
    f.aimY = a.dy;
    f.zone = a.zone || "mid";
    if (f.zone === "down") {
      used = Object.assign({}, used, { dmg: (used.dmg || 8) + 2, smash: 1 });
      f.squash = 1.22;
      f.stretch = 0.82;
    } else if (f.zone === "up") {
      used = Object.assign({}, used, { dmg: (used.dmg || 8) + 1 });
      f.vy -= 160;
      f.squash = 0.82;
      f.stretch = 1.22;
    } else if (f.zone === "fwd") {
      used = Object.assign({}, used, { dmg: (used.dmg || 8) + 1 });
      f.vx += f.facing * 220;
    } else if (f.zone === "back") {
      f.vx -= f.facing * 240;
      f.inv = Math.max(f.inv, 0.12);
    }
    f.atk = used;
    f.slot = visual;
    f.hitDone = false;
    f.hitsLeft = used.hits || 1;
    f.hitClock = 0;
    f.activeT = used.startup || 0.08;
    f.fired = false;
    if (f.zone === "mid" || f.zone === "side" || f.zone === "fwd" || f.zone === "back") {
      f.squash = 0.86;
      f.stretch = 1.14;
    }

    const rec = (used.recover || 0.22) + 0.12;
    if (used.type === "dash") {
      f.state = "dash";
      f.stateT = 0.28 + (used.recover || 0.2);
      f.vx = a.dx * (used.speed || 640);
      f.vy = a.dy * (used.speed || 640);
      f.inv = 0.12;
      if (typeof SFX !== "undefined") SFX.dash();
    } else if (used.type === "spin") {
      f.state = "spin";
      f.stateT = 0.18 + rec;
      f.hitClock = used.startup || 0.06;
    } else if (used.type === "burst") {
      f.state = "burst";
      f.stateT = rec + 0.18;
    } else if (used.type === "blink") {
      f.state = "special";
      f.stateT = rec + 0.16;
    } else if (used.type === "grab") {
      f.state = "special";
      f.stateT = rec + 0.16;
    } else {
      f.state = visual === "special" ? "special" : visual;
      f.stateT = rec + (used.startup || 0.08);
    }

    if (visual === "kick") { if (typeof SFX !== "undefined") SFX.kickSwing(); }
    else if (visual === "special") { if (typeof SFX !== "undefined") SFX.special(); }
    else if (typeof SFX !== "undefined") SFX.punchSwing();
    if (typeof SFX !== "undefined") SFX.grunt(f.name, visual === "special" ? "hit" : "atk");

    if (f.zone === "down") floatText(f.x, f.y + 36, "그라운드", used.color || "#ffd45a", { life: 0.45 });
    else if (f.zone === "up") floatText(f.x, f.y - 56, "공중", used.color || "#b8e0ff", { life: 0.45 });
    else if (f.zone === "fwd") floatText(f.x + f.facing * 40, f.y - 40, "전진", used.color || "#ffe08a", { life: 0.4 });
    else if (f.zone === "back") floatText(f.x - f.facing * 40, f.y - 40, "후퇴", used.color || "#c8b8ff", { life: 0.4 });

    if (visual === "special") {
      say(f, used.name, 1.0);
      floatText(f.x, f.y - 70, used.name, used.color || "#ffd45a", { big: true, life: 0.8 });
      shock(f.x, f.y, used.color || "#ffd45a", 90);
      emit(f.x, f.y, 22, { color: used.color || "#ffd45a", smin: 80, smax: 340, life: 0.45 });
      if (typeof SFX !== "undefined") SFX.talk(f.name, used.name, "atk");
    } else if (Math.random() < 0.4 && f.sayCd <= 0) {
      const line = pick(f.def.atk);
      say(f, line);
      f.sayCd = 1.2;
      if (typeof SFX !== "undefined") SFX.talk(f.name, line, "atk");
    }
    return true;
  }

  function spawnShot(f, s, i, n, angOff) {
    const a = (f.aimX != null) ? { ang: Math.atan2(f.aimY, f.aimX) } : aimVec(f);
    let ang = a.ang + (angOff || 0);
    if (n > 1 && !angOff) ang += (i - (n - 1) / 2) * 0.18;
    const spd = (s.speed || 420) * (1 - i * 0.05);
    if (typeof SFX !== "undefined" && i === 0) SFX.shot();
    const p = {
      x: f.x + Math.cos(ang) * 36,
      y: f.y + Math.sin(ang) * 36,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      r: s.r || 12, dmg: s.dmg, owner: f,
      color: s.color || "#fff",
      life: s.linger || 1.7, bounce: s.bounce || 0,
      curve: s.curve || 0, stun: s.stun || 0, slow: s.slow || 0,
      home: s.home || 0, shape: s.shape || "ball",
      age: 0, g: s.arc || 0, delay: i * 0.07,
    };
    projs.push(p);
  }

  function spawnOrbit(f, s) {
    const n = s.shots || 3;
    for (let i = 0; i < n; i++) {
      projs.push({
        x: f.x, y: f.y, vx: 0, vy: 0,
        r: 11, dmg: s.dmg, owner: f,
        color: s.color, life: 1.8, bounce: 0,
        curve: 0, stun: 0, slow: 0, home: 0,
        shape: s.shape || "star", age: 0, g: 0, delay: 0,
        orbit: 1, oang: (Math.PI * 2 * i) / n, orad: 70, ospin: 4.2, origin: f,
      });
    }
  }

  function triggerMove(f) {
    const s = f.atk;
    if (!s) return;
    const a = aimVec(f);
    f.aimX = a.dx;
    f.aimY = a.dy;
    if (s.type === "shot") {
      const n = s.shots || 1;
      for (let i = 0; i < n; i++) spawnShot(f, s, i, n, 0);
    } else if (s.type === "spray") {
      const n = s.shots || 4;
      for (let i = 0; i < n; i++) spawnShot(f, s, i, n, (i - (n - 1) / 2) * 0.28);
    } else if (s.type === "orbit") {
      spawnOrbit(f, s);
    } else if (s.type === "burst") {
      aoeHit(f, s);
      if (s.heal) {
        f.hp = Math.min(f.maxHp, f.hp + s.heal);
        floatText(f.x, f.y - 56, "밥 보너스 +" + s.heal, "#b8ffd4", { life: 0.9 });
      }
    } else if (s.type === "grab") {
      const vic = otherOf(f);
      if (vic && Math.hypot(vic.x - f.x, vic.y - f.y) < (s.range || 190)) {
        vic.x = f.x + a.dx * 50;
        vic.y = f.y + a.dy * 50;
        landHit(f, vic, "special", s.dmg, 320, 0);
      } else {
        emit(f.x + a.dx * 70, f.y + a.dy * 70, 14, { color: s.color, smin: 40, smax: 160 });
      }
    } else if (s.type === "blink") {
      const vic = otherOf(f);
      if (vic) {
        f.x = clamp(vic.x - a.dx * 54, PAD, W - PAD);
        f.y = clamp(vic.y - a.dy * 54, YMIN, YMAX);
        f.inv = 0.18;
        emit(f.x, f.y, 18, { color: s.color, smin: 60, smax: 240 });
        landHit(f, vic, "special", s.dmg, 280, 0);
      }
    } else if (s.type === "melee") {
      tryMeleeOnce(f, s);
    }
  }

  function aoeHit(f, s) {
    shock(f.x, f.y, s.color, s.range || 160);
    emit(f.x, f.y, 28, { color: s.color, smin: 80, smax: 340, life: 0.45 });
    const vic = otherOf(f);
    if (!vic) return;
    if (Math.hypot(vic.x - f.x, vic.y - f.y) < (s.range || 160) + 24) {
      landHit(f, vic, "special", s.dmg, 300, s.stun || 0);
      if (s.slow) vic.slowT = Math.max(vic.slowT, s.slow);
    }
  }

  function bodyBox(f) {
    const s = 36 * (f.scale || 1);
    return { x: f.x - s, y: f.y - s, w: s * 2, h: s * 2 };
  }

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function landHit(att, vic, kind, dmg, kb, extraStun) {
    if (!vic || vic.state === "ko" || vic.inv > 0) return;
    if (att.burstT > 0) dmg = Math.round(dmg * 1.45);
    if (att !== pF) dmg = Math.round(dmg * (1 + diff() * 0.38) * (att && att.raid ? 0.72 : 1));

    vic.hp = Math.max(0, vic.hp - dmg);
    vic.state = "hurt";
    const stun = (kind === "kick" ? 0.22 : kind === "special" ? 0.28 : 0.16) + (extraStun || 0);
    vic.stateT = stun;
    vic.inv = Math.max(vic.inv, stun * 0.7);
    vic.flash = 0.22;
    const ax = att.aimX || att.facing;
    const ay = att.aimY || 0;
    const push = kb || 220;
    vic.vx = ax * push;
    vic.vy = ay * push;
    if (att.zone === "down") {
      vic.vy = Math.max(220, Math.abs(push) * 0.9);
      vic.vx *= 0.45;
    } else if (att.zone === "up") {
      vic.vy = -Math.max(280, Math.abs(push) * 0.85);
    }
    vic.tilt = -ax * 0.35;
    vic.squash = 1.16;
    vic.stretch = 0.82;
    vic.combo = 0;

    att.combo += 1;
    att.comboT = 1.6;
    att.hitDone = true;

    const impactX = (att.x + vic.x) / 2;
    const impactY = (att.y + vic.y) / 2;
    const col = att.def.color;
    emit(impactX, impactY, 18 + Math.min(att.combo * 2, 16), {
      color: col, smin: 90, smax: 320, life: 0.34, vx: (att.aimX || att.facing) * 50,
    });
    shock(impactX, impactY, col, 52 + att.combo * 6);

    const word = att.combo >= 4 ? pick(HITS_OK) : pick(HITS);
    floatText(impactX, impactY - 18, word, att.combo >= 4 ? "#ffd45a" : "#fff", {
      big: att.combo >= 3, life: 0.55,
    });
    floatText(impactX + 18, impactY + 10, String(dmg), col, { life: 0.5 });
    if (att.combo >= 2) {
      floatText(W / 2, 118, att.combo + " COMBO", "#ffd45a", { big: true, life: 0.45, vy: -20 });
    }

    freeze = kind === "special" ? 0.07 : kind === "kick" ? 0.05 : 0.035;
    if (att.combo >= 5) freeze += 0.02;
    shake = Math.min(14, (kind === "kick" ? 8 : 5) + att.combo * 0.7);
    flash = 0;
    cam.z = kind === "special" ? 1.04 : 1.02;

    if (att === pF) {
      att.stress = Math.max(0, att.stress - (5 + att.combo * 1.1));
      if (att.stress <= 0 && att.burstT <= 0) {
        att.burstT = 4.2;
        att.stress = 0;
        showBanner("스트레스 해소!", "전부 쏟아낸다", 1.3);
        if (typeof SFX !== "undefined") SFX.burst();
        emit(att.x, att.y - 80, 40, { color: "#ffd45a", smin: 80, smax: 420, life: 0.6 });
      }
    } else if (vic === pF) {
      vic.stress = Math.min(100, vic.stress + 8);
    }

    if (kind === "special") {
      if (typeof SFX !== "undefined") SFX.superHit();
    } else if (kind === "kick") {
      if (typeof SFX !== "undefined") SFX.kickHit(att.combo);
    } else if (typeof SFX !== "undefined") SFX.punchHit(att.combo);

    if (typeof SFX !== "undefined") {
      SFX.grunt(vic.name, "hurt");
      SFX.talk(vic.name, pick(vic.def.hurt), "hurt");
      if (att.combo === 1 || att.combo === 3 || att.combo === 6) {
        SFX.grunt(att.name, "hit");
        if (att.combo >= 3) SFX.talk(att.name, pick(att.def.atk), "hit");
      }
    }

    if (vic.sayCd <= 0) {
      say(vic, pick(vic.def.hurt));
      vic.sayCd = 0.9;
    }

    if (vic.hp <= 0) beginKo(att, vic);
  }

  function tryMeleeOnce(f, s) {
    const vic = otherOf(f);
    if (!vic || f.hitDone) return;
    const range = s.range || 100;
    const dx = vic.x - f.x, dy = vic.y - f.y;
    const dist = Math.hypot(dx, dy);
    const a = aimVec(f);
    const along = dx * a.dx + dy * a.dy;
    const side = Math.abs(dx * -a.dy + dy * a.dx);
    if (dist < range + 28 && along > -10 && side < 54 + (s.arc || 0) * 30) {
      const kind = f.slot === "kick" ? "kick" : f.slot === "special" ? "special" : "punch";
      landHit(f, vic, kind, s.dmg, 200 + (s.smash ? 80 : 0), s.stun || 0);
    }
  }

  function tryMelee(f, dt) {
    const vic = otherOf(f);
    if (!vic || !f.atk) return;
    const s = f.atk;

    if (!f.fired && f.activeT <= 0 && s.type !== "dash" && s.type !== "spin") {
      f.fired = true;
      triggerMove(f);
    }

    if (f.state === "dash") {
      if (Math.hypot(vic.x - f.x, vic.y - f.y) < 58) {
        const kind = f.slot === "special" ? "special" : f.slot === "kick" ? "kick" : "punch";
        landHit(f, vic, kind, s.dmg, 280);
      }
    } else if (f.state === "spin") {
      f.hitClock -= dt;
      if (f.hitClock <= 0 && f.hitsLeft > 0) {
        f.hitClock = 0.09;
        f.hitsLeft--;
        f.hitDone = false;
        if (Math.hypot(vic.x - f.x, vic.y - f.y) < (s.range || 110) + 20) {
          landHit(f, vic, "special", s.dmg, 140);
        }
      }
    } else if (s.type === "melee" && (s.hits || 1) > 1 && f.fired) {
      f.hitClock -= dt;
      if (f.hitClock <= 0 && f.hitsLeft > 1) {
        f.hitClock = 0.08;
        f.hitsLeft--;
        f.hitDone = false;
        tryMeleeOnce(f, s);
      }
    }
  }

  function beginKo(win, lose) {
    if (!lose || lose.state === "ko") return;
    lose.state = "ko";
    lose.stateT = 2.4;
    lose.hp = 0;
    lose.vy = (win && win.aimY || 0) * 220 - 80;
    lose.vx = (win && (win.aimX || win.facing) || 1) * 280;
    lose.tilt = (win && (win.aimX || win.facing) || 1) * 1.15;
    lose.squash = 1.15;
    lose.stretch = 0.8;
    emit(lose.x, lose.y, 28, { color: (win && win.def.color) || "#fff", smin: 80, smax: 360, life: 0.5 });

    if (lose !== pF && lose !== eF) {
      showBanner(lose.name + " 퇴장", "난입자 아웃", 1.15);
      say(lose, lose.def.defeat, 1.4);
      if (typeof SFX !== "undefined") {
        SFX.ko();
        SFX.talk(lose.name, lose.def.defeat, "ko", true);
      }
      return;
    }

    win.state = "win";
    win.stateT = 2.4;
    win.comboT = 2;
    koWinner = win;
    koT = 2.15;
    mode = "ko";
    timeScale = 0.32;
    shake = 10;
    flash = 0;
    showBanner("K.O.", win.name + " 승", 1.8);
    say(win, win.def.win, 2.2);
    say(lose, lose.def.defeat, 2.2);
    if (typeof SFX !== "undefined") {
      SFX.ko();
      SFX.grunt(lose.name, "ko");
      SFX.talk(lose.name, lose.def.defeat, "ko", true);
      setTimeout(() => {
        if (typeof SFX !== "undefined") {
          SFX.grunt(win.name, "hit");
          SFX.talk(win.name, win.def.win, "win", true);
        }
      }, 700);
    }
    emit(lose.x, lose.y - 80, 48, { color: win.def.color, smin: 80, smax: 460, life: 0.7 });
    stage.classList.remove("playing");
  }

  function physics(f, dt) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vx *= Math.pow(0.018, dt);
    f.vy *= Math.pow(0.018, dt);
    f.x = clamp(f.x, PAD, W - PAD);
    f.y = clamp(f.y, YMIN, YMAX);
    const dx = f.x - f.lastX, dy = f.y - f.lastY;
    f.spd = Math.hypot(dx, dy) / Math.max(dt, 0.0001);
    f.mvx = dx / Math.max(dt, 0.0001);
    f.mvy = dy / Math.max(dt, 0.0001);
    f.lastX = f.x;
    f.lastY = f.y;
    f.squash = lerp(f.squash, 1, 1 - Math.pow(0.0008, dt));
    f.stretch = lerp(f.stretch, 1, 1 - Math.pow(0.0008, dt));
    f.tilt = lerp(f.tilt, 0, 1 - Math.pow(0.02, dt));
    f.flash = Math.max(0, f.flash - dt);
    f.inv = Math.max(0, f.inv - dt);
    f.bubbleT = Math.max(0, f.bubbleT - dt);
    f.sayCd = Math.max(0, f.sayCd - dt);
    f.comboT = Math.max(0, f.comboT - dt);
    if (f.comboT <= 0) f.combo = 0;
    f.burstT = Math.max(0, f.burstT - dt);
    f.slowT = Math.max(0, f.slowT - dt);
    if (f.activeT > 0) f.activeT -= dt;
  }

  function tickState(f, dt) {
    if (f.state === "idle" || f.state === "win") return;
    f.stateT -= dt;
    if (f.stateT > 0) return;
    if (f.state === "ko") return;
    f.state = "idle";
    f.atk = null;
    f.hitDone = false;
    f.zone = "mid";
    f.vx *= 0.3;
  }

  function updatePlayer(dt) {
    const f = pF;
    if (!f || f.state === "ko" || f.state === "win") return;
    const o = eF;
    if (o && Math.abs(o.x - f.x) > 8) f.facing = o.x > f.x ? 1 : -1;

    if (f.state !== "dash" && f.state !== "hurt" && f.state !== "ko") {
      const tx = clamp(mouse.x, PAD, W - PAD);
      const ty = clamp(mouse.y, YMIN, YMAX);
      const k = 1 - Math.pow(0.00008, dt);
      f.x = lerp(f.x, tx, k);
      f.y = lerp(f.y, ty, k);
    }
    if (wantPunch) { wantPunch = 0; startAtk(f, "punch"); }
    if (wantKick) { wantKick = 0; startAtk(f, "kick"); }
  }

  function updateAi(dt) {
    livingFoes().forEach((en) => updateAiOne(en, dt));
  }

  function updateAiOne(f, dt) {
    const p = pF;
    if (!f || !p || f.state === "ko" || f.state === "win" || f.state === "hurt") return;
    if (Math.abs(p.x - f.x) > 8) f.facing = p.x > f.x ? 1 : -1;

    const dist = Math.hypot(p.x - f.x, p.y - f.y);
    const d = diff();
    const prefer = 170 - d * 30;
    const slow = f.slowT > 0 ? 0.55 : 1;
    const spd = 240 * f.def.speed * (1 + d * 0.4) * slow;

    if (f.state === "idle" || f.state === "punch" || f.state === "kick") {
      let mx = 0, my = 0;
      const ux = (p.x - f.x) / (dist || 1);
      const uy = (p.y - f.y) / (dist || 1);
      if (dist > prefer + 40) { mx = ux; my = uy; }
      else if (dist < 90) { mx = -ux; my = -uy; }
      else {
        mx = -uy * f.aiStrafe;
        my = ux * f.aiStrafe;
      }
      for (let i = 0; i < projs.length; i++) {
        const b = projs[i];
        if (b.owner === f || b.delay > 0) continue;
        const bx = b.x - f.x, by = b.y - f.y;
        if (Math.hypot(bx, by) < 110 + d * 70) {
          mx += -bx * 0.02;
          my += -by * 0.02;
        }
      }
      const mlen = Math.hypot(mx, my) || 1;
      f.x += (mx / mlen) * spd * dt;
      f.y += (my / mlen) * spd * dt;
      f.x = clamp(f.x, PAD, W - PAD);
      f.y = clamp(f.y, YMIN, YMAX);
    }

    if (Math.random() < 0.35 * dt) f.aiStrafe *= -1;

    f.aiT -= dt;
    if (f.aiT > 0) return;
    f.aiT = (0.38 - d * 0.2) + Math.random() * (1.15 - d * 0.55 - f.def.aggro * 0.5);
    if (f.state !== "idle") return;

    if (p.state === "hurt" && dist < 150 + d * 40) {
      startAtk(f, Math.random() < 0.5 ? "kick" : "punch");
      return;
    }
    if (dist < 130 && Math.random() < 0.4 + f.def.aggro * 0.3 + d * 0.15) startAtk(f, "punch");
    else if (dist < 200 && Math.random() < 0.3 + f.def.aggro * 0.25 + d * 0.12) startAtk(f, "kick");
    else if (Math.random() < 0.12 + f.def.aggro * 0.08 + d * 0.16) startAtk(f, "special");
    if (f.sayCd <= 0 && Math.random() < 0.16) {
      say(f, pick(f.def.taunts));
      f.sayCd = 2.2;
    }
  }

  function updateProjs(dt) {
    for (let i = projs.length - 1; i >= 0; i--) {
      const b = projs[i];
      if (b.delay > 0) {
        b.delay -= dt;
        continue;
      }
      b.age += dt;
      b.life -= dt;
      if (b.orbit && b.origin) {
        b.oang += b.ospin * dt;
        b.x = b.origin.x + Math.cos(b.oang) * b.orad;
        b.y = b.origin.y + Math.sin(b.oang) * b.orad;
      } else {
        if (b.curve) {
          const nrmx = -b.vy, nrmy = b.vx;
          const n = Math.hypot(nrmx, nrmy) || 1;
          b.vx += (nrmx / n) * b.curve * 420 * dt;
          b.vy += (nrmy / n) * b.curve * 420 * dt;
        }
        if (b.home) {
          const vic = b.owner === pF ? eF : pF;
          if (vic) {
            const a = Math.atan2(vic.y - b.y, vic.x - b.x);
            const spd = Math.hypot(b.vx, b.vy) || 300;
            b.vx = lerp(b.vx, Math.cos(a) * spd, b.home);
            b.vy = lerp(b.vy, Math.sin(a) * spd, b.home);
          }
        }
        b.vy += (b.g || 0) * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if ((b.age * 28 | 0) !== ((b.age - dt) * 28 | 0)) {
          emit(b.x, b.y, 1, { color: b.color, smin: 8, smax: 36, life: 0.16, r: 2, drag: 4 });
        }
      }
      if (b.x < 4 || b.x > W - 4 || b.y < 4 || b.y > H - 4) {
        if (b.bounce > 0) {
          b.bounce--;
          if (b.x < 4 || b.x > W - 4) b.vx *= -1;
          if (b.y < 4 || b.y > H - 4) b.vy *= -1;
          b.x = clamp(b.x, 6, W - 6);
          b.y = clamp(b.y, 6, H - 6);
        } else b.life = 0;
      }
      const vic = b.owner === pF ? nearestFoe(b) : pF;
      if (vic && vic.state !== "ko" && vic.inv <= 0) {
        const bb = bodyBox(vic);
        if (b.x > bb.x && b.x < bb.x + bb.w && b.y > bb.y && b.y < bb.y + bb.h) {
          const kind = b.owner && b.owner.slot === "kick" ? "kick" : "special";
          landHit(b.owner, vic, kind, b.dmg, 200, b.stun || 0);
          if (b.slow) vic.slowT = Math.max(vic.slowT, b.slow);
          emit(b.x, b.y, 12, { color: b.color, smin: 60, smax: 240 });
          if (!b.orbit) b.life = 0;
        }
      }
      if (b.life <= 0) projs.splice(i, 1);
    }
  }

  function updateFx(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      p.vx *= Math.pow(1 / (1 + p.drag), dt);
      p.vy *= Math.pow(1 / (1 + p.drag), dt);
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
    for (let i = shocks.length - 1; i >= 0; i--) {
      const s = shocks[i];
      s.life -= dt;
      s.r = lerp(s.r, s.max, 1 - Math.pow(0.0002, dt));
      if (s.life <= 0) shocks.splice(i, 1);
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.life -= dt;
      f.y += (f.vy || -70) * dt;
      if (f.life <= 0) floats.splice(i, 1);
    }
    for (let i = afters.length - 1; i >= 0; i--) {
      afters[i].life -= dt;
      if (afters[i].life <= 0) afters.splice(i, 1);
    }
  }

  function maybeAfter(f) {
    /* 이동 잔상은 눈 피로가 커서 쓰지 않는다. */
  }

  function startVs(name) {
    foeName = name;
    currentColName = name;
    pF = makeFighter(playerName, 220, 1);
    eF = makeFighter(foeName, 740, -1);
    extras = [];
    raidN = 0;
    fightClock = 0;
    const d = diff();
    eF.maxHp = Math.round(eF.maxHp * (1 + d * 0.42));
    eF.hp = eF.maxHp;
    parts.length = 0; shocks.length = 0; floats.length = 0; projs.length = 0; afters.length = 0;
    vsT = 2.05;
    mode = "vs";
    timeScale = 1;
    freeze = 0;
    say(pF, pick(pF.def.intro), 2);
    say(eF, pick(eF.def.intro), 2);
    banner.t = 0;
    renderCollection();
    if (typeof SFX !== "undefined") {
      SFX.cancelTalk();
      SFX.ui();
      SFX.talk(pF.name, pF.bubble, "pick", true);
      setTimeout(() => {
        if (eF && typeof SFX !== "undefined") SFX.talk(eF.name, eF.bubble, "pick", true);
      }, 1100);
    }
  }

  function startFight() {
    mode = "fight";
    wantPunch = 0;
    wantKick = 0;
    showBanner("FIGHT!", "위로 끌면 공중 · 아래로 끌면 그라운드", 1.05);
    stage.classList.add("playing");
    if (typeof SFX !== "undefined") SFX.ui();
  }

  function startRun(name) {
    playerName = name;
    collectBoss(name);
    queue = CHAR_NAMES.filter((n) => n !== name);
    for (let i = queue.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const t = queue[i]; queue[i] = queue[j]; queue[j] = t;
    }
    roundI = 0;
    hideMenus();
    startVs(queue[0]);
  }

  function afterKo() {
    const win = koWinner;
    timeScale = 1;
    if (win === pF) {
      const medal = collectBoss(foeName);
      roundI++;
      if (roundI >= queue.length) {
        mode = "champ";
        showScreen("scrChamp");
        $("champLine").textContent = medal
          ? "전부 이겼고, 훈장까지 받았다. 스트레스가 훈장이 됐다."
          : playerName + " 최강. 컬렉션은 옆에서 확인.";
        if (typeof SFX !== "undefined") SFX.win();
        return;
      }
      startVs(queue[roundI]);
    } else {
      mode = "over";
      showScreen("scrOver");
      $("overScore").textContent = foeName + "에게 졌다. 리매치?";
    }
  }

  function showScreen(id) {
    ["scrTitle", "scrPause", "scrOver", "scrChamp"].forEach((k) => {
      const el = $(k);
      if (el) el.hidden = k !== id;
    });
    $("menus").classList.remove("hidden");
    stage.classList.remove("playing");
  }

  function hideMenus() {
    $("menus").classList.add("hidden");
  }

  function raidPool() {
    const used = {};
    used[playerName] = true;
    used[foeName] = true;
    extras.forEach((f) => { if (f) used[f.name] = true; });
    return CHAR_NAMES.filter((n) => !used[n]);
  }

  function spawnRaid() {
    const pool = raidPool();
    if (!pool.length || livingFoes().length >= 3) return;
    const name = pick(pool);
    const side = Math.random() < 0.5 ? 90 : W - 90;
    const f = makeFighter(name, side, side < W / 2 ? 1 : -1);
    f.y = rand(YMIN + 50, YMAX - 40);
    f.maxHp = Math.round(charOf(name).hp * (0.48 + diff() * 0.12));
    f.hp = f.maxHp;
    f.raid = true;
    extras.push(f);
    raidN++;
    const n = livingFoes().length;
    showBanner(name + "가 경기장에 난입!", n + " : 1", 1.85);
    say(f, pick(f.def.taunts), 1.6);
    shock(f.x, f.y, f.def.color, 80);
    emit(f.x, f.y, 24, { color: f.def.color, smin: 70, smax: 280, life: 0.5 });
    if (typeof SFX !== "undefined") {
      SFX.burst();
      SFX.talk(name, name + " 난입!", "pick", true);
    }
  }

  function updateRaid(dt) {
    if (mode !== "fight") return;
    fightClock += dt;
    const cap = diff() > 0.4 ? 2 : 1;
    if (raidN >= cap || livingFoes().length >= 3) return;
    if (fightClock < 10) return;
    if (Math.random() < dt * (0.08 + diff() * 0.16)) spawnRaid();
  }

  function updateFight(dt) {
    updatePlayer(dt);
    updateAi(dt);
    updateRaid(dt);
    allActors().forEach((f) => {
      if (!f) return;
      physics(f, dt);
      tickState(f, dt);
      tryMelee(f, dt);
      maybeAfter(f);
    });
    updateProjs(dt);
    if (pF && pF.burstT <= 0 && pF.stress < 100 && pF.state === "idle") {
      pF.stress = Math.min(100, pF.stress + 2.2 * dt);
    }
  }

  function update(dt) {
    if (typeof SFX !== "undefined") SFX.tick();
    banner.t = Math.max(0, banner.t - dt);
    flash = Math.max(0, flash - dt);
    shake *= Math.pow(0.012, dt);
    cam.z = lerp(cam.z, 1, 1 - Math.pow(0.002, dt));
    cam.x = (Math.random() - 0.5) * shake;
    cam.y = (Math.random() - 0.5) * shake * 0.7;

    const frozen = freeze > 0;
    if (frozen) {
      freeze -= dt;
      updateFx(dt * 0.35);
      return;
    }

    clock += dt;
    const sdt = dt * timeScale;
    updateFx(sdt);

    if (mode === "fight") updateFight(sdt);
    else if (mode === "vs") {
      vsT -= dt;
      allActors().forEach((f) => { physics(f, sdt); tickState(f, sdt); });
      if (vsT <= 0) startFight();
    } else if (mode === "ko") {
      koT -= dt;
      timeScale = lerp(timeScale, 0.22, 0.08);
      allActors().forEach((f) => { physics(f, sdt); tickState(f, sdt); });
      updateProjs(sdt);
      if (koT <= 0) afterKo();
    }
  }

  function drawArena() {
    const foe = eF ? eF.def.color : "#ff3d4a";
    const rgb = hexRgb(foe);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgb(" + (rgb[0] * 0.18 | 0) + "," + (rgb[1] * 0.1 | 0) + "," + (20 + rgb[2] * 0.12 | 0) + ")");
    g.addColorStop(0.55, "#120814");
    g.addColorStop(1, "#1a0c10");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#fff";
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      ctx.globalAlpha = 0.25 + Math.sin(clock * 2 + s.a) * 0.2;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    for (let i = 0; i < 8; i++) {
      const x = 40 + i * 120;
      ctx.fillRect(x, 210, 70, 180);
      ctx.fillRect(x + 16, 180, 24, 40);
    }

    ctx.strokeStyle = "rgba(" + rgb[0] + "," + rgb[1] + "," + rgb[2] + ",0.35)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 250);
    ctx.lineTo(W, 250);
    ctx.stroke();

    const floor = ctx.createLinearGradient(0, GROUND - 40, 0, H);
    floor.addColorStop(0, "#2a1420");
    floor.addColorStop(1, "#0a0408");
    ctx.fillStyle = floor;
    ctx.fillRect(0, GROUND - 8, W, H - (GROUND - 8));

    ctx.strokeStyle = "rgba(255,212,90,0.18)";
    ctx.lineWidth = 1;
    for (let i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 70, GROUND - 8);
      ctx.lineTo(W / 2 + i * 140, H);
      ctx.stroke();
    }
    ctx.strokeStyle = foe;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, GROUND - 8);
    ctx.lineTo(W, GROUND - 8);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const spot = ctx.createRadialGradient(W / 2, 40, 10, W / 2, GROUND, 380);
    spot.addColorStop(0, "rgba(255,240,200,0.16)");
    spot.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, W, H);
  }

  function drawShadow(f) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(f.x, f.y + 48 * (f.scale || 1), 34 * (f.scale || 1), 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function fighterH(f) {
    return 150 * (f.scale || 1);
  }

  function frameOf(f) {
    if (f.state === "ko") return FR.ko;
    if (f.state === "hurt") return FR.hurt;
    if (f.state === "win") return FR.win;
    if (f.state === "special" || f.state === "spin" || f.state === "burst") return FR.special;
    if (f.state === "dash" && f.zone === "up") return FR.fly;
    if (f.state === "punch") {
      if (f.zone === "up") return FR.punchUp;
      if (f.zone === "down") return FR.punchDown;
      if (f.zone === "fwd" || f.zone === "back" || f.zone === "side") return FR.punchSide;
      return FR.punch;
    }
    if (f.state === "kick" || (f.state === "dash" && f.zone === "down")) {
      if (f.zone === "up") return FR.kickUp;
      if (f.zone === "down") return FR.kickDown;
      if (f.zone === "fwd" || f.zone === "back" || f.zone === "side") return FR.kickSide;
      return FR.kick;
    }
    if (f.state === "dash") return FR.special;
    if ((f.mvy || 0) < -80) return FR.fly;
    if ((f.spd || 0) > 90) return FR.move;
    return FR.idle;
  }

  function drawFighterSprite(f, alpha) {
    const sheet = sprites[f.def.sheet];
    const img = sheet || sprites[f.def.art];
    const h = fighterH(f);
    const bob = f.state === "idle" ? Math.sin(clock * 6 + f.x) * 3 : 0;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.translate(f.x, f.y + bob);
    ctx.scale(f.facing * f.stretch, f.squash);
    if (f.state === "spin") ctx.rotate(clock * 18);
    else ctx.rotate(f.tilt);
    const hurtGlow = f.state === "hurt" || f.state === "ko" || f.flash > 0;
    if (f.burstT > 0) {
      ctx.shadowColor = "#ffd45a";
      ctx.shadowBlur = 22;
    } else if (hurtGlow) {
      ctx.shadowColor = "rgba(255, 90, 110, 0.85)";
      ctx.shadowBlur = 16;
    } else if (f.state === "dash" || f.state === "special") {
      ctx.shadowColor = f.def.color;
      ctx.shadowBlur = 16;
    }
    if (sheet) {
      const cw = sheet.width / SHEET_COLS;
      const ch = sheet.height / SHEET_ROWS;
      const fr = frameOf(f);
      const sx = (fr % SHEET_COLS) * cw;
      const sy = (fr / SHEET_COLS | 0) * ch;
      ctx.drawImage(sheet, sx, sy, cw, ch, -h / 2, -h / 2, h, h);
    } else if (img) {
      const ratio = img.width / img.height;
      const dw = h * Math.min(ratio, 1.15);
      ctx.drawImage(img, -dw / 2, -h / 2, dw, h);
    } else {
      ctx.fillStyle = f.def.color;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hurtGlow) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 96, 110, " + Math.min(0.65, 0.28 + (f.flash || 0) * 1.6) + ")";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.ellipse(0, 4, h * 0.34, h * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAtkFx(f) {
    if (f.state !== "punch" && f.state !== "kick") return;
    const punch = f.state === "punch";
    const t = punch ? 0.34 - f.stateT : 0.52 - f.stateT;
    const active = punch ? (t > 0.07 && t < 0.2) : (t > 0.12 && t < 0.28);
    if (!active) return;
    const x = f.x + (f.aimX || f.facing) * (punch ? 52 : 64);
    const y = f.y + (f.aimY || 0) * (punch ? 52 : 64);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(clock * 18);
    ctx.strokeStyle = punch ? "#fff7c8" : f.def.color;
    ctx.lineWidth = punch ? 5 : 7;
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(0, 0, punch ? 22 : 32, 0, 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, punch ? 36 : 48, 0.3, 2.4);
    ctx.stroke();
    ctx.fillStyle = punch ? "rgba(255,255,255,0.35)" : f.def.color;
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.arc(0, 0, punch ? 14 : 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBubble(f) {
    if (f.bubbleT <= 0 || !f.bubble) return;
    const pop = Math.min(1, (1.55 - Math.min(1.55, f.bubbleT)) * 8);
    const fade = Math.min(1, f.bubbleT * 4);
    ctx.save();
    ctx.globalAlpha = fade * Math.min(1, pop);
    ctx.font = "bold 15px Malgun Gothic, Segoe UI, sans-serif";
    const text = f.bubble;
    const w = Math.min(260, ctx.measureText(text).width + 22);
    const x = clamp(f.x - w / 2, 8, W - w - 8);
    const y = f.y - fighterH(f) * 0.55 - 34;
    ctx.fillStyle = "rgba(8,6,14,0.88)";
    ctx.strokeStyle = f.def.color;
    ctx.lineWidth = 2;
    roundRect(x, y, w, 30, 8);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(f.x - 6, y + 30);
    ctx.lineTo(f.x, y + 40);
    ctx.lineTo(f.x + 6, y + 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + 15);
    ctx.restore();
  }

  function drawHp(f, left) {
    const x = left ? 24 : W - 24 - 360;
    const y = 18;
    ctx.save();
    ctx.font = "bold 13px Malgun Gothic, Segoe UI, sans-serif";
    ctx.textAlign = left ? "left" : "right";
    ctx.fillStyle = "#ffd45a";
    ctx.fillText(f.name, left ? x : x + 360, y);
    ctx.font = "11px Malgun Gothic, Segoe UI, sans-serif";
    ctx.fillStyle = "#9ab";
    ctx.fillText(f.def.title, left ? x : x + 360, y + 14);
    const bx = x, by = y + 22, bw = 360, bh = 14;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(bx, by, bw, bh);
    const ratio = clamp(f.hp / f.maxHp, 0, 1);
    const grd = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    if (left) {
      grd.addColorStop(0, "#4df0ff");
      grd.addColorStop(1, "#ffd45a");
    } else {
      grd.addColorStop(0, "#ff3d4a");
      grd.addColorStop(1, "#ff9ad4");
    }
    ctx.fillStyle = grd;
    if (left) ctx.fillRect(bx, by, bw * ratio, bh);
    else ctx.fillRect(bx + bw * (1 - ratio), by, bw * ratio, bh);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.strokeRect(bx, by, bw, bh);
    ctx.restore();
  }

  function drawHud() {
    if (!pF || !eF) return;
    if (mode === "title") return;
    drawHp(pF, true);
    drawHp(eF, false);

    if (mode === "fight" || mode === "ko") {
      const x = W / 2 - 110, y = H - 36, w = 220, h = 10;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(x, y, w, h);
      const r = clamp(pF.stress / 100, 0, 1);
      ctx.fillStyle = pF.burstT > 0 ? "#ffd45a" : "rgb(" + (80 + r * 175 | 0) + "," + (40 + (1 - r) * 160 | 0) + ",70)";
      ctx.fillRect(x, y, w * r, h);
      ctx.strokeStyle = "rgba(255,212,90,0.4)";
      ctx.strokeRect(x, y, w, h);
      ctx.font = "bold 10px Malgun Gothic, Segoe UI, sans-serif";
      ctx.fillStyle = "#ffd45a";
      ctx.textAlign = "center";
      ctx.fillText(pF.burstT > 0 ? "해소 버스트" : "STRESS", W / 2, y - 6);
    }
  }

  function drawBanner() {
    if (banner.t <= 0 || !banner.text) return;
    const a = Math.min(1, banner.t * 4);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "800 64px Malgun Gothic, Segoe UI, sans-serif";
    ctx.shadowColor = "#ff3d4a";
    ctx.shadowBlur = 18;
    ctx.fillText(banner.text, W / 2, H * 0.38);
    if (banner.sub) {
      ctx.shadowBlur = 0;
      ctx.font = "bold 16px Malgun Gothic, Segoe UI, sans-serif";
      ctx.fillStyle = "#ffd45a";
      ctx.fillText(banner.sub, W / 2, H * 0.38 + 36);
    }
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(drawScale, 0, 0, drawScale, 0, 0);
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-W / 2, -H / 2);

    drawArena();

    afters.forEach((a) => {
      const ghost = { x: a.x, y: a.y, facing: a.facing, def: charOf(a.name), name: a.name, scale: 1, state: "move", tilt: 0, squash: 1, stretch: 1, burstT: 0, flash: 0, spd: 200, mvy: 0 };
      drawFighterSprite(ghost, (a.life / a.max) * 0.35);
    });

    const actors = allActors();
    actors.forEach((f) => drawShadow(f));
    const order = actors.slice().sort((a, b) => a.y - b.y);
    order.forEach((f) => {
      drawFighterSprite(f, 1);
      drawAtkFx(f);
      if (f.raid && f.hp > 0 && f.state !== "ko") {
        const w = 46, h = 5;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(f.x - w / 2, f.y - fighterH(f) * 0.52 - 8, w, h);
        ctx.fillStyle = f.def.color;
        ctx.fillRect(f.x - w / 2, f.y - fighterH(f) * 0.52 - 8, w * clamp(f.hp / f.maxHp, 0, 1), h);
      }
    });

    projs.forEach((b) => {
      if (b.delay > 0) return;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.fillStyle = b.color;
      ctx.strokeStyle = "#fff";
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 12;
      const r = b.r;
      if (b.shape === "heart") {
        ctx.beginPath();
        ctx.moveTo(0, r * 0.4);
        ctx.bezierCurveTo(-r, -r * 0.3, -r * 0.5, -r, 0, -r * 0.35);
        ctx.bezierCurveTo(r * 0.5, -r, r, -r * 0.3, 0, r * 0.4);
        ctx.fill();
      } else if (b.shape === "star") {
        ctx.beginPath();
        for (let k = 0; k < 5; k++) {
          const a1 = -Math.PI / 2 + k * Math.PI * 2 / 5;
          const a2 = a1 + Math.PI / 5;
          ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
          ctx.lineTo(Math.cos(a2) * r * 0.4, Math.sin(a2) * r * 0.4);
        }
        ctx.closePath();
        ctx.fill();
      } else if (b.shape === "net" || b.shape === "lure") {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
        ctx.moveTo(0, -r); ctx.lineTo(0, r);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
      ctx.restore();
    });

    shocks.forEach((s) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life / 0.22);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    parts.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    floats.forEach((f) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.life / f.max);
      ctx.fillStyle = f.color;
      ctx.textAlign = "center";
      ctx.font = (f.big ? "800 28px" : "bold 16px") + " Malgun Gothic, Segoe UI, sans-serif";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 6;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });

    allActors().forEach((f) => drawBubble(f));

    ctx.restore();

    drawHud();
    drawBanner();

    if (mode === "vs" && pF && eF) {
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "800 72px Malgun Gothic, Segoe UI, sans-serif";
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "#ff3d4a";
      ctx.shadowBlur = 20;
      ctx.fillText("VS", W / 2, H * 0.28);
      ctx.shadowBlur = 0;
      ctx.font = "bold 16px Malgun Gothic, Segoe UI, sans-serif";
      ctx.fillStyle = "#ffd45a";
      ctx.fillText((roundI + 1) + " / " + (CHAR_NAMES.length - 1) + "  ·  난이도 " + (1 + Math.round(diff() * 9)), W / 2, H * 0.28 + 28);
      ctx.restore();
    }
  }

  function loop(t) {
    if (!ready) return;
    const now = t * 0.001;
    let dt = last ? now - last : 0;
    last = now;
    if (dt > 0.08) dt = 0.08;
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 8) {
      update(STEP);
      acc -= STEP;
      steps++;
    }
    draw();
    requestAnimationFrame(loop);
  }

  function pickLineOf(d) {
    return pick(d.pickMe && d.pickMe.length ? d.pickMe : d.intro);
  }

  function buildSelect() {
    const grid = $("charGrid");
    if (!grid) return;
    grid.innerHTML = "";
    let lastHover = "";
    CHAR_NAMES.forEach((name) => {
      const d = charOf(name);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "char-card";
      b.dataset.name = name;
      if (CHAR_NAMES.indexOf(name) >= 10) b.classList.add("say-down");
      const img = document.createElement("img");
      img.alt = name;
      const spr = sprites[d.art];
      if (spr) img.src = spr.src;
      const nm = document.createElement("div");
      nm.className = "nm";
      nm.textContent = name;
      const tt = document.createElement("div");
      tt.className = "tt";
      tt.textContent = d.title;
      const sayEl = document.createElement("div");
      sayEl.className = "say";
      sayEl.textContent = pickLineOf(d);
      b.appendChild(sayEl);
      b.appendChild(img);
      b.appendChild(nm);
      b.appendChild(tt);
      b.addEventListener("mouseenter", () => {
        if (typeof SFX !== "undefined") {
          SFX.boot();
          if (lastHover !== name) {
            SFX.hover();
            SFX.grunt(name, "atk");
            SFX.talk(name, pickLineOf(d), "pick");
          }
        }
        lastHover = name;
        const line = pickLineOf(d);
        sayEl.textContent = line;
        $("selHint").textContent = line;
      });
      b.addEventListener("click", () => {
        if (typeof SFX !== "undefined") { SFX.boot(); SFX.pick(); SFX.setMusic(true); }
        playerName = name;
        grid.querySelectorAll(".char-card").forEach((c) => c.classList.toggle("on", c === b));
        $("selHint").textContent = name + " · " + d.title + "  —  출전!";
      });
      b.addEventListener("dblclick", () => {
        if (typeof SFX !== "undefined") { SFX.boot(); SFX.ui(); SFX.setMusic(true); }
        playerName = name;
        startRun(playerName);
      });
      grid.appendChild(b);
    });
  }

  function bind() {
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", (e) => {
      const p = pointerToGame(e);
      noteMouse(p.x, p.y);
      mouse.on = true;
    });
    canvas.addEventListener("mouseleave", () => { mouse.on = false; });
    canvas.addEventListener("mousedown", (e) => {
      if (typeof SFX !== "undefined") { SFX.boot(); SFX.setMusic(true); }
      if (mode !== "fight") return;
      if (e.button === 0) wantPunch = 1;
      if (e.button === 2) { wantKick = 1; e.preventDefault(); }
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    stage.addEventListener("contextmenu", (e) => e.preventDefault());

    canvas.addEventListener("touchstart", (e) => {
      e.preventDefault();
      if (typeof SFX !== "undefined") { SFX.boot(); SFX.setMusic(true); }
      const t = e.changedTouches[0];
      const p = pointerToGame(t);
      noteMouse(p.x, p.y);
      if (mode === "fight") {
        if (e.touches.length >= 2) wantKick = 1;
        else wantPunch = 1;
      }
    }, { passive: false });
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const p = pointerToGame(t);
      noteMouse(p.x, p.y);
    }, { passive: false });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Escape" || e.code === "KeyP") {
        if (mode === "fight") {
          pausedFrom = mode;
          mode = "pause";
          showScreen("scrPause");
        } else if (mode === "pause") {
          mode = "fight";
          hideMenus();
          stage.classList.add("playing");
        }
      }
    });

    document.addEventListener("pointerdown", () => {
      if (typeof SFX !== "undefined") { SFX.boot(); SFX.setMusic(true); }
    });
    $("btnFight").addEventListener("click", () => {
      if (!playerName) {
        $("selHint").textContent = "먼저 카드를 골라줘!";
        if (typeof SFX !== "undefined") SFX.ui();
        return;
      }
      if (typeof SFX !== "undefined") { SFX.boot(); SFX.ui(); SFX.setMusic(true); }
      startRun(playerName);
    });
    $("btnMute").addEventListener("click", () => {
      if (typeof SFX === "undefined") return;
      SFX.boot();
      const next = !SFX.isMuted();
      SFX.setMuted(next);
      $("btnMute").textContent = next ? "SOUND OFF" : "SOUND ON";
    });
    function syncTtsBtn() {
      const on = typeof SFX === "undefined" || SFX.isTts();
      const el = $("btnTts");
      if (!el) return;
      el.textContent = on ? "대사 TTS ON" : "대사 TTS OFF";
      el.classList.toggle("off", !on);
    }
    $("btnTts").addEventListener("click", () => {
      if (typeof SFX === "undefined") return;
      SFX.boot();
      const next = !SFX.isTts();
      SFX.setTts(next);
      storageSet(TTS_KEY, next ? "1" : "0");
      syncTtsBtn();
      SFX.ui();
    });
    if (typeof SFX !== "undefined" && storageGet(TTS_KEY, "1") === "0") SFX.setTts(false);
    syncTtsBtn();
    $("btnResume").addEventListener("click", () => {
      mode = "fight";
      hideMenus();
      stage.classList.add("playing");
    });
    $("btnQuit").addEventListener("click", () => {
      mode = "title";
      showScreen("scrTitle");
      buildSelect();
    });
    $("btnRetry").addEventListener("click", () => {
      hideMenus();
      startVs(foeName);
    });
    $("btnTitle").addEventListener("click", () => {
      mode = "title";
      showScreen("scrTitle");
      buildSelect();
    });
    $("btnChamp").addEventListener("click", () => {
      mode = "title";
      showScreen("scrTitle");
      buildSelect();
    });
  }

  async function boot() {
    resize();
    bind();
    const arts = [];
    CHAR_NAMES.forEach((n) => {
      const a = charOf(n).art;
      if (arts.indexOf(a) < 0) arts.push(a);
    });
    await Promise.all(arts.map((a) =>
      loadImg("assets/sprites/" + a + ".png").then((img) => { sprites[a] = img; }).catch(() => {})
    ));
    const sheets = [];
    CHAR_NAMES.forEach((n) => {
      const s = charOf(n).sheet;
      if (s && sheets.indexOf(s) < 0) sheets.push(s);
    });
    await Promise.all(sheets.map((s) =>
      loadImg("assets/sprites/" + s + ".png").then((img) => { sprites[s] = img; }).catch(() => {})
    ));
    buildSelect();
    renderCollection();
    for (let i = 0; i < 55; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * (GROUND - 60), s: Math.random() * 1.7 + 0.4, a: Math.random() * 6 });
    }
    ready = true;
    requestAnimationFrame(loop);
  }

  boot();
})();

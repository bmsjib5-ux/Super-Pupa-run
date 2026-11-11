// Pupa ผู้รอดชีวิต (survivor): the screens. The rules live in
// survivor-engine.js; game.js lends the save, sounds and coins through
// window.PupaGame and keeps its own keys quiet while this is open.
//
// save.survivor = { stars: { stage: best stars }, best: { stage: longest
// seconds }, perks: { blessing: level }, hero: the card id last played }.
(() => {
  "use strict";
  const S = window.PupaSurvivorEngine;
  const screen = document.querySelector("#survivorScreen");
  if (!S || !screen) return;

  const game = () => window.PupaGame;
  const save = () => game().save;
  const tone = (...args) => game()?.tone(...args);
  const announce = (text) => game()?.announce(text);
  const store = () => game().writeSave();
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const calm = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const button = (className, text, handler, label) => {
    const node = el("button", className, text);
    node.type = "button";
    if (label) node.setAttribute("aria-label", label);
    if (handler) game().onTap(node, (event) => { if (!node.disabled) handler(event); });
    return node;
  };
  const starText = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;
  const STAGES = S.STAGES.length;
  const ROLE_ICON = { balance: "⚖️", attack: "⚔️", defense: "🛡️", magic: "🔮", support: "💗" };

  // ---- The save ----
  function progress() {
    const s = save();
    const raw = s.survivor && typeof s.survivor === "object" ? s.survivor : {};
    const map = (o, max, keys) => {
      const out = {};
      for (const k of keys) { const v = Math.min(max, Math.floor(Number(o?.[k]) || 0)); if (v > 0) out[k] = v; }
      return out;
    };
    const stages = Array.from({ length: STAGES }, (_, i) => String(i + 1));
    s.survivor = { stars: map(raw.stars, 3, stages), best: map(raw.best, 3600, stages), perks: map(raw.perks, 5, Object.keys(S.PERKS)), hero: typeof raw.hero === "string" ? raw.hero : "pupa" };
    return s.survivor;
  }
  const record = () => save().survivor;
  const isOpenStage = (n) => n === 1 || (record().stars[n - 1] || 0) >= 2;
  const nextStage = () => { for (let n = 1; n <= STAGES; n++) if ((record().stars[n] || 0) < 2) return isOpenStage(n) ? n : n - 1; return STAGES; };

  // the heroes this player has: Pupa always, and every hero card owned
  function roster() {
    const E = window.PupaCardsEngine, units = save().cards?.units || {};
    const list = [];
    const cards = E?.CARDS || { pupa: { name: "Pupa", role: "balance", rarity: 2, art: "pupa", from: "hero" } };
    for (const [id, c] of Object.entries(cards)) {
      if (c.from !== "hero") continue;
      const lv = Math.floor(Number(units[id]) || 0);
      if (id !== "pupa" && lv <= 0) continue;
      list.push({ id, name: c.name, role: c.role || "balance", rarity: c.rarity || 2, art: c.art || id, level: Math.max(1, Math.min(100, lv || 1)) });
    }
    // Pupa first, then the strongest
    return list.sort((a, b) => (a.id === "pupa" ? -1 : b.id === "pupa" ? 1 : b.level - a.level || b.rarity - a.rarity));
  }
  const heroArt = (h) => `assets/${h.art}-hero.webp`;

  // ---- The frame ----
  const frame = el("div", "shop-card survivor-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "Pupa ผู้รอดชีวิต");
  title.id = "survivorTitle";
  const wallet = el("div", "shop-wallet");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  const homeButton = button("icon-button survivor-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(homeButton, title, wallet);
  const body = el("div", "survivor-body");
  frame.append(head, body);
  screen.append(frame);
  function showCoins() {
    wallet.querySelector("b").textContent = fmt(save().coins);
    wallet.querySelector(".gems").textContent = fmt(save().gems || 0);
    wallet.setAttribute("aria-label", `เหรียญ ${fmt(save().coins)} เพชร ${fmt(save().gems || 0)}`);
  }

  let isShown = false;
  let run = null;          // the run being played, if any
  let chosenStage = 1;

  function open() {
    if (!game()) return;
    progress();
    isShown = true;
    screen.hidden = false;
    game().setSurvivorOpen?.(true);
    chosenStage = nextStage();
    showLobby();
    tone(659, .07, "triangle", .04);
    homeButton.focus();
  }
  function goHome() {
    stopRun();
    isShown = false;
    screen.hidden = true;
    game().setSurvivorOpen?.(false);
    game().showModes?.();
  }
  function key(event) {
    if (run && !run.done) {
      if (event.key === "Escape" || event.key === "p" || event.key === "P") { event.preventDefault(); if (run.choosing) return; togglePause(); return; }
      if (run.choosing && /^[1-3]$/.test(event.key)) { event.preventDefault(); pickOffer(Number(event.key) - 1); }
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (run) showLobby();
    else goHome();
  }

  // ---- The lobby: hero, stage, blessings ----
  function showLobby() {
    // a pick redraws the lobby: keep it where it was scrolled to
    const again = Boolean(body.querySelector(".survivor-cols"));
    const keepTop = again ? body.scrollTop : 0, keepHeroes = again ? body.querySelector(".survivor-heroes")?.scrollTop || 0 : 0;
    stopRun();
    showCoins();
    frame.classList.remove("is-playing");
    const r = record(), heroes = roster();
    if (!heroes.some(h => h.id === r.hero)) r.hero = "pupa";
    const hero = heroes.find(h => h.id === r.hero) || heroes[0];
    if (!isOpenStage(chosenStage)) chosenStage = nextStage();

    const intro = el("section", "survivor-intro");
    const pic = el("img", "survivor-intro-pic");
    pic.src = heroArt(hero);
    pic.alt = "";
    const words = el("div", "survivor-intro-words");
    words.append(el("b", null, "อยู่รอดท่ามกลางฝูงมอนสเตอร์ แล้วล้มบอส!"),
      el("span", null, "ลากนิ้วบนจอ (หรือ WASD / ลูกศร) เพื่อเดิน อาวุธโจมตีเอง · เก็บผลึก 💎 ให้เลเวลอัป แล้วเลือกอาวุธหรือเครื่องราง 1 ใน 3 · บอสมาที่ 4:00 ล้มได้ผ่านด่าน · เหลือเลือดครึ่งหนึ่งได้ ★★★"));
    intro.append(pic, words);

    // heroes
    const heroBox = el("section", "survivor-box");
    heroBox.append(el("h3", null, "เลือกฮีโร่"));
    const heroRow = el("div", "survivor-heroes");
    for (const h of heroes) {
      const chip = button(`survivor-hero${h.id === hero.id ? " is-on" : ""}`, null, () => { r.hero = h.id; store(); showLobby(); }, `${h.name} เลเวล ${h.level}`);
      const img = el("img");
      img.src = heroArt(h);
      img.alt = "";
      img.loading = "lazy";
      chip.append(img, el("b", null, h.name), el("small", null, `${ROLE_ICON[h.role] || ""} Lv ${h.level}`));
      heroRow.append(chip);
    }
    const w = S.WEAPONS[S.ROLE_WEAPON[hero.role] || "bolt"];
    const heroNote = el("p", "survivor-note", `${hero.name} · ${S.ROLE_TEXT[hero.role] || ""} · อาวุธเริ่มต้น ${w.icon} ${w.name}${["attack", "defense", "support"].includes(hero.role) ? " + ⭐ ดาวนำทาง" : ""} · เลเวลการ์ดเพิ่มพลัง ${Math.round(Math.min(60, hero.level - 1))}%`);
    heroBox.append(heroRow, heroNote);
    if (heroes.length === 1) heroBox.append(el("p", "survivor-tip", "สุ่มการ์ดฮีโร่ในศึกการ์ดแสงจันทร์ เพื่อเลือกเล่นเป็นฮีโร่ตัวอื่น"));

    // stages
    const stageBox = el("section", "survivor-box");
    stageBox.append(el("h3", null, "เลือกด่าน"));
    const list = el("div", "survivor-stages");
    S.STAGES.forEach((def, i) => {
      const n = i + 1, open = isOpenStage(n), have = r.stars[n] || 0;
      const tile = button(`survivor-stage${n === chosenStage ? " is-on" : ""}${open ? "" : " is-locked"}`, null, () => { chosenStage = n; showLobby(); }, `ด่าน ${n} ${def.name} ${open ? `ได้ ${have} ดาว` : "ล็อกอยู่"}`);
      tile.disabled = !open;
      const boss = el("img");
      boss.src = `assets/boss-${def.boss}.webp`;
      boss.alt = "";
      boss.loading = "lazy";
      tile.style.setProperty("--ground", def.look.ground);
      tile.append(boss, el("b", null, `${n}. ${open ? def.name : "🔒"}`), el("small", "survivor-stars", open ? starText(have) : "ผ่านด่านก่อนหน้าเพื่อปลดล็อก"), el("small", null, open && r.best[n] ? `อยู่รอดนานสุด ${clock(r.best[n])}` : ""));
      list.append(tile);
    });
    const go = button("primary-button survivor-go", `▶ เริ่มด่าน ${chosenStage} · ${hero.name}`, () => startRun(chosenStage, hero));
    stageBox.append(list, go);

    // blessings
    const perkBox = el("section", "survivor-box");
    perkBox.append(el("h3", null, "พรถาวร (ใช้เหรียญ)"));
    const perks = el("div", "survivor-perks");
    for (const [k, def] of Object.entries(S.PERKS)) {
      const lv = r.perks[k] || 0, cost = S.perkCost(lv);
      const row = el("div", "survivor-perk");
      const dots = el("span", "survivor-dots", "●".repeat(lv) + "○".repeat(5 - lv));
      const words2 = el("div");
      words2.append(el("b", null, `${def.icon} ${def.name}`), el("small", null, def.text));
      const buy = button("secondary-button survivor-buy", cost == null ? "เต็มแล้ว" : `● ${fmt(cost)}`, () => buyPerk(k), cost == null ? `${def.name} เต็มแล้ว` : `ซื้อ ${def.name} ระดับ ${lv + 1} ราคา ${cost} เหรียญ`);
      buy.disabled = cost == null || save().coins < cost;
      row.append(words2, dots, buy);
      perks.append(row);
    }
    perkBox.append(perks);

    const cols = el("div", "survivor-cols");
    const left = el("div", "survivor-col");
    left.append(stageBox, heroBox);
    cols.append(left, perkBox);
    body.replaceChildren(intro, cols);
    body.scrollTop = keepTop;
    heroRow.scrollTop = keepHeroes;
    // the chosen hero in sight within its list, on first showing
    if (!again) { const on = heroRow.querySelector(".is-on"); if (on && on.offsetTop > heroRow.clientHeight) heroRow.scrollTop = on.offsetTop - heroRow.clientHeight / 2; }
  }
  function buyPerk(k) {
    const r = record(), lv = r.perks[k] || 0, cost = S.perkCost(lv);
    if (cost == null || save().coins < cost) return;
    save().coins -= cost;
    r.perks[k] = lv + 1;
    store();
    [784, 988, 1175].forEach((note, i) => tone(note, .09, "triangle", .04, i * .06));
    announce(`${S.PERKS[k].name} ระดับ ${lv + 1}`);
    showLobby();
  }

  // ---- Pictures ----
  // each picture once, shrunk to the size it is drawn, with a white copy for hits
  const pics = new Map();
  function sprite(src, size) {
    const key = src + "@" + size;
    if (pics.has(key)) return pics.get(key);
    const entry = { ready: false, canvas: null, white: null, w: 0, h: 0 };
    pics.set(key, entry);
    const img = new Image();
    img.onload = () => {
      const scale = size / Math.max(img.naturalWidth, img.naturalHeight);
      const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      const white = document.createElement("canvas");
      white.width = w; white.height = h;
      const g = white.getContext("2d");
      g.drawImage(c, 0, 0);
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(255,255,255,.85)";
      g.fillRect(0, 0, w, h);
      Object.assign(entry, { ready: true, canvas: c, white, w, h });
    };
    img.src = src;
    return entry;
  }
  // the ground: a tile of the stage's colours, scattered petals and grass
  function groundTile(look, seed) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = look.ground;
    g.fillRect(0, 0, 256, 256);
    let a = seed;
    const rnd = () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = look.dots;
      g.globalAlpha = .6;
      g.beginPath();
      g.ellipse(rnd() * 256, rnd() * 256, 2 + rnd() * 5, 1 + rnd() * 3, rnd() * 3, 0, Math.PI * 2);
      g.fill();
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = look.petal;
      g.globalAlpha = .35 + rnd() * .3;
      const x = rnd() * 256, y = rnd() * 256, r = 2 + rnd() * 2.5;
      for (let k = 0; k < 5; k++) { const an = k / 5 * Math.PI * 2; g.beginPath(); g.ellipse(x + Math.cos(an) * r, y + Math.sin(an) * r, r, r * .6, an, 0, Math.PI * 2); g.fill(); }
    }
    for (let i = 0; i < 26; i++) {
      g.strokeStyle = look.dots;
      g.globalAlpha = .9;
      g.lineWidth = 1.4;
      const x = rnd() * 256, y = rnd() * 256;
      g.beginPath();
      g.moveTo(x, y); g.lineTo(x - 2, y - 6);
      g.moveTo(x + 2, y); g.lineTo(x + 3, y - 7);
      g.stroke();
    }
    g.globalAlpha = 1;
    return c;
  }

  // ---- Playing ----
  function startRun(n, hero) {
    if (!isOpenStage(n)) return;
    stopRun();
    chosenStage = n;
    const r = record();
    const state = S.create({ stage: n, hero: { role: hero.role, level: hero.level, rarity: hero.rarity }, perks: r.perks, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
    const view = el("section", "survivor-play");
    const canvas = el("canvas", "survivor-canvas");
    canvas.setAttribute("aria-label", "สนามต่อสู้ ลากนิ้วเพื่อเดิน");
    const hud = el("div", "survivor-hud");
    const xpBar = el("div", "survivor-xp");
    const xpFill = el("i");
    xpBar.append(xpFill);
    const top = el("div", "survivor-top");
    const kills = el("span", "survivor-kills", "💀 0");
    const timer = el("b", "survivor-timer", "0:00");
    const level = el("span", "survivor-level", "Lv 1");
    const pauseButton = button("icon-button survivor-pause", "⏸", () => togglePause(), "หยุดชั่วคราว");
    top.append(kills, timer, level, pauseButton);
    const kit = el("div", "survivor-kit");
    const bossBar = el("div", "survivor-boss");
    bossBar.hidden = true;
    bossBar.append(el("small", null, "บอส"), el("i"));
    const banner = el("p", "survivor-banner");
    hud.append(xpBar, top, kit, bossBar, banner);
    view.append(canvas, hud);
    body.replaceChildren(view);
    frame.classList.add("is-playing");

    const look = S.STAGES[n - 1];
    run = {
      n, hero, state, view, canvas, ctx: canvas.getContext("2d"), hud: { xpFill, kills, timer, level, kit, bossBar, banner },
      ground: null, groundOf: groundTile(look.look, n * 7919),
      acc: 0, last: 0, raf: 0, paused: false, choosing: false, done: false,
      stick: null, keys: new Set(), zoom: 1, dpr: 1, w: 0, h: 0,
      floats: [], puffs: [], shake: 0, red: 0, lastHit: 0, lastPick: 0, kitKey: "", bannerUntil: 0
    };
    run.ground = run.ctx.createPattern(run.groundOf, "repeat");
    // pictures for this stage and hero
    run.heroPic = sprite(heroArt(hero), 160);
    run.foePics = Object.fromEntries(look.foes.map(id => [id, sprite(`assets/foe-${id}.webp`, 112)]));
    run.foePics[look.elite] = sprite(`assets/foe-${look.elite}.webp`, 200);
    run.foePics[look.boss] = sprite(`assets/boss-${look.boss}.webp`, 300);
    fit();
    bindInput();
    showBanner(`ด่าน ${n} · ${look.name}`, 2.2);
    tone(523, .08, "triangle", .05);
    tone(784, .1, "triangle", .05, .1);
    run.raf = requestAnimationFrame(loop);
    canvas.focus?.();
  }
  function stopRun() {
    if (!run) return;
    cancelAnimationFrame(run.raf);
    unbindInput();
    run = null;
  }
  function fit() {
    const r = run;
    if (!r) return;
    const box = r.view.getBoundingClientRect();
    r.w = Math.max(1, box.width); r.h = Math.max(1, box.height);
    r.dpr = Math.min(2, window.devicePixelRatio || 1);
    r.canvas.width = Math.round(r.w * r.dpr); r.canvas.height = Math.round(r.h * r.dpr);
    // about 640 units across the short side, never too small to read
    r.zoom = Math.max(.6, Math.min(1.25, Math.min(r.w, r.h) / 600));
    S.setView(r.state, r.w / r.zoom, r.h / r.zoom);
  }

  // ---- Input: a stick under the finger, or the keyboard ----
  const MOVE_KEYS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1], A: [-1, 0], D: [1, 0], W: [0, -1], S: [0, 1] };
  function onKeyDown(event) { if (run && MOVE_KEYS[event.key]) { run.keys.add(event.key); event.preventDefault(); } }
  function onKeyUp(event) { if (run) run.keys.delete(event.key); }
  function onDown(event) {
    if (!run || run.paused || run.choosing || run.done) return;
    event.preventDefault();
    run.canvas.setPointerCapture?.(event.pointerId);
    const b = run.canvas.getBoundingClientRect();
    run.stick = { id: event.pointerId, x: event.clientX - b.left, y: event.clientY - b.top, dx: 0, dy: 0 };
  }
  function onMove(event) {
    const st = run?.stick;
    if (!st || st.id !== event.pointerId) return;
    const b = run.canvas.getBoundingClientRect(), R = 46;
    let dx = event.clientX - b.left - st.x, dy = event.clientY - b.top - st.y;
    const d = Math.hypot(dx, dy);
    // the stick's base follows a finger that runs past it
    if (d > R) { st.x += dx / d * (d - R); st.y += dy / d * (d - R); dx = dx / d * R; dy = dy / d * R; }
    st.dx = dx / R; st.dy = dy / R;
  }
  function onUp(event) { if (run?.stick?.id === event.pointerId) run.stick = null; }
  function onBlur() { if (run && !run.done && !run.choosing && !run.paused) togglePause(true); }
  function onVisible() { if (document.hidden) onBlur(); }
  function bindInput() {
    const c = run.canvas;
    c.addEventListener("pointerdown", onDown);
    c.addEventListener("pointermove", onMove);
    c.addEventListener("pointerup", onUp);
    c.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("resize", fit);
    document.addEventListener("visibilitychange", onVisible);
  }
  function unbindInput() {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("blur", onBlur);
    window.removeEventListener("resize", fit);
    document.removeEventListener("visibilitychange", onVisible);
  }
  function direction() {
    const r = run;
    if (r.stick) return { x: r.stick.dx, y: r.stick.dy };
    let x = 0, y = 0;
    for (const k of r.keys) { x += MOVE_KEYS[k][0]; y += MOVE_KEYS[k][1]; }
    const d = Math.hypot(x, y);
    return d ? { x: x / d, y: y / d } : { x: 0, y: 0 };
  }

  // ---- The loop ----
  function loop(now) {
    const r = run;
    if (!r) return;
    r.raf = requestAnimationFrame(loop);
    const dt = r.last ? Math.min(.1, (now - r.last) / 1000) : 0;
    r.last = now;
    if (!r.paused && !r.choosing && !r.done) {
      r.acc += dt;
      let n = 0;
      while (r.acc >= S.STEP && n++ < 6) {
        S.step(r.state, direction());
        r.acc -= S.STEP;
        if (r.state.pending || r.state.over) { r.acc = 0; break; }
      }
      if (n >= 6) r.acc = 0;
      sparkle(S.takeFx(r.state));
      if (r.state.over) { finish(); }
      else if (r.state.pending) showChoice();
    }
    paintHud();
    draw(dt);
  }
  // a step's events: sounds, numbers, puffs, banners
  function sparkle(list) {
    const r = run, t = performance.now();
    let hits = 0;
    for (const f of list) {
      if (f.k === "hit") {
        hits++;
        if (r.floats.length < 36 && (hits < 4 || Math.random() < .15)) r.floats.push({ x: f.x + (Math.random() - .5) * 14, y: f.y, n: f.n, life: .6 });
      } else if (f.k === "kill") {
        if (r.puffs.length < 70) r.puffs.push({ x: f.x, y: f.y, r: f.r, life: .35 });
      } else if (f.k === "hurt") {
        r.red = .35; r.shake = .18;
        if (t - r.lastHurt > 140 || !r.lastHurt) { r.lastHurt = t; tone(150, .08, "square", .04); }
      } else if (f.k === "level") { tone(880, .07, "triangle", .05); tone(1175, .09, "triangle", .05, .07); }
      else if (f.k === "chest") { [659, 880, 1175].forEach((note, i) => tone(note, .1, "triangle", .05, i * .07)); showBanner("🎁 หีบสมบัติ! เลือกพลังเพิ่ม", 1.6); }
      else if (f.k === "heal") { tone(988, .1, "sine", .05); showBanner("❤️ ฟื้นพลัง", 1); }
      else if (f.k === "magnet") { tone(1319, .1, "sine", .04); showBanner("🧲 ดูดผลึกทั้งหมด", 1); }
      else if (f.k === "ring") { showBanner("⚠️ ฝูงมอนสเตอร์ล้อมเข้ามา!", 2); tone(330, .12, "sawtooth", .03); }
      else if (f.k === "elite") { showBanner("👹 มอนสเตอร์หัวหน้าปรากฏ!", 2); tone(262, .14, "sawtooth", .035); }
      else if (f.k === "boss") { showBanner(`🔥 บอส ${S.STAGES[r.n - 1].name} มาแล้ว!`, 3); [196, 185, 175].forEach((note, i) => tone(note, .22, "sawtooth", .04, i * .22)); }
      else if (f.k === "boom") { if (t - r.lastPick > 70) { r.lastPick = t; tone(110, .1, "triangle", .05); } }
      else if (f.k === "burst" || f.k === "dash") tone(220, .1, "sawtooth", .03);
    }
    if (hits && t - r.lastHit > 70) { r.lastHit = t; tone(520 + Math.random() * 120, .03, "triangle", .018); }
  }
  function showBanner(text, sec) {
    const r = run;
    r.hud.banner.textContent = text;
    r.hud.banner.classList.add("is-on");
    r.bannerUntil = performance.now() + sec * 1000;
  }

  function paintHud() {
    const r = run, s = r.state, h = r.hud;
    h.xpFill.style.width = `${Math.min(100, s.xp / S.need(s.level) * 100)}%`;
    h.kills.textContent = `💀 ${fmt(s.kills)}`;
    const left = S.BOSS_AT - s.t;
    h.timer.textContent = s.boss ? clock(s.t) : clock(s.t);
    h.timer.classList.toggle("is-near", !s.boss && left < 20);
    h.level.textContent = `Lv ${s.level}`;
    const kitKey = s.weapons.map(w => w.id + w.lv).join() + "|" + s.charms.map(c => c.id + c.lv).join();
    if (kitKey !== r.kitKey) {
      r.kitKey = kitKey;
      h.kit.replaceChildren(...s.weapons.map(w => kitIcon(S.WEAPONS[w.id].icon, w.lv)), ...s.charms.map(c => kitIcon(S.CHARMS[c.id].icon, c.lv, true)));
    }
    const boss = s.boss && !s.boss.dead ? s.boss : null;
    h.bossBar.hidden = !boss;
    if (boss) h.bossBar.querySelector("i").style.width = `${Math.max(0, boss.hp / boss.maxHp * 100)}%`;
    if (r.bannerUntil && performance.now() > r.bannerUntil) { h.banner.classList.remove("is-on"); r.bannerUntil = 0; }
  }
  function kitIcon(icon, lv, charm) {
    const node = el("span", `survivor-kit-item${charm ? " is-charm" : ""}`, icon);
    node.append(el("small", null, lv >= S.MAX_LEVEL ? "MAX" : String(lv)));
    return node;
  }

  // ---- Drawing ----
  function draw(dt) {
    const r = run, s = r.state, g = r.ctx, p = s.player, z = r.zoom, dpr = r.dpr;
    const ww = r.w / z, wh = r.h / z;
    r.shake = Math.max(0, r.shake - dt);
    r.red = Math.max(0, r.red - dt);
    const sx = r.shake && !calm() ? (Math.random() - .5) * 8 : 0, sy = r.shake && !calm() ? (Math.random() - .5) * 8 : 0;
    const camX = p.x, camY = p.y;
    g.setTransform(dpr * z, 0, 0, dpr * z, dpr * (r.w / 2 - camX * z + sx), dpr * (r.h / 2 - camY * z + sy));
    // ground
    g.fillStyle = r.ground;
    g.fillRect(camX - ww / 2 - 20, camY - wh / 2 - 20, ww + 40, wh + 40);
    const inView = (x, y, m) => Math.abs(x - camX) < ww / 2 + m && Math.abs(y - camY) < wh / 2 + m;
    const time = performance.now() / 1000;

    // aura under everything
    for (const w of s.weapons) {
      if (w.id !== "aura") continue;
      const R = S.WEAPONS.aura.levels[w.lv - 1].radius * p.area;
      const grad = g.createRadialGradient(p.x, p.y, R * .2, p.x, p.y, R);
      grad.addColorStop(0, "rgba(255,170,210,.05)");
      grad.addColorStop(1, "rgba(255,140,200,.28)");
      g.fillStyle = grad;
      g.beginPath(); g.arc(p.x, p.y, R, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,200,230,.85)";
      for (let i = 0; i < 8; i++) {
        const a = time * 1.4 + i / 8 * Math.PI * 2, rr = R * (.55 + .4 * ((i % 3) / 2));
        g.beginPath(); g.ellipse(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, 5, 3, a, 0, Math.PI * 2); g.fill();
      }
    }
    // crystals and finds
    for (const gem of s.gems) {
      if (!inView(gem.x, gem.y, 20)) continue;
      const big = gem.v >= 5, mid = gem.v >= 2;
      g.fillStyle = big ? "#ffd76a" : mid ? "#7dffb0" : "#7fd8ff";
      const sz = big ? 7 : mid ? 6 : 5;
      g.beginPath(); g.moveTo(gem.x, gem.y - sz); g.lineTo(gem.x + sz * .7, gem.y); g.lineTo(gem.x, gem.y + sz); g.lineTo(gem.x - sz * .7, gem.y); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,.7)";
      g.fillRect(gem.x - 1, gem.y - sz * .5, 2, 2);
    }
    g.textAlign = "center"; g.textBaseline = "middle";
    for (const it of s.items) {
      if (!inView(it.x, it.y, 30)) continue;
      const bob = Math.sin(time * 4 + it.x) * 3;
      g.font = `${it.k === "chest" ? 30 : 22}px system-ui, sans-serif`;
      g.fillStyle = "rgba(255,255,255,.25)";
      g.beginPath(); g.arc(it.x, it.y + bob, it.k === "chest" ? 22 : 15, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fff";   // a see-through fill would fade the emoji too
      g.fillText(it.k === "chest" ? "🎁" : it.k === "heal" ? "❤️" : "🧲", it.x, it.y + bob);
    }
    // monsters and Pupa, back to front
    const bodies = [];
    for (const e of s.enemies) if (inView(e.x, e.y, e.r * 2 + 20)) bodies.push(e);
    bodies.push(p);
    bodies.sort((a, b) => a.y - b.y);
    for (const b of bodies) {
      if (b === p) { drawHero(g, r, p, time); continue; }
      const pic = r.foePics[b.art];
      g.fillStyle = "rgba(0,0,0,.28)";
      g.beginPath(); g.ellipse(b.x, b.y + b.r * .85, b.r * .9, b.r * .3, 0, 0, Math.PI * 2); g.fill();
      if (!pic?.ready) { g.fillStyle = "#c36"; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill(); continue; }
      const h = b.r * 2.5, w = h * pic.w / pic.h;
      const wob = calm() ? 0 : Math.sin(time * 9 + b.id) * .07;
      g.save();
      g.translate(b.x, b.y + b.r * .9);
      g.rotate(wob);
      if (p.x > b.x) g.scale(-1, 1);
      g.drawImage(b.flash > 0 ? pic.white : pic.canvas, -w / 2, -h, w, h);
      g.restore();
      if (b.kind === "elite") {
        const hp = Math.max(0, b.hp / b.maxHp);
        g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(b.x - 26, b.y - b.r * 1.75, 52, 5);
        g.fillStyle = "#ff8a3d"; g.fillRect(b.x - 26, b.y - b.r * 1.75, 52 * hp, 5);
      }
    }
    // shots
    for (const sh of s.shots) {
      if (!inView(sh.x, sh.y, 160)) continue;
      if (sh.k === "bolt") {
        g.save(); g.translate(sh.x, sh.y); g.rotate(time * 10);
        g.fillStyle = "rgba(255,230,120,.35)"; g.beginPath(); g.arc(0, 0, sh.r * 1.6, 0, Math.PI * 2); g.fill();
        star(g, 0, 0, sh.r * 1.1, sh.r * .45, "#fff3a0");
        g.restore();
      } else if (sh.k === "slash") {
        const f = sh.life / sh.max;
        g.save(); g.translate(sh.x, sh.y); g.rotate(sh.a);
        g.globalAlpha = Math.min(1, f * 1.6);
        const grad = g.createRadialGradient(0, 0, sh.R * .4, 0, 0, sh.R);
        grad.addColorStop(0, "rgba(160,220,255,0)"); grad.addColorStop(.75, "rgba(200,235,255,.55)"); grad.addColorStop(1, "rgba(255,255,255,.95)");
        g.fillStyle = grad;
        g.beginPath(); g.arc(0, 0, sh.R, -sh.arc / 2, sh.arc / 2); g.arc(0, 0, sh.R * .55, sh.arc / 2, -sh.arc / 2, true); g.closePath(); g.fill();
        g.restore();
      } else if (sh.k === "zap") {
        const f = sh.life / sh.max;
        g.save();
        g.globalAlpha = f;
        g.strokeStyle = "#e9f6ff"; g.lineWidth = 3; g.shadowColor = "#7fd8ff"; g.shadowBlur = 12;
        g.beginPath();
        let x = sh.x + 10, y = sh.y - 220;
        g.moveTo(x, y);
        for (let i = 1; i <= 6; i++) { x = sh.x + (i === 6 ? 0 : (Math.sin(sh.x + i * 7) * 16)); y = sh.y - 220 + i * 36.7; g.lineTo(x, y); }
        g.stroke();
        g.shadowBlur = 0;
        g.fillStyle = "rgba(160,220,255,.35)"; g.beginPath(); g.arc(sh.x, sh.y, sh.R * (1.2 - f * .4), 0, Math.PI * 2); g.fill();
        g.restore();
      } else if (sh.k === "leaf") {
        g.save(); g.translate(sh.x, sh.y); g.rotate(sh.spin);
        g.fillStyle = "#7bd66a"; g.beginPath(); g.ellipse(0, 0, sh.r, sh.r * .45, 0, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#3e8f3a"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-sh.r, 0); g.lineTo(sh.r, 0); g.stroke();
        g.restore();
      } else if (sh.k === "bomb") {
        const f = 1 - Math.max(0, sh.life) / sh.max, lift = Math.sin(f * Math.PI) * 70;
        g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(sh.x, sh.y + 6, 8, 3, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#e8344a";
        g.beginPath(); g.arc(sh.x - 5, sh.y - lift, 7, 0, Math.PI * 2); g.arc(sh.x + 6, sh.y - lift + 2, 7, 0, Math.PI * 2); g.fill();
        g.strokeStyle = "#3e8f3a"; g.lineWidth = 2; g.beginPath(); g.moveTo(sh.x - 5, sh.y - lift - 6); g.quadraticCurveTo(sh.x, sh.y - lift - 16, sh.x + 6, sh.y - lift - 5); g.stroke();
        g.strokeStyle = "rgba(255,120,140,.5)"; g.setLineDash([4, 6]); g.beginPath(); g.arc(sh.tx, sh.ty, sh.R, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      } else if (sh.k === "boom") {
        const f = sh.life / sh.max;
        g.fillStyle = `rgba(255,${150 + 80 * f | 0},90,${.55 * f})`;
        g.beginPath(); g.arc(sh.x, sh.y, sh.R * (1.15 - f * .4), 0, Math.PI * 2); g.fill();
      }
    }
    // moons going round
    for (const w of s.weapons) {
      if (w.id !== "orbit") continue;
      const st = S.WEAPONS.orbit.levels[w.lv - 1], R = st.radius * p.area;
      for (let i = 0; i < st.count; i++) {
        const a = w.angle + i / st.count * Math.PI * 2, x = p.x + Math.cos(a) * R, y = p.y + Math.sin(a) * R;
        g.fillStyle = "rgba(255,236,150,.28)"; g.beginPath(); g.arc(x, y, 20 * p.area, 0, Math.PI * 2); g.fill();
        g.font = `${Math.round(26 * p.area)}px system-ui, sans-serif`;
        g.fillStyle = "#fff";
        g.fillText("🌙", x, y);
      }
    }
    // the boss's shots
    for (const b of s.bullets) {
      if (!inView(b.x, b.y, 20)) continue;
      g.fillStyle = "rgba(190,90,255,.35)"; g.beginPath(); g.arc(b.x, b.y, b.r * 1.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#f0d0ff"; g.beginPath(); g.arc(b.x, b.y, b.r * .8, 0, Math.PI * 2); g.fill();
    }
    // puffs and numbers
    for (const pf of r.puffs) {
      pf.life -= dt;
      const f = Math.max(0, pf.life / .35);
      g.strokeStyle = `rgba(255,255,255,${f * .8})`; g.lineWidth = 3;
      g.beginPath(); g.arc(pf.x, pf.y, pf.r * (1.6 - f * .8), 0, Math.PI * 2); g.stroke();
    }
    r.puffs = r.puffs.filter(pf => pf.life > 0);
    g.font = "900 15px system-ui, sans-serif";
    g.lineWidth = 3; g.strokeStyle = "rgba(40,10,60,.85)";
    for (const fl of r.floats) {
      fl.life -= dt; fl.y -= 40 * dt;
      g.globalAlpha = Math.max(0, Math.min(1, fl.life / .3));
      g.strokeText(fl.n, fl.x, fl.y);
      g.fillStyle = "#fff"; g.fillText(fl.n, fl.x, fl.y);
    }
    g.globalAlpha = 1;
    r.floats = r.floats.filter(fl => fl.life > 0);

    // screen space: the stick, and a red edge when hurt
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (r.stick) {
      const st = r.stick;
      g.fillStyle = "rgba(255,255,255,.12)"; g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 2;
      g.beginPath(); g.arc(st.x, st.y, 46, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = "rgba(255,255,255,.55)";
      g.beginPath(); g.arc(st.x + st.dx * 46, st.y + st.dy * 46, 20, 0, Math.PI * 2); g.fill();
    }
    if (r.red > 0) {
      const grad = g.createRadialGradient(r.w / 2, r.h / 2, Math.min(r.w, r.h) * .35, r.w / 2, r.h / 2, Math.max(r.w, r.h) * .7);
      grad.addColorStop(0, "rgba(255,0,60,0)"); grad.addColorStop(1, `rgba(255,30,80,${r.red})`);
      g.fillStyle = grad; g.fillRect(0, 0, r.w, r.h);
    }
  }
  function drawHero(g, r, p, time) {
    const pic = r.heroPic, run2 = p.moving && !calm();
    g.fillStyle = "rgba(0,0,0,.3)";
    g.beginPath(); g.ellipse(p.x, p.y + 20, 20, 7, 0, 0, Math.PI * 2); g.fill();
    const bob = run2 ? Math.abs(Math.sin(time * 12)) * 5 : Math.sin(time * 3) * 1.5;
    if (pic.ready) {
      const h = 64, w = h * pic.w / pic.h;
      g.save();
      g.translate(p.x, p.y + 22 - bob);
      if (run2) g.rotate(Math.sin(time * 12) * .06);
      if (p.fx < -.1) g.scale(-1, 1);
      g.drawImage(p.hurt > 0 && Math.floor(time * 20) % 2 ? pic.white : pic.canvas, -w / 2, -h, w, h);
      g.restore();
    } else {
      g.fillStyle = "#ff9ec4"; g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
    // hearts left
    const f = Math.max(0, p.hp / p.maxHp);
    g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(p.x - 24, p.y + 30, 48, 6);
    g.fillStyle = f > .5 ? "#6dff9a" : f > .25 ? "#ffd166" : "#ff5d73";
    g.fillRect(p.x - 24, p.y + 30, 48 * f, 6);
  }
  function star(g, x, y, R, r2, color) {
    g.fillStyle = color;
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r2 : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }

  // ---- Level-up picks ----
  function showChoice() {
    const r = run, s = r.state;
    if (r.choosing || !s.offer) return;
    r.choosing = true;
    r.stick = null;
    const box = el("div", "survivor-cover survivor-choice");
    box.append(el("h3", null, s.pending > 1 ? `เลเวลอัป! (เลือกได้อีก ${s.pending})` : "เลเวลอัป!"), el("p", null, "เลือก 1 อย่าง"));
    const row = el("div", "survivor-offers");
    s.offer.forEach((o, i) => {
      let icon = "❤️", name = "ฟื้นพลังเต็ม", text = "ทุกอย่างเต็มแล้ว ฟื้นพลังชีวิตจนเต็ม", tag = "";
      if (o.k === "gold") { icon = "●"; name = "เหรียญ 25"; text = "ทุกอย่างเต็มแล้ว รับเหรียญเพิ่ม"; }
      if (o.k === "weapon" || o.k === "charm") {
        const def = o.k === "weapon" ? S.WEAPONS[o.id] : S.CHARMS[o.id];
        icon = def.icon; name = def.name; text = def.text;
        tag = o.lv === 1 ? "ใหม่!" : `Lv ${o.lv - 1} → ${o.lv}`;
        if (o.k === "weapon" && o.lv > 1) {
          const a = def.levels[o.lv - 2], b = def.levels[o.lv - 1], bits = [];
          if (b.dmg !== a.dmg) bits.push(`ดาเมจ ${a.dmg}→${b.dmg}`);
          if (b.count && b.count !== a.count) bits.push(`จำนวน ${a.count}→${b.count}`);
          if (b.cd && b.cd !== a.cd) bits.push("ถี่ขึ้น");
          if (b.both && !a.both) bits.push("ฟันทั้งหน้าและหลัง");
          if ((b.radius || b.range || b.area) > (a.radius || a.range || a.area)) bits.push("กว้างขึ้น");
          if (b.pierce && b.pierce !== a.pierce) bits.push(`ทะลุ ${b.pierce}`);
          text = bits.join(" · ") || text;
        }
      }
      const card = button(`survivor-offer is-${o.k}`, null, () => pickOffer(i), `${name} ${tag} ${text}`);
      card.append(el("span", "survivor-offer-icon", icon), el("b", null, name), el("small", "survivor-offer-tag", tag), el("small", null, text), el("kbd", null, String(i + 1)));
      row.append(card);
    });
    box.append(row);
    r.view.append(box);
    r.choiceBox = box;
    [784, 988, 1319].forEach((note, i) => tone(note, .1, "triangle", .045, i * .07));
    setTimeout(() => box.querySelector("button")?.focus(), 30);
  }
  function pickOffer(i) {
    const r = run;
    if (!r?.choosing) return;
    if (!S.choose(r.state, i)) return;
    tone(1047, .08, "triangle", .05);
    r.choiceBox?.remove();
    r.choiceBox = null;
    r.choosing = false;
    r.last = 0;
    if (r.state.pending) showChoice();
  }

  // ---- Pause ----
  function togglePause(force) {
    const r = run;
    if (!r || r.done || r.choosing) return;
    const on = force === true ? true : !r.paused;
    if (on === r.paused) return;
    r.paused = on;
    r.stick = null;
    r.keys.clear();
    if (on) {
      const box = el("div", "survivor-cover survivor-pausebox");
      box.append(el("h3", null, "⏸ หยุดชั่วคราว"), el("p", null, `${clock(r.state.t)} · 💀 ${fmt(r.state.kills)} · Lv ${r.state.level}`));
      const actions = el("div", "title-actions");
      actions.append(button("primary-button", "▶ เล่นต่อ", () => togglePause(false)), button("secondary-button", "ยอมแพ้", () => { r.giveUp = true; togglePause(false); r.state.over = true; finish(); }));
      box.append(actions);
      r.view.append(box);
      r.pauseBox = box;
      box.querySelector("button")?.focus();
    } else {
      r.pauseBox?.remove();
      r.pauseBox = null;
      r.last = 0;
    }
  }

  // ---- The end of a run ----
  function finish() {
    const r = run;
    if (!r || r.done) return;
    r.done = true;
    r.stick = null;
    const s = r.state, n = r.n, rec = record();
    const got = S.starsFor(s), before = rec.stars[n] || 0, sum = S.summary(s);
    const first = got >= 2 && before < 2;
    const reward = S.rewardFor(n, sum, first, got, before);
    if (got > before) rec.stars[n] = got;
    rec.best[n] = Math.max(rec.best[n] || 0, Math.min(3600, sum.time));
    save().coins += reward.coins;
    save().gems = (save().gems || 0) + reward.gems;
    const cards = save().cards;
    const toCards = cards && typeof cards === "object" && typeof cards.dust === "number" && typeof cards.ore === "number";
    if (toCards) { cards.dust += reward.dust; cards.ore += reward.ore; }
    store();
    showCoins();
    if (s.won) [659, 784, 988, 1319].forEach((note, i) => tone(note, .14, "sine", .05, i * .1));
    else [392, 330, 262].forEach((note, i) => tone(note, .16, "triangle", .045, i * .14));
    const parts = [`● ${fmt(reward.coins)}`];
    if (reward.gems) parts.push(`💎 ${reward.gems}`);
    if (toCards && reward.dust) parts.push(`✧ ${reward.dust}`);
    if (toCards && reward.ore) parts.push(`⛏ ${reward.ore}`);
    const box = el("div", "survivor-cover survivor-result");
    const unlocked = first && n < STAGES;
    box.append(el("span", "survivor-medal", s.won ? "🏆" : "💫"), el("h3", null, s.won ? `ผ่านด่าน ${n}!` : r.giveUp ? "ยอมแพ้แล้ว" : "Pupa หมดแรง..."),
      el("p", "survivor-stars", starText(got)),
      el("p", null, `อยู่รอด ${clock(s.t)} · 💀 ${fmt(s.kills)} ตัว · เลเวล ${s.level}`),
      el("p", "survivor-used", [...s.weapons.map(w => `${S.WEAPONS[w.id].icon}${w.lv}`), ...s.charms.map(c => `${S.CHARMS[c.id].icon}${c.lv}`)].join("  ")),
      el("p", "survivor-reward", `ได้รับ ${parts.join(" · ")}`),
      el("p", "survivor-tip", s.won ? (got < 3 ? "ล้มบอสโดยเหลือพลังชีวิตครึ่งหนึ่งขึ้นไป เพื่อได้ ★★★" : unlocked ? `ปลดล็อกด่าน ${n + 1} แล้ว!` : "ได้ครบ 3 ดาว!") : got ? "ไปถึงบอสแล้ว! ล้มบอสเพื่อผ่านด่าน" : "ลองซื้อพรถาวรด้วยเหรียญ หรือเลือกฮีโร่ที่เลเวลสูงกว่า"));
    const actions = el("div", "title-actions");
    if (s.won && n < STAGES) actions.append(button("primary-button", `ด่าน ${n + 1} ▶`, () => { chosenStage = n + 1; startRun(n + 1, r.hero); }));
    actions.append(button(s.won && n < STAGES ? "secondary-button" : "primary-button", "เล่นอีกครั้ง", () => startRun(n, r.hero)), button("secondary-button", "กลับหน้าหลัก", () => showLobby()));
    box.append(actions);
    r.view.append(box);
    announce(s.won ? `ผ่านด่าน ${n} ได้ ${got} ดาว` : `จบรอบ อยู่รอด ${clock(s.t)}`);
    box.querySelector("button")?.focus();
  }

  // `run` is read by the browser tests to steer
  window.PupaSurvivor = { open, close: goHome, key, get isOpen() { return isShown; }, get run() { return run?.state || null; } };
  // Test link: ?survivor opens straight into Pupa the survivor.
  if (new URLSearchParams(location.search).has("survivor")) setTimeout(() => open(), 400);
})();

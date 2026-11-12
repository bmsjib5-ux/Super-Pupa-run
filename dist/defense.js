// ปกป้องสวนเชอร์รี่ (defend the cherry garden): the screens. The rules live
// in defense-engine.js; game.js lends the save, sounds and coins through
// window.PupaGame and keeps its own keys quiet while this is open.
//
// save.defense = { stars: { stage: best stars }, endless: most waves held,
// squad: up to six card ids taken into a game (this device's choice) }.
(() => {
  "use strict";
  const D = window.PupaDefenseEngine;
  const screen = document.querySelector("#defenseScreen");
  if (!D || !screen) return;

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
  const STAGES = D.STAGES.length, SQUAD = 6;
  const ROLE_ICON = { balance: "⭐", attack: "⚔️", magic: "🔮", defense: "❄️", support: "🔔" };
  const ROLE_COLOR = { balance: "#ffd76a", attack: "#ff7a7a", magic: "#c08bff", defense: "#7fd8ff", support: "#7dffb0" };

  // ---- The save ----
  function progress() {
    const s = save();
    const raw = s.defense && typeof s.defense === "object" ? s.defense : {};
    const stars = {};
    for (let n = 1; n <= STAGES; n++) { const v = Math.min(3, Math.floor(Number(raw.stars?.[n]) || 0)); if (v > 0) stars[n] = v; }
    s.defense = { stars, endless: Math.max(0, Math.floor(Number(raw.endless) || 0)), squad: Array.isArray(raw.squad) ? raw.squad.filter(x => typeof x === "string").slice(0, SQUAD) : [] };
    return s.defense;
  }
  const record = () => save().defense;
  const isOpenStage = (n) => n === 1 || (record().stars[n - 1] || 0) > 0;
  const nextStage = () => { for (let n = 1; n <= STAGES; n++) if (!record().stars[n]) return isOpenStage(n) ? n : n - 1; return STAGES; };
  const openMaps = () => D.MAPS.map((m, i) => i).filter(i => isOpenStage(i * 3 + 1));

  // every card hero and pet this player has (Pupa always), strongest first
  function roster() {
    const E = window.PupaCardsEngine, units = save().cards?.units || {};
    const cards = E?.CARDS || { pupa: { name: "Pupa", role: "balance", rarity: 2, art: "pupa", from: "hero" } };
    const list = [];
    for (const [id, c] of Object.entries(cards)) {
      if (c.from !== "hero" && c.from !== "pet") continue;
      const lv = Math.floor(Number(units[id]) || 0);
      if (id !== "pupa" && lv <= 0) continue;
      const level = Math.max(1, Math.min(100, lv || 1));
      list.push({ id, name: c.name, role: D.ROLES[c.role] ? c.role : "balance", rarity: c.rarity || 2, art: c.art || id, pet: c.from === "pet", level, power: D.cardPower(level, c.rarity || 2) });
    }
    return list.sort((a, b) => b.power - a.power || (a.id === "pupa" ? -1 : 1));
  }
  const artOf = (h) => `assets/${h.art}-${h.pet ? "pet" : "hero"}.webp`;
  // the squad: the saved one where its cards are still owned, filled up with the strongest
  function squad() {
    const all = roster(), byId = new Map(all.map(h => [h.id, h]));
    const out = record().squad.map(id => byId.get(id)).filter(Boolean);
    for (const h of all) { if (out.length >= SQUAD) break; if (!out.includes(h)) out.push(h); }
    return out.slice(0, SQUAD);
  }

  // ---- The frame ----
  const frame = el("div", "shop-card defense-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "ปกป้องสวนเชอร์รี่");
  title.id = "defenseTitle";
  const wallet = el("div", "shop-wallet");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  const homeButton = button("icon-button defense-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(homeButton, title, wallet);
  const body = el("div", "defense-body");
  frame.append(head, body);
  screen.append(frame);
  function showCoins() {
    wallet.querySelector("b").textContent = fmt(save().coins);
    wallet.querySelector(".gems").textContent = fmt(save().gems || 0);
    wallet.setAttribute("aria-label", `เหรียญ ${fmt(save().coins)} เพชร ${fmt(save().gems || 0)}`);
  }

  let isShown = false;
  let run = null;
  let chosen = 1;

  function open() {
    if (!game()) return;
    progress();
    isShown = true;
    screen.hidden = false;
    game().setDefenseOpen?.(true);
    chosen = nextStage();
    showLobby();
    tone(659, .07, "triangle", .04);
    homeButton.focus();
  }
  function goHome() {
    stopRun();
    isShown = false;
    screen.hidden = true;
    game().setDefenseOpen?.(false);
    game().showModes?.();
  }
  function key(event) {
    if (run && !run.done) {
      if (event.key === "Escape" || event.key === "p" || event.key === "P") { event.preventDefault(); if (run.picked || run.selected) { run.picked = null; run.selected = null; paintTray(); } else togglePause(); }
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (run) showLobby();
    else goHome();
  }

  // ---- Lobby ----
  function showLobby() {
    const again = Boolean(body.querySelector(".defense-cols"));
    const keepTop = again ? body.scrollTop : 0, keepPick = again ? body.querySelector(".defense-pick")?.scrollTop || 0 : 0;
    stopRun();
    showCoins();
    frame.classList.remove("is-playing");
    const r = record(), team = squad();
    if (!isOpenStage(chosen)) chosen = nextStage();

    const intro = el("section", "defense-intro");
    const pic = el("img", "defense-intro-pic");
    pic.src = "assets/pupa-hero.webp";
    pic.alt = "";
    const words = el("div", "defense-intro-words");
    words.append(el("b", null, "ส่งฮีโร่ไปยืนข้างทาง กันมอนสเตอร์ไม่ให้ถึงต้นเชอร์รี่!"),
      el("span", null, "แตะการ์ดฮีโร่ด้านล่าง แล้วแตะช่องหญ้าว่างเพื่อวาง (ใช้กลีบซากุระ 🌸) · แตะฮีโร่ที่วางแล้วเพื่ออัปเลเวลหรือขาย · ฆ่ามอนสเตอร์ได้กลีบเพิ่ม · ต้นไม้มี ❤️ 20 เหลือ 15 ขึ้นไปได้ ★★★"));
    intro.append(pic, words);

    // stages
    const stageBox = el("section", "defense-box");
    stageBox.append(el("h3", null, "เลือกด่าน"));
    const grid = el("div", "defense-stages");
    D.MAPS.forEach((map, m) => {
      const row = el("div", "defense-map");
      row.append(el("small", "defense-map-name", `${m + 1}. ${map.name}`));
      const tiles = el("div", "defense-map-tiles");
      for (let k = 0; k < 3; k++) {
        const n = m * 3 + k + 1, open = isOpenStage(n), have = r.stars[n] || 0;
        const tile = button(`defense-stage${n === chosen ? " is-on" : ""}${open ? "" : " is-locked"}`, null, () => { chosen = n; showLobby(); }, `ด่าน ${n} ${open ? `ได้ ${have} ดาว` : "ล็อกอยู่"}`);
        tile.disabled = !open;
        tile.style.setProperty("--grass", map.look.grass);
        tile.style.setProperty("--path", map.look.path);
        tile.append(el("b", null, open ? String(n) : "🔒"), el("small", null, open ? starText(have) : ""));
        tiles.append(tile);
      }
      row.append(tiles);
      grid.append(row);
    });
    const go = button("primary-button defense-go", `▶ เริ่มด่าน ${chosen}`, () => startRun({ stage: chosen }));
    // endless
    const endless = el("div", "defense-endless");
    endless.append(el("b", null, "♾️ โหมดไม่สิ้นสุด"), el("small", null, `เวฟมาไม่หยุด อยู่ได้นานแค่ไหน? สถิติ: ${r.endless} เวฟ · ทุก 5 เวฟที่เกินสถิติได้ 💎 5`));
    const maps = el("div", "defense-endless-maps");
    for (const m of openMaps()) maps.append(button("secondary-button defense-endless-go", `${m + 1}. ${D.MAPS[m].name}`, () => startRun({ endless: m })));
    endless.append(maps);
    stageBox.append(grid, go, endless);

    // the squad
    const teamBox = el("section", "defense-box");
    teamBox.append(el("h3", null, `ทีมที่นำไป (${team.length}/${SQUAD})`), el("p", "defense-note", "แตะเพื่อเลือก/เอาออก · เลเวลการ์ดสูง = แรงขึ้น · ฮีโร่ตัวเดียวกันวางซ้ำได้ (ราคาเพิ่มขึ้น)"));
    const pick = el("div", "defense-pick");
    const ids = new Set(team.map(h => h.id));
    for (const h of roster()) {
      const on = ids.has(h.id);
      const chip = button(`defense-hero${on ? " is-on" : ""}`, null, () => toggleSquad(h.id), `${h.name} ${on ? "อยู่ในทีม" : "ไม่ได้อยู่ในทีม"}`);
      const img = el("img");
      img.src = artOf(h);
      img.alt = "";
      img.loading = "lazy";
      chip.append(img, el("b", null, h.name), el("small", null, `${ROLE_ICON[h.role]} Lv ${h.level}`));
      pick.append(chip);
    }
    const roles = el("p", "defense-note", Object.entries(D.ROLES).map(([k, v]) => `${v.icon} ${v.text}`).join(" · "));
    teamBox.append(pick, roles);

    const cols = el("div", "defense-cols");
    cols.append(stageBox, teamBox);
    body.replaceChildren(intro, cols);
    body.scrollTop = keepTop;
    pick.scrollTop = keepPick;
  }
  function toggleSquad(id) {
    const r = record(), team = squad().map(h => h.id);
    if (team.includes(id)) { if (team.length > 1) r.squad = team.filter(x => x !== id); }
    else r.squad = [...team.slice(0, SQUAD - 1), id];
    store();
    tone(660, .04, "triangle", .03);
    showLobby();
  }

  // ---- Pictures ----
  const pics = new Map();
  function sprite(src, size) {
    const key = src + "@" + size;
    if (pics.has(key)) return pics.get(key);
    const entry = { ready: false, canvas: null, w: 0, h: 0 };
    pics.set(key, entry);
    const img = new Image();
    img.onload = () => {
      const scale = size / Math.max(img.naturalWidth, img.naturalHeight);
      const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(img, 0, 0, w, h);
      Object.assign(entry, { ready: true, canvas: c, w, h });
    };
    img.src = src;
    return entry;
  }

  // ---- Playing ----
  function startRun(opts) {
    if (opts.stage && !isOpenStage(opts.stage)) return;
    stopRun();
    const state = D.create({ ...opts, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
    const view = el("section", "defense-play");
    const bar = el("div", "defense-bar");
    const waveText = el("b", "defense-wave");
    const hearts = el("span", "defense-hearts");
    const petals = el("span", "defense-petals");
    const speed = button("secondary-button defense-speed", "▶ x1", () => { run.speed = run.speed === 1 ? 2 : 1; speed.textContent = run.speed === 1 ? "▶ x1" : "▶▶ x2"; });
    const pause = button("icon-button defense-pause", "⏸", () => togglePause(), "หยุดชั่วคราว");
    bar.append(waveText, hearts, petals, speed, pause);
    const field = el("div", "defense-field");
    const canvas = el("canvas", "defense-canvas");
    canvas.setAttribute("aria-label", "สนาม แตะช่องว่างเพื่อวางฮีโร่ที่เลือก หรือแตะฮีโร่เพื่อดูรายละเอียด");
    const call = button("primary-button defense-call", "", () => callWave());
    const banner = el("p", "defense-banner");
    field.append(canvas, call, banner);
    const tray = el("div", "defense-tray");
    view.append(bar, field, tray);
    body.replaceChildren(view);
    frame.classList.add("is-playing");
    const map = state.map;
    run = {
      opts, state, view, canvas, ctx: canvas.getContext("2d"), field, tray, call, banner, ui: { waveText, hearts, petals },
      team: squad(), picked: null, selected: null, speed: 1, paused: false, done: false, raf: 0, last: 0, acc: 0,
      cell: 40, ox: 0, oy: 0, flip: false, dpr: 1, w: 0, h: 0, shots: [], floats: [], rings: [], bannerUntil: 0, lastHit: 0, trayKey: ""
    };
    run.heroPics = Object.fromEntries(run.team.map(h => [h.art, sprite(artOf(h), 128)]));
    run.foePics = Object.fromEntries([...map.foes.map(id => [id, sprite(`assets/foe-${id}.webp`, 96)]), [map.boss, sprite(`assets/boss-${map.boss}.webp`, 200)]]);
    run.deco = decoFor(state);
    fit();
    window.addEventListener("resize", fit);
    canvas.addEventListener("pointerdown", onTapField);
    paintTray();
    showBanner(opts.endless != null ? `♾️ ไม่สิ้นสุด · ${map.name}` : `ด่าน ${opts.stage} · ${map.name}`, 2.2);
    run.raf = requestAnimationFrame(loop);
  }
  function stopRun() {
    if (!run) return;
    cancelAnimationFrame(run.raf);
    window.removeEventListener("resize", fit);
    run = null;
  }
  // the field as big as it fits; standing up on tall screens
  function fit() {
    const r = run;
    if (!r) return;
    const box = r.field.getBoundingClientRect();
    r.w = Math.max(1, box.width); r.h = Math.max(1, box.height);
    r.dpr = Math.min(2, window.devicePixelRatio || 1);
    r.canvas.width = Math.round(r.w * r.dpr); r.canvas.height = Math.round(r.h * r.dpr);
    r.flip = r.h > r.w * 1.05;
    const gw = r.flip ? D.ROWS : D.COLS, gh = r.flip ? D.COLS : D.ROWS;
    r.cell = Math.max(10, Math.floor(Math.min(r.w / gw, r.h / gh)));
    r.ox = Math.round((r.w - gw * r.cell) / 2); r.oy = Math.round((r.h - gh * r.cell) / 2);
  }
  // field cells (x across 12, y down 7) to screen pixels and back
  const toScreen = (x, y) => (run.flip ? [run.ox + y * run.cell, run.oy + x * run.cell] : [run.ox + x * run.cell, run.oy + y * run.cell]);
  function toCell(px, py) {
    const a = (px - run.ox) / run.cell, b = (py - run.oy) / run.cell;
    const [x, y] = run.flip ? [b, a] : [a, b];
    return [Math.floor(x), Math.floor(y)];
  }
  // flowers and stones on the grass, the same each game
  function decoFor(s) {
    const out = [];
    let a = s.def.map * 7919 + 13;
    const rnd = () => ((a = (a * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let c = 0; c < D.COLS; c++) for (let r = 0; r < D.ROWS; r++) {
      if (!D.isPad(s.lay, c, r) || rnd() > .45) continue;
      out.push({ x: c + .2 + rnd() * .6, y: r + .2 + rnd() * .6, k: Math.floor(rnd() * 3) });
    }
    return out;
  }

  // ---- Tapping the field ----
  function onTapField(event) {
    const r = run;
    if (!r || r.done || r.paused) return;
    const b = r.canvas.getBoundingClientRect();
    const [c, rr] = toCell(event.clientX - b.left, event.clientY - b.top);
    const s = r.state;
    const t = s.towers.find(x => x.c === c && x.r === rr);
    if (t) { r.selected = r.selected === t.uid ? null : t.uid; r.picked = null; tone(660, .03, "triangle", .02); paintTray(); return; }
    if (r.picked) {
      const hero = r.team.find(h => h.id === r.picked);
      const res = D.place(s, hero, c, rr);
      if (res.error === "petals") { tone(196, .08, "triangle", .04); showBanner("กลีบซากุระไม่พอ 🌸", 1.2); return; }
      if (res.error) { tone(196, .06, "triangle", .03); return; }
      tone(784, .06, "triangle", .04); tone(988, .07, "triangle", .04, .05);
      r.rings.push({ x: c + .5, y: rr + .5, life: .4, color: ROLE_COLOR[hero.role] });
      if (s.petals < D.costFor(s, hero)) r.picked = null;
      paintTray();
      return;
    }
    if (r.selected) { r.selected = null; paintTray(); }
  }

  // ---- The tray: the squad, or the chosen hero's card ----
  function paintTray() {
    const r = run, s = r.state;
    const t = r.selected ? s.towers.find(x => x.uid === r.selected) : null;
    const key = t ? `t${t.uid}:${t.lv}:${s.petals >= (t.lv < 3 ? D.upCost(t) : 1e9)}` : `p${r.picked}:` + r.team.map(h => s.petals >= D.costFor(s, h) ? 1 : 0).join("") + r.team.map(h => D.costFor(s, h)).join(",");
    if (key === r.trayKey) return;
    r.trayKey = key;
    if (t) {
      const h = r.team.find(x => x.id === t.id) || { name: t.id, role: t.role };
      const st = D.towerStats(t), role = D.ROLES[t.role];
      const card = el("div", "defense-tower");
      const img = el("img");
      img.src = artOf(h);
      img.alt = "";
      const words = el("div");
      words.append(el("b", null, `${h.name} · Lv ${t.lv}/3`), el("small", null, `${role.icon} ${role.name} · ดาเมจ ${Math.round(st.dmg)} · ระยะ ${st.range.toFixed(1)} ช่อง${st.slow ? ` · ช้าลง ${Math.round(st.slow * 100)}%` : ""}${st.buff ? ` · เพื่อนแรงขึ้น ${Math.round(st.buff * 100)}%` : ""}${st.splash ? ` · วงระเบิด ${st.splash.toFixed(1)}` : ""}${st.crit ? ` · คริ ${Math.round(st.crit * 100)}%` : ""}`));
      const up = button("primary-button defense-up", t.lv < 3 ? `⬆ อัป 🌸 ${D.upCost(t)}` : "เลเวลสูงสุด", () => { const res = D.upgrade(s, t.uid); if (!res.error) { tone(988, .08, "triangle", .045); tone(1319, .1, "triangle", .04, .07); r.rings.push({ x: t.x, y: t.y, life: .5, color: "#ffd76a" }); r.trayKey = ""; paintTray(); } });
      up.disabled = t.lv >= 3 || s.petals < D.upCost(t);
      const sellIt = button("secondary-button defense-sell", `ขาย +🌸 ${D.refund(t)}`, () => { D.sell(s, t.uid); r.selected = null; tone(523, .06, "triangle", .035); paintTray(); });
      const close = button("icon-button defense-close", "✕", () => { r.selected = null; paintTray(); }, "ปิด");
      card.append(img, words, up, sellIt, close);
      r.tray.replaceChildren(card);
      return;
    }
    r.tray.replaceChildren(...r.team.map(h => {
      const cost = D.costFor(s, h), afford = s.petals >= cost;
      const chip = button(`defense-chip${r.picked === h.id ? " is-on" : ""}${afford ? "" : " is-poor"}`, null, () => { r.picked = r.picked === h.id ? null : h.id; r.selected = null; r.trayKey = ""; paintTray(); if (r.picked) showBanner("แตะช่องหญ้าว่างเพื่อวาง", 1.4); }, `${h.name} ราคา ${cost} กลีบ`);
      chip.style.setProperty("--role", ROLE_COLOR[h.role]);
      const img = el("img");
      img.src = artOf(h);
      img.alt = "";
      chip.append(img, el("span", "defense-chip-role", ROLE_ICON[h.role]), el("b", null, `🌸 ${cost}`));
      return chip;
    }));
  }

  // ---- Waves ----
  function callWave() {
    const r = run;
    if (!r || r.done) return;
    const res = D.callWave(r.state);
    if (res.error) return;
    if (res.early) showBanner(`เรียกก่อนเวลา +🌸 ${res.early}`, 1.2);
    tone(392, .1, "sawtooth", .03); tone(523, .12, "sawtooth", .03, .1);
  }
  function showBanner(text, sec) {
    const r = run;
    r.banner.textContent = text;
    r.banner.classList.add("is-on");
    r.bannerUntil = performance.now() + sec * 1000;
  }

  // ---- The loop ----
  function loop(now) {
    const r = run;
    if (!r) return;
    r.raf = requestAnimationFrame(loop);
    const dt = r.last ? Math.min(.1, (now - r.last) / 1000) : 0;
    r.last = now;
    if (!r.paused && !r.done) {
      r.acc += dt * r.speed;
      let n = 0;
      while (r.acc >= D.STEP && n++ < 12) { D.step(r.state); r.acc -= D.STEP; if (r.state.over) break; }
      if (n >= 12) r.acc = 0;
      sparkle(D.takeFx(r.state));
      if (r.state.over) finish();
    }
    paintBar();
    paintTray();
    draw(dt);
  }
  function sparkle(list) {
    const r = run, t = performance.now();
    let shots = 0;
    for (const f of list) {
      if (f.k === "shot") { shots++; if (r.shots.length < 80) r.shots.push({ ...f, life: .16, max: .16 }); }
      else if (f.k === "frost") { if (r.rings.length < 40) r.rings.push({ x: f.x, y: f.y, life: .35, R: f.R, frost: true }); }
      else if (f.k === "kill") { if (r.floats.length < 30) r.floats.push({ x: f.x, y: f.y, text: `+${f.petals}🌸`, life: .8 }); if (f.boss) { showBanner("👑 ล้มบอสได้!", 1.8); [784, 988, 1175].forEach((note, i) => tone(note, .1, "sine", .045, i * .07)); } }
      else if (f.k === "leak") { tone(140, .12, "square", .04); r.hurt = .35; }
      else if (f.k === "wave") { showBanner(f.last ? `เวฟสุดท้าย! บอสมาแล้ว 🔥` : `เวฟ ${f.n}`, 1.6); }
      else if (f.k === "cleared") { showBanner(`ผ่านเวฟ ${f.n}! +🌸 ${f.bonus}`, 1.6); [659, 880].forEach((note, i) => tone(note, .08, "triangle", .04, i * .07)); }
    }
    if (shots && t - r.lastHit > 90) { r.lastHit = t; tone(700 + Math.random() * 200, .025, "triangle", .015); }
  }
  function paintBar() {
    const r = run, s = r.state, u = r.ui;
    u.waveText.textContent = s.endless ? `♾️ เวฟ ${s.wave}` : `เวฟ ${s.wave}/${s.waves}`;
    u.hearts.textContent = `❤️ ${s.hearts}`;
    u.hearts.classList.toggle("is-low", s.hearts <= 5);
    u.petals.textContent = `🌸 ${fmt(s.petals)}`;
    const waiting = s.wave === 0 || (s.breakLeft > 0 && !s.endless);
    r.call.hidden = !waiting || r.done;
    if (waiting) r.call.textContent = s.wave === 0 ? "▶ เริ่มเวฟ 1" : `▶ เวฟ ${s.wave + 1} (${Math.ceil(s.breakLeft)}) +🌸${Math.floor(s.breakLeft * 2)}`;
    if (r.bannerUntil && performance.now() > r.bannerUntil) { r.banner.classList.remove("is-on"); r.bannerUntil = 0; }
  }

  // ---- Drawing ----
  function draw(dt) {
    const r = run, s = r.state, g = r.ctx, z = r.cell, time = performance.now() / 1000;
    g.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    const look = s.map.look;
    g.fillStyle = "#24341f";
    g.fillRect(0, 0, r.w, r.h);
    // grass and path, cell by cell
    for (let c = 0; c < D.COLS; c++) for (let rr = 0; rr < D.ROWS; rr++) {
      const [x, y] = toScreen(c, rr);
      const path = s.lay.onPath.has(c + "," + rr);
      g.fillStyle = path ? ((c + rr) % 2 ? look.path : look.path2) : ((c + rr) % 2 ? look.grass : look.grass2);
      g.fillRect(x, y, z + .5, z + .5);
    }
    // a soft edge along the path
    g.strokeStyle = "rgba(0,0,0,.12)";
    g.lineWidth = Math.max(2, z * .08);
    g.lineJoin = "round";
    g.beginPath();
    s.lay.pts.forEach(([x, y], i) => { const [sx, sy] = toScreen(x, y); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
    g.stroke();
    // flowers on the grass
    for (const d of r.deco) {
      const [x, y] = toScreen(d.x, d.y);
      if (d.k === 0) { g.fillStyle = "rgba(255,190,220,.85)"; for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * z * .05, y + Math.sin(a) * z * .05, z * .045, 0, Math.PI * 2); g.fill(); } g.fillStyle = "#ffe08a"; g.beginPath(); g.arc(x, y, z * .03, 0, Math.PI * 2); g.fill(); }
      else if (d.k === 1) { g.strokeStyle = "rgba(40,90,30,.5)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x - z * .05, y - z * .12); g.moveTo(x + z * .04, y); g.lineTo(x + z * .06, y - z * .13); g.stroke(); }
      else { g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(x, y, z * .07, z * .045, 0, 0, Math.PI * 2); g.fill(); }
    }
    // where they come in: a swirling gate
    const [gx, gy] = toScreen(...s.lay.pts[0].map((v, i) => Math.max(.3, Math.min((i ? D.ROWS : D.COLS) - .3, v))));
    g.save();
    g.translate(gx, gy);
    g.rotate(time * 2);
    g.fillStyle = "rgba(120,60,180,.55)";
    g.beginPath(); g.arc(0, 0, z * .42, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(220,170,255,.9)"; g.lineWidth = 3;
    g.beginPath(); g.arc(0, 0, z * .3, 0, Math.PI * 1.4); g.stroke();
    g.restore();
    // pads to stand on, while a hero is picked
    if (r.picked) {
      g.fillStyle = "rgba(255,255,255,.22)";
      g.strokeStyle = "rgba(255,255,255,.55)";
      g.lineWidth = 1;
      for (let c = 0; c < D.COLS; c++) for (let rr = 0; rr < D.ROWS; rr++) if (D.canPlace(s, c, rr)) { const [x, y] = toScreen(c, rr); g.fillRect(x + z * .12, y + z * .12, z * .76, z * .76); g.strokeRect(x + z * .12, y + z * .12, z * .76, z * .76); }
    }
    // the cherry tree
    drawTree(g, s, z, time);
    // ranges: the chosen hero's
    const sel = r.selected ? s.towers.find(t => t.uid === r.selected) : null;
    if (sel) {
      const [x, y] = toScreen(sel.x, sel.y), R = D.towerStats(sel).range * z;
      g.fillStyle = "rgba(255,255,255,.12)"; g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // heroes
    for (const t of s.towers) {
      const [x, y] = toScreen(t.x, t.y);
      g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(x, y + z * .3, z * .34, z * .12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = ROLE_COLOR[t.role]; g.globalAlpha = .55;
      g.beginPath(); g.ellipse(x, y + z * .28, z * .38, z * .15, 0, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
      const pic = r.heroPics[t.art];
      const h = z * .95;
      if (pic?.ready) { const w = h * pic.w / pic.h; g.drawImage(pic.canvas, x - w / 2, y + z * .32 - h, w, h); }
      else { g.fillStyle = "#ff9ec4"; g.beginPath(); g.arc(x, y, z * .3, 0, Math.PI * 2); g.fill(); }
      // its level
      g.font = `900 ${Math.max(9, z * .2)}px system-ui, sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = "#fff"; g.strokeStyle = "rgba(40,20,60,.9)"; g.lineWidth = 3;
      const stars = "★".repeat(t.lv);
      g.strokeText(stars, x, y + z * .42); g.fillText(stars, x, y + z * .42);
    }
    // monsters
    const foes = [...s.enemies].sort((a, b) => a.y - b.y);
    for (const e of foes) {
      const [x, y] = toScreen(e.x, e.y), size = e.boss ? z * 1.3 : z * .72;
      g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(x, y + size * .35, size * .38, size * .12, 0, 0, Math.PI * 2); g.fill();
      const pic = r.foePics[e.art];
      const bob = calm() ? 0 : Math.abs(Math.sin(time * 8 + e.id)) * z * .04;
      if (pic?.ready) {
        const w = size * pic.w / pic.h;
        g.save();
        if (e.flash > 0) g.filter = "brightness(2)";
        g.drawImage(pic.canvas, x - w / 2, y + size * .4 - size - bob, w, size);
        g.restore();
      } else { g.fillStyle = "#c36"; g.beginPath(); g.arc(x, y, size * .35, 0, Math.PI * 2); g.fill(); }
      if (e.slow > 0) { g.fillStyle = "rgba(127,216,255,.35)"; g.beginPath(); g.arc(x, y - size * .1, size * .42, 0, Math.PI * 2); g.fill(); }
      const f = Math.max(0, e.hp / e.maxHp), bw = e.boss ? z * 1.1 : z * .6;
      g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(x - bw / 2, y - size * .7, bw, Math.max(3, z * .07));
      g.fillStyle = f > .5 ? "#6dff9a" : f > .25 ? "#ffd166" : "#ff5d73";
      g.fillRect(x - bw / 2, y - size * .7, bw * f, Math.max(3, z * .07));
    }
    // shots
    for (const sh of r.shots) {
      sh.life -= dt * r.speed;
      const p = 1 - Math.max(0, sh.life) / sh.max;
      const [x0, y0] = toScreen(...sh.from), [x1, y1] = toScreen(...sh.to);
      const x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p;
      if (sh.role === "attack") {
        g.strokeStyle = sh.crit ? "rgba(255,90,90,.95)" : "rgba(255,255,255,.9)"; g.lineWidth = sh.crit ? 4 : 3;
        g.beginPath(); g.arc(x1, y1, z * .28, -1 + p * 2, .4 + p * 2); g.stroke();
      } else if (sh.role === "magic") {
        g.fillStyle = "rgba(192,139,255,.9)"; g.beginPath(); g.arc(x, y, z * .12, 0, Math.PI * 2); g.fill();
        if (p > .8) { g.strokeStyle = "rgba(192,139,255,.6)"; g.lineWidth = 3; g.beginPath(); g.arc(x1, y1, sh.R * z * p, 0, Math.PI * 2); g.stroke(); }
      } else {
        g.fillStyle = sh.role === "support" ? "rgba(125,255,176,.95)" : "rgba(255,230,120,.95)";
        g.beginPath(); g.arc(x, y, z * .09, 0, Math.PI * 2); g.fill();
      }
    }
    r.shots = r.shots.filter(sh => sh.life > 0);
    for (const ring of r.rings) {
      ring.life -= dt;
      const [x, y] = toScreen(ring.x, ring.y), f = Math.max(0, ring.life / (ring.frost ? .35 : .5));
      g.strokeStyle = ring.frost ? `rgba(127,216,255,${f * .8})` : ring.color || "#fff";
      g.globalAlpha = ring.frost ? 1 : f;
      g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, (ring.frost ? ring.R * (1 - f * .5) : .3 + (1 - f) * .5) * z, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
    }
    r.rings = r.rings.filter(x => x.life > 0);
    g.font = `900 ${Math.max(11, z * .24)}px system-ui, sans-serif`;
    g.textAlign = "center";
    for (const fl of r.floats) {
      fl.life -= dt; fl.y -= dt * .6;
      const [x, y] = toScreen(fl.x, fl.y);
      g.globalAlpha = Math.max(0, Math.min(1, fl.life / .4));
      g.fillStyle = "#fff"; g.strokeStyle = "rgba(90,20,60,.9)"; g.lineWidth = 3;
      g.strokeText(fl.text, x, y - z * .4); g.fillText(fl.text, x, y - z * .4);
    }
    g.globalAlpha = 1;
    r.floats = r.floats.filter(x => x.life > 0);
    if (r.hurt > 0) {
      r.hurt -= dt;
      g.fillStyle = `rgba(255,40,80,${r.hurt * .5})`;
      g.fillRect(0, 0, r.w, r.h);
    }
  }
  function drawTree(g, s, z, time) {
    const [c, rr] = s.lay.tree, [x, y] = toScreen(c + .5, rr + .5);
    g.fillStyle = "rgba(0,0,0,.25)"; g.beginPath(); g.ellipse(x, y + z * .4, z * .5, z * .14, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#7a4a2a"; g.fillRect(x - z * .08, y - z * .05, z * .16, z * .45);
    const sway = calm() ? 0 : Math.sin(time * 1.5) * z * .02;
    for (const [dx, dy, rad, col] of [[-.22, -.15, .3, "#ffb3d1"], [.22, -.15, .3, "#ff9ec4"], [0, -.38, .34, "#ffc4dc"], [0, -.08, .28, "#ffd6e6"]]) {
      g.fillStyle = col; g.beginPath(); g.arc(x + dx * z + sway, y + dy * z, rad * z, 0, Math.PI * 2); g.fill();
    }
    g.font = `900 ${Math.max(10, z * .22)}px system-ui, sans-serif`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#fff"; g.strokeStyle = "rgba(120,20,60,.9)"; g.lineWidth = 3;
    const text = `❤️${s.hearts}`;
    g.strokeText(text, x, y - z * .82); g.fillText(text, x, y - z * .82);
  }

  // ---- Pause and the end ----
  function togglePause(force) {
    const r = run;
    if (!r || r.done) return;
    r.paused = force === true ? true : !r.paused;
    r.view.querySelector(".defense-cover.is-pause")?.remove();
    if (r.paused) {
      const box = el("div", "defense-cover is-pause");
      box.append(el("h3", null, "⏸ หยุดชั่วคราว"));
      const actions = el("div", "title-actions");
      actions.append(button("primary-button", "▶ เล่นต่อ", () => togglePause(false)), button("secondary-button", "ยอมแพ้", () => { r.state.over = true; r.giveUp = true; togglePause(false); finish(); }));
      box.append(actions);
      r.view.append(box);
      box.querySelector("button")?.focus();
    } else r.last = 0;
  }
  function finish() {
    const r = run;
    if (!r || r.done) return;
    r.done = true;
    r.call.hidden = true;
    const s = r.state, rec = record();
    const box = el("div", "defense-cover");
    const parts = [];
    let toCards = false;
    const payOut = (reward) => {
      save().coins += reward.coins;
      save().gems = (save().gems || 0) + reward.gems;
      const cards = save().cards;
      toCards = cards && typeof cards === "object" && typeof cards.dust === "number" && typeof cards.ore === "number";
      if (toCards) { cards.dust += reward.dust || 0; cards.ore += reward.ore || 0; }
      parts.push(`● ${fmt(reward.coins)}`);
      if (reward.gems) parts.push(`💎 ${reward.gems}`);
      if (toCards && reward.dust) parts.push(`✧ ${reward.dust}`);
      if (toCards && reward.ore) parts.push(`⛏ ${reward.ore}`);
    };
    if (s.endless) {
      const held = Math.max(0, s.wave - 1), best = rec.endless;
      payOut(D.endlessReward(held, best));
      rec.endless = Math.max(best, held);
      box.append(el("span", "defense-medal", "♾️"), el("h3", null, `อยู่รอด ${held} เวฟ`), el("p", null, held > best ? "สถิติใหม่!" : `สถิติ ${best} เวฟ`), el("p", "defense-reward", `ได้รับ ${parts.join(" · ")}`));
    } else {
      const n = r.opts.stage, before = rec.stars[n] || 0, got = D.starsFor(s);
      if (got) {
        payOut(D.rewardFor(n, !before, got, before));
        if (got > before) rec.stars[n] = got;
      }
      box.append(el("span", "defense-medal", s.won ? "🌸" : "🍂"), el("h3", null, s.won ? `ปกป้องสวนได้! ด่าน ${n}` : r.giveUp ? "ยอมแพ้แล้ว" : "ต้นเชอร์รี่ล้ม..."),
        el("p", "defense-stars", starText(got)), el("p", null, `❤️ เหลือ ${s.hearts}/${D.HEARTS} · กำจัด ${fmt(s.kills)} ตัว · เวฟ ${s.wave}/${s.waves}`));
      if (parts.length) box.append(el("p", "defense-reward", `ได้รับ ${parts.join(" · ")}`));
      box.append(el("p", "defense-tip", s.won ? (got < 3 ? "รักษาหัวใจต้นไม้ให้เหลือ 15 ขึ้นไป เพื่อได้ ★★★" : "ได้ครบ 3 ดาว!") : "ลองวางฮีโร่ตรงหัวโค้ง และอัปเลเวลฮีโร่ที่ยืนดีที่สุด หรืออัปการ์ดในศึกการ์ดให้แรงขึ้น"));
    }
    store();
    showCoins();
    if (s.won) [659, 784, 988, 1319].forEach((note, i) => tone(note, .14, "sine", .05, i * .1));
    else [392, 330, 262].forEach((note, i) => tone(note, .16, "triangle", .045, i * .14));
    const actions = el("div", "title-actions");
    if (!s.endless && s.won && r.opts.stage < STAGES) actions.append(button("primary-button", `ด่าน ${r.opts.stage + 1} ▶`, () => { chosen = r.opts.stage + 1; startRun({ stage: chosen }); }));
    actions.append(button(!s.endless && s.won && r.opts.stage < STAGES ? "secondary-button" : "primary-button", "เล่นอีกครั้ง", () => startRun(r.opts)), button("secondary-button", "กลับหน้าหลัก", () => showLobby()));
    box.append(actions);
    r.view.append(box);
    announce(s.endless ? `อยู่รอด ${Math.max(0, s.wave - 1)} เวฟ` : s.won ? `ผ่านด่าน ${r.opts.stage}` : "ต้นเชอร์รี่ล้ม");
    box.querySelector("button")?.focus();
  }

  // `run` is read by the browser tests to play
  window.PupaDefense = { open, close: goHome, key, get isOpen() { return isShown; }, get run() { return run ? { state: run.state, team: run.team, flip: run.flip } : null; } };
  // Test link: ?defense opens straight into defending the cherry garden.
  if (new URLSearchParams(location.search).has("defense")) setTimeout(() => open(), 400);
})();

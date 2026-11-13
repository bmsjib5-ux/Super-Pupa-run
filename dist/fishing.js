// ตกปลาทะเลสาบจันทร์ (moon lake fishing): the screen. The fish, the bite and
// the reeling live in fishing-engine.js; game.js lends the save, sounds and
// coins through window.PupaGame and keeps its own keys quiet while this is open.
//
// save.fishing = { caught: { fish: times }, best: { fish: tenths of a cm },
// gear: { rod, line, bait }, total: fish landed }.
(() => {
  "use strict";
  const F = window.PupaFishingEngine;
  const screen = document.querySelector("#fishingScreen");
  if (!F || !screen) return;

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
  const stars = (n) => "★".repeat(n);
  // ?fishtime=night tries another hour of the day
  const forcedSlot = new URLSearchParams(location.search).get("fishtime");
  const slotNow = () => (F.SLOTS.includes(forcedSlot) ? forcedSlot : F.slotAt());
  const SKY = {
    dawn: ["#ffcfa8", "#ffb3c8", "#a8c8ff"], day: ["#7fc8ff", "#a8dcff", "#d8f0ff"],
    dusk: ["#ff9a5e", "#d86aa8", "#5a4a9a"], night: ["#0d1240", "#1e1f5e", "#3a2f7a"]
  };
  const WATER = { dawn: ["#7fb0d8", "#4a7fb0"], day: ["#4fb0e0", "#2a7fb8"], dusk: ["#6a5a9a", "#3a3070"], night: ["#1a2a6a", "#0a1238"] };

  // ---- The save ----
  function progress() {
    const s = save();
    const raw = s.fishing && typeof s.fishing === "object" ? s.fishing : {};
    const caught = {}, best = {};
    for (const f of F.FISH) {
      const c = Math.floor(Number(raw.caught?.[f.id]) || 0), b = Math.floor(Number(raw.best?.[f.id]) || 0);
      if (c > 0) caught[f.id] = c;
      if (b > 0) best[f.id] = b;
    }
    s.fishing = { caught, best, gear: F.gearOf(raw.gear), total: Math.max(0, Math.floor(Number(raw.total) || 0)) };
    return s.fishing;
  }
  const album = () => save().fishing;
  const pay = (r) => {
    const s = save();
    s.coins += r.coins || 0;
    s.gems = (s.gems || 0) + (r.gems || 0);
    const cards = s.cards;
    const toCards = cards && typeof cards === "object" && typeof cards.dust === "number" && typeof cards.ore === "number";
    if (toCards) cards.dust += r.dust || 0;
    return toCards;
  };

  // ---- Drawing a fish ----
  // facing right, centred on (x, y), len long; dark for one not yet caught
  function drawFish(g, fish, x, y, len, dark = false, wiggle = 0) {
    const L = fish.look;
    if (L.emoji) {
      g.save();
      g.font = `${Math.round(len * .9)}px system-ui, sans-serif`;
      g.textAlign = "center"; g.textBaseline = "middle";
      if (dark) g.filter = "brightness(0) opacity(.55)";
      g.fillStyle = "#fff";
      g.fillText(L.emoji, x, y);
      g.restore();
      return;
    }
    const ratio = { slim: .34, round: .56, long: .3, fan: .44, eel: .15, cat: .32, angel: .9, ray: .7 }[L.shape] || .45;
    const w = len, h = len * ratio;
    const body = dark ? "#1d1838" : L.body, fin = dark ? "#15122a" : L.fin;
    g.save();
    g.translate(x, y);
    g.rotate(wiggle);
    // tail
    g.fillStyle = fin;
    g.beginPath();
    if (L.shape === "ray") { g.moveTo(-w * .3, 0); g.lineTo(-w * .75, 0); g.lineWidth = Math.max(2, len * .03); g.strokeStyle = fin; g.stroke(); }
    else if (L.shape === "eel") { g.moveTo(-w * .45, 0); g.lineTo(-w * .62, -h * .9); g.lineTo(-w * .62, h * .9); }
    else { const t = L.shape === "fan" ? 1.5 : 1; g.moveTo(-w * .4, 0); g.lineTo(-w * .62, -h * .55 * t); g.quadraticCurveTo(-w * .5, 0, -w * .62, h * .55 * t); }
    g.closePath(); g.fill();
    // fins
    if (L.shape !== "eel" && L.shape !== "ray") {
      g.beginPath(); g.moveTo(-w * .1, -h * .4); g.quadraticCurveTo(w * .02, -h * (L.shape === "angel" ? 1.15 : .85), w * .16, -h * .38); g.fill();
      if (L.shape === "angel") { g.beginPath(); g.moveTo(-w * .1, h * .4); g.quadraticCurveTo(w * .02, h * 1.15, w * .16, h * .38); g.fill(); }
    }
    // body
    g.fillStyle = body;
    g.beginPath();
    if (L.shape === "ray") { g.moveTo(w * .4, 0); g.quadraticCurveTo(0, -h * .9, -w * .35, 0); g.quadraticCurveTo(0, h * .9, w * .4, 0); }
    else g.ellipse(0, 0, w * .45, h / 2, 0, 0, Math.PI * 2);
    g.fill();
    // its pattern
    if (!dark) {
      g.save();
      g.clip();
      const p = L.pattern;
      if (p === "stripes") { g.fillStyle = "rgba(0,0,0,.18)"; for (let i = -2; i <= 2; i++) g.fillRect(i * w * .13 - w * .02, -h, w * .05, h * 2); }
      if (p === "spots") { g.fillStyle = "rgba(0,0,0,.2)"; for (const [a, b] of [[-.2, -.15], [0, .12], [.12, -.1], [-.08, .05], [.22, .08]]) { g.beginPath(); g.arc(a * w, b * h * 2, w * .04, 0, Math.PI * 2); g.fill(); } }
      if (p === "scales") { g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = Math.max(1, w * .012); for (let i = -3; i <= 2; i++) for (let j = -1; j <= 1; j++) { g.beginPath(); g.arc(i * w * .1, j * h * .35, w * .05, -1.2, 1.2); g.stroke(); } }
      if (p === "stars") { g.fillStyle = "#ffe08a"; for (const [a, b] of [[-.25, -.1], [-.05, .15], [.1, -.12], [.2, .1], [-.15, .2]]) { g.beginPath(); g.arc(a * w, b * h * 2, w * .025, 0, Math.PI * 2); g.fill(); } }
      if (p === "koi") { g.fillStyle = L.fin; for (const [a, b, r] of [[-.15, -.1, .12], [.12, .08, .1], [-.3, .1, .07]]) { g.beginPath(); g.ellipse(a * w, b * h * 2, r * w, r * w * .7, 0, 0, Math.PI * 2); g.fill(); } }
      if (p === "rainbow") { ["#ff7ab8", "#ffd23a", "#7dffb0", "#7fd8ff"].forEach((c, i) => { g.fillStyle = c; g.globalAlpha = .45; g.fillRect(-w / 2, -h / 2 + i * h / 4, w, h / 4); }); g.globalAlpha = 1; }
      if (p === "moon") { g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.arc(-w * .05, 0, h * .3, 0, Math.PI * 2); g.fill(); g.fillStyle = body; g.beginPath(); g.arc(w * .03, -h * .05, h * .26, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = "rgba(255,255,255,.25)";
      g.beginPath(); g.ellipse(w * .05, -h * .22, w * .25, h * .1, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      // eye
      g.fillStyle = "#fff"; g.beginPath(); g.arc(w * .3, -h * .1, Math.max(2, h * .14), 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1a1030"; g.beginPath(); g.arc(w * .32, -h * .1, Math.max(1, h * .08), 0, Math.PI * 2); g.fill();
      if (L.shape === "cat") { g.strokeStyle = "#3a3a40"; g.lineWidth = Math.max(1, w * .015); g.beginPath(); g.moveTo(w * .42, h * .05); g.lineTo(w * .62, -h * .2); g.moveTo(w * .42, h * .1); g.lineTo(w * .62, h * .3); g.stroke(); }
    }
    g.restore();
  }
  // a small picture of a fish as an image, for the covers
  function fishPicture(fish, size, dark = false) {
    const c = document.createElement("canvas"), dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.height = size * dpr;
    c.style.width = c.style.height = `${size}px`;
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    drawFish(g, fish, size / 2, size / 2, size * (fish.look.emoji ? .9 : .82), dark);
    return c;
  }

  // ---- The frame ----
  const frame = el("div", "shop-card fishing-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "ตกปลาทะเลสาบจันทร์");
  title.id = "fishingTitle";
  const wallet = el("div", "shop-wallet");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  const homeButton = button("icon-button fishing-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(homeButton, title, wallet);
  const body = el("div", "fishing-body");
  const bar = el("div", "fishing-bar");
  const slotChip = el("span", "fishing-chip");
  const featuredChip = el("span", "fishing-chip fishing-featured");
  const albumButton = button("secondary-button fishing-album-button", "📖", () => openAlbum());
  const gearButton = button("secondary-button fishing-gear-button", "🎒 อุปกรณ์", () => openGear());
  bar.append(slotChip, featuredChip, albumButton, gearButton);
  const stage = el("div", "fishing-stage");
  const canvas = el("canvas", "fishing-canvas");
  canvas.setAttribute("aria-label", "ทะเลสาบ กดค้างเพื่อเหวี่ยงเบ็ด ปล่อยเพื่อโยน");
  canvas.tabIndex = 0;
  const say = el("p", "fishing-say");
  say.setAttribute("aria-live", "polite");
  stage.append(canvas, say);
  body.append(bar, stage);
  frame.append(head, body);
  screen.append(frame);
  function showCoins() {
    wallet.querySelector("b").textContent = fmt(save().coins);
    wallet.querySelector(".gems").textContent = fmt(save().gems || 0);
    wallet.setAttribute("aria-label", `เหรียญ ${fmt(save().coins)} เพชร ${fmt(save().gems || 0)}`);
  }
  function paintBar() {
    const slot = slotNow(), fid = F.featured(), f = F.BY_ID[fid];
    slotChip.textContent = F.SLOT_NAME[slot];
    featuredChip.textContent = `ปลาเด่นวันนี้: ${f.name} ×3 เหรียญ`;
    albumButton.textContent = `📖 ${Object.keys(album().caught).length}/${F.FISH.length}`;
  }

  let isShown = false;
  // the game's moment: idle, charging, flying, waiting, biting, fighting, done
  let play = null;
  let raf = 0, cover = null;
  const rand = F.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);

  function open() {
    if (!game()) return;
    progress();
    isShown = true;
    screen.hidden = false;
    game().setFishingOpen?.(true);
    showCoins();
    paintBar();
    play = { phase: "idle", t: 0, power: 0, slot: slotNow(), shadows: makeShadows() };
    setSay("กดค้างบนทะเลสาบเพื่อเหวี่ยงเบ็ด ปล่อยเพื่อโยน (ยิ่งแรง ยิ่งไกล)");
    fit();
    window.addEventListener("resize", fit);
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
    tone(659, .07, "triangle", .04);
    homeButton.focus();
  }
  function goHome() {
    closeCover();
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", fit);
    isShown = false;
    screen.hidden = true;
    play = null;
    game().setFishingOpen?.(false);
    game().showModes?.();
  }
  function key(event) {
    if (event.key === "Escape") { event.preventDefault(); if (cover) closeCover(); else goHome(); return; }
    if ((event.key === " " || event.key === "Enter") && !cover && document.activeElement?.tagName !== "BUTTON") { event.preventDefault(); if (!event.repeat) press(); }
  }
  function keyUp(event) { if (isShown && (event.key === " " || event.key === "Enter") && !cover) release(); }
  window.addEventListener("keyup", keyUp);

  let W = 0, H = 0, dpr = 1;
  function fit() {
    const b = stage.getBoundingClientRect();
    W = Math.max(1, b.width); H = Math.max(1, b.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
  }
  const horizon = () => H * .36;
  const zoneY = { near: () => H * .8, mid: () => H * .62, far: () => H * .46 };
  const rodTip = () => [W * .3, H * .66];
  function setSay(text) { say.textContent = text; }
  function makeShadows() {
    return Array.from({ length: 6 }, (_, i) => ({ x: Math.random(), y: .45 + Math.random() * .45, v: (Math.random() < .5 ? -1 : 1) * (.02 + Math.random() * .03), s: .5 + Math.random() * .8, k: i }));
  }

  // ---- Input: hold and release ----
  canvas.addEventListener("pointerdown", (event) => { event.preventDefault(); canvas.setPointerCapture?.(event.pointerId); press(); });
  canvas.addEventListener("pointerup", () => release());
  canvas.addEventListener("pointercancel", () => release());
  let holding = false;
  function press() {
    if (!play || cover) return;
    holding = true;
    const p = play;
    if (p.phase === "idle") { p.phase = "charging"; p.t = 0; p.power = 0; setSay("ปล่อยเพื่อโยน!"); return; }
    if (p.phase === "waiting") {
      // struck at a nibble: the fish takes fright
      p.phase = "done";
      setSay("รีบไปหน่อย! ปลาตกใจว่ายหนีไปแล้ว รอให้ทุ่นจมลึก ๆ ก่อนนะ");
      tone(220, .1, "triangle", .04);
      later(1.6, reset);
      return;
    }
    if (p.phase === "biting") { hook(); return; }
  }
  function release() {
    if (!holding) return;
    holding = false;
    const p = play;
    if (p?.phase === "charging") cast(p.power);
  }

  // ---- Casting, waiting, the bite ----
  function cast(power) {
    const p = play;
    const zone = F.zoneFor(power);
    const gear = album().gear;
    const pick = F.pickCatch(rand, zone, play.slot, gear.bait);
    const plan = F.bitePlan(rand, pick.fish, gear.bait);
    Object.assign(p, { phase: "flying", t: 0, zone, pick, plan, tx: W * (.42 + rand() * .4), ty: zoneY[zone](), nib: 0, dip: 0 });
    setSay(`โยนไป${F.ZONE_NAME[zone]}! รอให้ทุ่นจมลึก ๆ แล้วแตะทันที`);
    tone(523, .06, "triangle", .035); tone(392, .08, "triangle", .03, .08);
  }
  function hook() {
    const p = play;
    if (p.pick.junk) { landJunk(p.pick.junk); return; }
    p.phase = "fighting";
    p.fight = F.fight(p.pick.fish, album().gear, rand);
    p.t = 0;
    setSay("กดค้างเพื่อม้วนสาย ปล่อยเมื่อสายตึงเกินช่องสีเขียว!");
    tone(880, .08, "square", .035);
  }
  let laterTimer = 0;
  function later(sec, fn) { clearTimeout(laterTimer); laterTimer = setTimeout(() => { if (play) fn(); }, sec * 1000); }
  function reset() {
    play.phase = "idle";
    play.fight = null;
    play.pick = null;
    play.slot = slotNow();
    paintBar();
    setSay("กดค้างบนทะเลสาบเพื่อเหวี่ยงเบ็ด ปล่อยเพื่อโยน");
  }

  // ---- The loop ----
  let last = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(.1, (now - last) / 1000) : 0;
    last = now;
    if (!play) return;
    const p = play;
    p.t += dt;
    if (!cover) {
      if (p.phase === "charging") p.power = (Math.sin(p.t * 2.6 - Math.PI / 2) + 1) / 2;
      if (p.phase === "flying" && p.t >= .6) { p.phase = "waiting"; p.t = 0; tone(300, .05, "sine", .03); }
      if (p.phase === "waiting") {
        while (p.nib < p.plan.nibbles.length && p.t >= p.plan.nibbles[p.nib]) { p.nib++; p.dip = .35; tone(660, .03, "sine", .02); }
        if (p.t >= p.plan.bite) { p.phase = "biting"; p.t = 0; p.dip = 1; setSay("ตอนนี้! แตะเลย!"); tone(988, .08, "square", .04); tone(1319, .1, "square", .035, .07); }
      }
      if (p.phase === "biting" && p.t > p.plan.window) {
        p.phase = "done";
        setSay("ช้าไป! ปลากินเหยื่อแล้วว่ายหนีไป");
        tone(260, .1, "triangle", .04);
        later(1.4, reset);
      }
      if (p.phase === "fighting") {
        const f = p.fight;
        let out = null;
        const steps = Math.max(1, Math.round(dt * 60));
        for (let i = 0; i < steps && !out; i++) out = F.stepFight(f, holding, 1 / 60);
        if (holding && Math.floor(p.t * 8) !== Math.floor((p.t - dt) * 8)) tone(1200 + f.tension * 600, .015, "square", .012);
        if (out === "caught") landFish(p.pick.fish);
        else if (out === "snap") { p.phase = "done"; setSay("สายขาด! ม้วนแรงเกินไป ลองปล่อยมือเมื่อเข็มเข้าใกล้สีแดง"); tone(160, .2, "sawtooth", .045); later(1.8, reset); }
        else if (out === "escape") { p.phase = "done"; setSay("ปลาหลุดไปแล้ว! สายหย่อนเกินไป อย่าปล่อยนานนะ"); tone(260, .14, "triangle", .04); later(1.8, reset); }
      }
      p.dip = Math.max(0, p.dip - dt * 2.2);
    }
    draw(dt);
  }

  // ---- Landing ----
  function landFish(fish) {
    const p = play;
    p.phase = "done";
    const size = F.sizeOf(rand, fish), feat = F.featured() === fish.id;
    const coins = F.valueOf(fish, size, feat);
    const rec = F.record(album(), fish, size);
    const toCards = pay({ coins, gems: rec.gems, dust: rec.dust });
    store();
    showCoins();
    paintBar();
    [659, 784, 988, 1319].forEach((note, i) => tone(note, .12, "sine", .045, i * .08));
    const box = el("div", "fishing-box fishing-catch");
    box.append(fishPicture(fish, 150));
    box.append(el("p", `fishing-rarity is-r${fish.rarity}`, `${stars(fish.rarity)} ${F.RARITY[fish.rarity].name}`), el("h3", null, fish.name), el("p", "fishing-size", `${size.toFixed(1)} ซม.`));
    const tags = el("div", "fishing-tags");
    if (rec.first) tags.append(el("span", "fishing-tag is-new", "ใหม่! บันทึกลงสมุด"));
    if (rec.record) tags.append(el("span", "fishing-tag is-record", "ตัวใหญ่ที่สุดที่เคยจับ!"));
    if (feat) tags.append(el("span", "fishing-tag is-feat", "ปลาเด่นวันนี้ ×3"));
    if (tags.children.length) box.append(tags);
    const parts = [`● ${fmt(coins)}`];
    if (rec.gems) parts.push(`💎 ${rec.gems}`);
    if (toCards && rec.dust) parts.push(`✧ ${rec.dust}`);
    box.append(el("p", "fishing-reward", `ได้รับ ${parts.join(" · ")}`));
    const actions = el("div", "title-actions");
    actions.append(button("primary-button", "🎣 ตกต่อ", () => { closeCover(); reset(); }), button("secondary-button", "📖 สมุดปลา", () => { closeCover(); reset(); openAlbum(); }));
    box.append(actions);
    showCover(box);
    announce(`จับได้ ${fish.name} ${size.toFixed(1)} เซนติเมตร`);
  }
  function landJunk(junk) {
    const p = play;
    p.phase = "done";
    pay({ coins: junk.coins });
    store();
    showCoins();
    setSay(`ได้${junk.name} ${junk.emoji} ช่วยเก็บขยะในทะเลสาบ +● ${junk.coins}`);
    tone(440, .06, "triangle", .03);
    later(1.6, reset);
  }

  // ---- Covers ----
  function showCover(node) {
    closeCover();
    cover = el("div", "fishing-cover");
    cover.append(node);
    game().onTap(cover, (event) => { if (event.target === cover) { closeCover(); if (play?.phase === "done") reset(); } });
    frame.append(cover);
    node.querySelector("button")?.focus();
  }
  function closeCover() { cover?.remove(); cover = null; holding = false; }
  function openAlbum() {
    const a = album(), box = el("div", "fishing-box fishing-album");
    box.append(el("h3", null, `📖 สมุดปลา ${Object.keys(a.caught).length}/${F.FISH.length}`), el("p", null, `จับได้ทั้งหมด ${fmt(a.total)} ตัว · ปลาใหม่ทุกตัวได้เพชร ปลาหายากมากและตำนานได้ผลึกดาวด้วย`));
    const grid = el("div", "fishing-album-grid");
    for (const f of F.FISH) {
      const got = a.caught[f.id] || 0;
      const card = el("div", `fishing-album-card is-r${f.rarity}${got ? "" : " is-unknown"}`);
      card.append(fishPicture(f, 54, !got), el("b", null, got ? f.name : "???"), el("small", null, got ? `ใหญ่สุด ${(a.best[f.id] / 10).toFixed(1)} ซม. · ${got} ตัว` : F.hint(f)), el("small", "fishing-album-stars", stars(f.rarity)));
      grid.append(card);
    }
    box.append(grid);
    const actions = el("div", "title-actions");
    actions.append(button("primary-button", "ปิด", () => closeCover()));
    box.append(actions);
    showCover(box);
  }
  function openGear() {
    const a = album(), box = el("div", "fishing-box fishing-gear");
    box.append(el("h3", null, "🎒 อุปกรณ์ตกปลา"), el("p", null, "อัปด้วยเหรียญ ช่วยให้จับปลาตำนานได้ง่ายขึ้น"));
    for (const [k, def] of Object.entries(F.GEAR)) {
      const lv = a.gear[k], cost = F.gearCost(lv);
      const row = el("div", "fishing-gear-row");
      const words = el("div");
      words.append(el("b", null, `${def.icon} ${def.name}`), el("small", null, def.text));
      const buy = button("secondary-button fishing-buy", cost == null ? "เต็มแล้ว" : `● ${fmt(cost)}`, () => {
        if (cost == null || save().coins < cost) return;
        save().coins -= cost;
        a.gear[k] = lv + 1;
        store();
        showCoins();
        [784, 988, 1175].forEach((note, i) => tone(note, .08, "triangle", .04, i * .06));
        openGear();
      }, cost == null ? `${def.name} เต็มแล้ว` : `อัป${def.name} ระดับ ${lv + 1} ราคา ${cost} เหรียญ`);
      buy.disabled = cost == null || save().coins < cost;
      row.append(words, el("span", "fishing-dots", "●".repeat(lv) + "○".repeat(5 - lv)), buy);
      box.append(row);
    }
    const actions = el("div", "title-actions");
    actions.append(button("primary-button", "ปิด", () => closeCover()));
    box.append(actions);
    showCover(box);
  }

  // ---- Drawing the lake ----
  const pupa = new Image();
  pupa.src = "assets/pupa-hero.webp";
  function draw(dt) {
    const g = canvas.getContext("2d"), p = play, slot = p.slot, time = performance.now() / 1000;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const hz = horizon();
    // sky
    const sky = g.createLinearGradient(0, 0, 0, hz);
    SKY[slot].forEach((c, i) => sky.addColorStop(i / 2, c));
    g.fillStyle = sky; g.fillRect(0, 0, W, hz + 1);
    if (slot === "night" || slot === "dusk") {
      g.fillStyle = "rgba(255,255,255,.8)";
      for (let i = 0; i < 40; i++) { const x = (i * 97.3) % W, y = (i * 53.7) % (hz * .9); g.globalAlpha = .3 + .5 * Math.abs(Math.sin(time + i)); g.fillRect(x, y, 2, 2); }
      g.globalAlpha = 1;
    }
    // the moon or the sun, and its glow on the water
    const [cx, cy, cr, ccol] = slot === "night" ? [W * .76, hz * .38, Math.min(W, H) * .07, "#fff6d8"] : slot === "dusk" ? [W * .7, hz * .82, Math.min(W, H) * .08, "#ffb36b"] : slot === "dawn" ? [W * .22, hz * .8, Math.min(W, H) * .07, "#ffe0a0"] : [W * .78, hz * .3, Math.min(W, H) * .06, "#fff7c0"];
    const glow = g.createRadialGradient(cx, cy, cr * .5, cx, cy, cr * 3);
    glow.addColorStop(0, ccol); glow.addColorStop(.3, hexA(ccol, .35)); glow.addColorStop(1, hexA(ccol, 0));
    g.fillStyle = glow; g.beginPath(); g.arc(cx, cy, cr * 3, 0, Math.PI * 2); g.fill();
    g.fillStyle = ccol; g.beginPath(); g.arc(cx, cy, cr, 0, Math.PI * 2); g.fill();
    if (slot === "night") { g.fillStyle = SKY.night[1]; g.beginPath(); g.arc(cx + cr * .4, cy - cr * .2, cr * .85, 0, Math.PI * 2); g.fill(); }
    // far hills with cherry trees
    g.fillStyle = slot === "night" ? "#1a1640" : slot === "dusk" ? "#4a3060" : "#6aa88a";
    g.beginPath(); g.moveTo(0, hz);
    for (let x = 0; x <= W; x += W / 12) g.lineTo(x, hz - H * .05 - Math.sin(x * .012) * H * .03);
    g.lineTo(W, hz); g.closePath(); g.fill();
    for (let i = 0; i < 9; i++) { const x = W * (i + .5) / 9, y = hz - H * .05 - Math.sin(x * .012) * H * .03; g.fillStyle = slot === "night" ? "rgba(255,170,210,.45)" : "rgba(255,170,210,.9)"; g.beginPath(); g.arc(x, y - H * .015, H * .018, 0, Math.PI * 2); g.fill(); }
    // water
    const water = g.createLinearGradient(0, hz, 0, H);
    water.addColorStop(0, WATER[slot][0]); water.addColorStop(1, WATER[slot][1]);
    g.fillStyle = water; g.fillRect(0, hz, W, H - hz);
    // the light's path on the water
    g.fillStyle = hexA(ccol, .35);
    for (let i = 0; i < 10; i++) { const y = hz + (H - hz) * (i / 10) + 4, w = (W * .02 + i * W * .008) * (1 + .3 * Math.sin(time * 2 + i)); g.fillRect(cx - w / 2, y, w, 3); }
    // ripples
    g.strokeStyle = "rgba(255,255,255,.18)"; g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const y = hz + (H - hz) * ((i * .071 + time * .02) % 1), x = ((i * 137) % W);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 20, y - 3, x + 40, y); g.stroke();
    }
    // fish shadows swimming by
    for (const sh of p.shadows) {
      if (!calm()) sh.x += sh.v * dt;
      if (sh.x < -.1) sh.x = 1.1; if (sh.x > 1.1) sh.x = -.1;
      const x = sh.x * W, y = hz + (H - hz) * (sh.y - .38) / .62 * .9;
      g.save(); g.translate(x, y); if (sh.v < 0) g.scale(-1, 1);
      g.fillStyle = "rgba(10,20,50,.22)";
      g.beginPath(); g.ellipse(0, 0, 24 * sh.s, 8 * sh.s, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-22 * sh.s, 0); g.lineTo(-34 * sh.s, -7 * sh.s); g.lineTo(-34 * sh.s, 7 * sh.s); g.closePath(); g.fill();
      g.restore();
    }
    // the pier and Pupa
    g.fillStyle = "#8a5a3a";
    g.fillRect(0, H * .82, W * .34, H * .06);
    g.fillStyle = "#6a4028";
    for (let x = W * .02; x < W * .34; x += W * .07) g.fillRect(x, H * .88, W * .018, H * .12);
    g.fillStyle = "#a8714a";
    for (let x = 0; x < W * .34; x += W * .045) g.fillRect(x + 1, H * .82, W * .04, H * .012);
    const ph = Math.min(H * .28, 180);
    if (pupa.complete && pupa.naturalWidth) {
      const pw = ph * pupa.naturalWidth / pupa.naturalHeight, bob = calm() ? 0 : Math.sin(time * 2) * 2;
      g.drawImage(pupa, W * .17 - pw / 2, H * .83 - ph + bob, pw, ph);
    }
    // the rod
    const [tx0, ty0] = [W * .2, H * .72], [tipX, tipY] = rodTip();
    const bend = p.phase === "fighting" ? p.fight.tension * H * .05 : 0;
    g.strokeStyle = "#5a3a20"; g.lineWidth = 4; g.lineCap = "round";
    g.beginPath(); g.moveTo(tx0, ty0); g.quadraticCurveTo((tx0 + tipX) / 2, (ty0 + tipY) / 2 - H * .04 + bend, tipX, tipY - H * .1 + bend * 1.5); g.stroke();
    const tip = [tipX, tipY - H * .1 + bend * 1.5];
    // the line and the float
    let bx = null, by = null;
    if (p.phase === "flying") { const f = Math.min(1, p.t / .6); bx = tip[0] + (p.tx - tip[0]) * f; by = tip[1] + (p.ty - tip[1]) * f - Math.sin(f * Math.PI) * H * .18; }
    else if (["waiting", "biting", "fighting", "done"].includes(p.phase) && p.tx != null && p.pick) {
      bx = p.tx + (p.phase === "fighting" ? Math.sin(time * 9) * 6 * p.fight.power : 0);
      by = p.ty + (calm() ? 0 : Math.sin(time * 2.4) * 2) + p.dip * 14;
      if (p.phase === "fighting") { const pull = 1 - p.fight.progress; bx = tip[0] + (p.tx - tip[0]) * (.25 + pull * .75); by = tip[1] + (p.ty - tip[1]) * (.25 + pull * .75) + 8; }
    }
    if (bx != null) {
      const taut = p.phase === "fighting" ? p.fight.tension : 0;
      g.strokeStyle = taut > p.fight?.hi ? "#ff6b6b" : "rgba(255,255,255,.85)";
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(tip[0], tip[1]);
      g.quadraticCurveTo((tip[0] + bx) / 2, Math.max(tip[1], by) + (1 - taut) * H * .06, bx, by); g.stroke();
      if (p.phase !== "flying") {
        g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = 1.5;
        for (let k = 0; k < 2; k++) { const r = ((time * 30 + k * 18) % 36); g.globalAlpha = 1 - r / 36; g.beginPath(); g.ellipse(bx, by + 6, r, r * .3, 0, 0, Math.PI * 2); g.stroke(); }
        g.globalAlpha = 1;
      }
      if (p.phase === "fighting") {
        // the fish thrashing
        drawFish(g, p.pick.fish, bx + 8, by + 22, Math.min(90, W * .12), true, Math.sin(time * 14) * .3);
        if (p.fight.pullFor > 0) { g.fillStyle = "rgba(255,255,255,.7)"; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(bx + Math.cos(k * 1.3 + time * 10) * 20, by + Math.sin(k * 2 + time * 12) * 8, 3, 0, Math.PI * 2); g.fill(); } }
      } else {
        g.fillStyle = "#ff4d5e"; g.beginPath(); g.arc(bx, by, 7, Math.PI, 0); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(bx, by, 7, 0, Math.PI); g.fill();
        g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 1; g.beginPath(); g.arc(bx, by, 7, 0, Math.PI * 2); g.stroke();
      }
      if (p.phase === "biting") {
        g.font = `900 ${Math.round(Math.min(48, W * .08))}px system-ui, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillStyle = "#fff"; g.strokeStyle = "#c2185b"; g.lineWidth = 5;
        const s = 1 + .15 * Math.sin(time * 20);
        g.save(); g.translate(bx, by - 48); g.scale(s, s); g.strokeText("!", 0, 0); g.fillText("!", 0, 0); g.restore();
        g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 3;
        g.beginPath(); g.ellipse(bx, by + 6, 30 + 10 * Math.sin(time * 15), 9, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    // the cast meter
    if (p.phase === "charging") {
      const mx = W * .37, my = H * .3, mh = H * .5, mw = Math.max(16, W * .025);
      [["far", 1, .72, "#ff9ec4"], ["mid", .72, .34, "#ffd76a"], ["near", .34, 0, "#7dffb0"]].forEach(([z, a, b, c]) => { g.fillStyle = hexA(c, .55); g.fillRect(mx, my + mh * (1 - a), mw, mh * (a - b)); g.fillStyle = "#fff"; g.font = `800 ${Math.max(10, W * .014)}px system-ui, sans-serif`; g.textAlign = "left"; g.fillText(F.ZONE_NAME[z], mx + mw + 6, my + mh * (1 - (a + b) / 2)); });
      g.strokeStyle = "#fff"; g.lineWidth = 2; g.strokeRect(mx, my, mw, mh);
      const y = my + mh * (1 - p.power);
      g.fillStyle = "#fff"; g.beginPath(); g.moveTo(mx - 10, y); g.lineTo(mx, y - 7); g.lineTo(mx, y + 7); g.closePath(); g.fill();
      g.fillRect(mx, y - 2, mw, 4);
    }
    // the reel: tension and how close the fish is
    if (p.phase === "fighting") {
      const f = p.fight, bw = Math.min(W * .8, 520), bx2 = (W - bw) / 2, by2 = H * .08, bh = Math.max(16, H * .035);
      g.fillStyle = "rgba(20,10,40,.7)"; g.fillRect(bx2 - 8, by2 - 26, bw + 16, bh * 2 + 46);
      g.fillStyle = "#ff6b6b"; g.fillRect(bx2, by2, bw, bh);
      g.fillStyle = "#ffd76a"; g.fillRect(bx2, by2, bw * f.lo, bh);
      g.fillStyle = "#4fd67a"; g.fillRect(bx2 + bw * f.lo, by2, bw * (f.hi - f.lo), bh);
      const nx = bx2 + bw * Math.min(1, f.tension);
      g.fillStyle = "#fff"; g.fillRect(nx - 3, by2 - 6, 6, bh + 12);
      g.font = `800 ${Math.max(11, Math.min(14, W * .02))}px system-ui, sans-serif`; g.textAlign = "left"; g.textBaseline = "bottom"; g.fillStyle = "#fff";
      g.fillText("แรงตึงสาย", bx2, by2 - 6);
      g.textAlign = "right"; g.fillText(holding ? "กำลังม้วน..." : "ปล่อยสาย", bx2 + bw, by2 - 6);
      const py = by2 + bh + 12;
      g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(bx2, py, bw, bh * .7);
      g.fillStyle = "#7fd8ff"; g.fillRect(bx2, py, bw * f.progress, bh * .7);
      g.font = `${Math.round(bh * 1.1)}px system-ui, sans-serif`; g.textBaseline = "middle"; g.textAlign = "center";
      g.fillText("🐟", bx2 + bw * f.progress, py + bh * .35);
    }
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
  }

  // `run` is read by the browser tests to fish
  window.PupaFishing = { open, close: goHome, key, get isOpen() { return isShown; }, get run() { return play ? { phase: play.phase, power: play.power, fight: play.fight, pick: play.pick, plan: play.plan, t: play.t, cover: Boolean(cover) } : null; } };
  // Test link: ?fishing opens straight onto the lake.
  if (new URLSearchParams(location.search).has("fishing")) setTimeout(() => open(), 400);
})();

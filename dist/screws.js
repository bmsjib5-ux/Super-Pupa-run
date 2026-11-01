// Screw puzzle (คลายน็อตกลไก): the screens. The rules live in
// screws-engine.js; game.js lends the save, sounds and coins through
// window.PupaGame and keeps its own keys quiet while this is open.
//
// save.screws = { stars: { level: best stars } }.
(() => {
  "use strict";
  const S = window.PupaScrewsEngine;
  const screen = document.querySelector("#screwsScreen");
  if (!S || !screen) return;

  const game = () => window.PupaGame;
  const save = () => game().save;
  const tone = (...args) => game()?.tone(...args);
  const announce = (text) => game()?.announce(text);
  const store = () => game().writeSave();
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const calm = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const wait = (ms) => new Promise(done => setTimeout(done, ms));
  const SVG = "http://www.w3.org/2000/svg";
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const svg = (tag, attrs = {}) => {
    const node = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    return node;
  };
  const button = (className, text, handler, label) => {
    const node = el("button", className, text);
    node.type = "button";
    if (label) node.setAttribute("aria-label", label);
    if (handler) game().onTap(node, (event) => { if (!node.disabled) handler(event); });
    return node;
  };
  const stars = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  const colourName = (c) => S.COLOURS[c].name;
  // plate looks: light wood, dark wood, brass, teal steel
  const TINTS = [["#f2c98a", "#c98b4a", "#8a5428"], ["#c98a5a", "#9a5a30", "#5e3216"], ["#f6d77a", "#c9a03a", "#7a5a12"], ["#9fd6d0", "#5aa49c", "#2e6560"]];

  // ---- The save ----
  function progress() {
    const s = save();
    const raw = s.screws && typeof s.screws === "object" ? s.screws : {};
    const out = {};
    for (let n = 1; n <= S.LEVELS; n++) { const v = Math.min(3, Math.floor(Number(raw.stars?.[n]) || 0)); if (v > 0) out[n] = v; }
    s.screws = { stars: out };
    return s.screws;
  }
  const record = () => save().screws;
  const isOpenLevel = (n) => n === 1 || (record().stars[n - 1] || 0) > 0;
  const nextLevel = () => { for (let n = 1; n <= S.LEVELS; n++) if (!record().stars[n]) return n; return S.LEVELS; };

  // ---- The frame ----
  const frame = el("div", "shop-card screws-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "คลายน็อตกลไก");
  title.id = "screwsTitle";
  const wallet = el("div", "shop-wallet");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  const homeButton = button("icon-button screws-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(homeButton, title, wallet);
  const body = el("div", "screws-body");
  frame.append(head, body);
  screen.append(frame);
  function showCoins() {
    wallet.querySelector("b").textContent = fmt(save().coins);
    wallet.querySelector(".gems").textContent = fmt(save().gems || 0);
    wallet.setAttribute("aria-label", `เหรียญ ${fmt(save().coins)} เพชร ${fmt(save().gems || 0)}`);
  }

  let isShown = false;
  let play = null;   // the level being played, if any

  function open() {
    if (!game()) return;
    progress();
    isShown = true;
    screen.hidden = false;
    game().setScrewsOpen?.(true);
    showLevels();
    tone(659, .07, "triangle", .04);
    homeButton.focus();
  }
  function goHome() {
    stopPlay();
    isShown = false;
    screen.hidden = true;
    game().setScrewsOpen?.(false);
    game().showModes?.();
  }
  function key(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (play) showLevels();
    else goHome();
  }

  // ---- Choosing a level ----
  function showLevels() {
    stopPlay();
    showCoins();
    const r = record(), next = nextLevel();
    const got = Object.values(r.stars).reduce((a, b) => a + b, 0);
    const intro = el("section", "screws-intro");
    const pic = el("img", "screws-intro-pic");
    pic.src = "assets/pupav2-hero.webp";
    pic.alt = "";
    const words = el("div", "screws-intro-words");
    words.append(el("b", null, "คลายน็อตลงกล่องสีเดียวกัน ให้แผ่นไม้ร่วงหมดกระดาน"),
      el("span", null, `แตะน็อตที่ไม่มีแผ่นด้านบนทับเพื่อคลายออก น็อตจะลงกล่องสีเดียวกัน (เปิดทีละ 2 กล่อง กล่องละ ${S.BOX_SIZE} ตัว) ถ้าไม่มีกล่องสีนั้นจะไปรอที่ช่องพัก ${S.TRAY} ช่อง ช่องพักเต็มเมื่อไรแพ้ · แผ่นที่ไม่เหลือน็อตจะร่วงลง · ไม่ใช้ตัวช่วยได้ ★★★`));
    intro.append(pic, words);
    const go = button("primary-button screws-go", `▶ เล่นด่าน ${next}`, () => startLevel(next));
    const sum = el("p", "screws-sum", `★ ${got}/${S.LEVELS * 3} · ผ่านแล้ว ${Object.keys(r.stars).length}/${S.LEVELS} ด่าน`);
    const grid = el("div", "screws-levels");
    for (let n = 1; n <= S.LEVELS; n++) {
      const lv = S.levelOf(n), open = isOpenLevel(n), have = r.stars[n] || 0;
      const tile = button(`screws-level${have ? " is-cleared" : open ? " is-next" : " is-locked"}`, null, () => startLevel(n),
        `ด่าน ${n} ${open ? (have ? `ได้ ${have} ดาว` : "เล่นได้") : "ล็อกอยู่"} · แผ่น ${lv.plates} แผ่น · น็อต ${lv.colours} สี`);
      tile.disabled = !open;
      tile.append(el("b", null, open ? String(n) : "🔒"), el("small", "screws-level-stars", open ? stars(have) : ""), el("small", "screws-level-info", `${lv.plates} แผ่น · ${lv.colours} สี`));
      grid.append(tile);
    }
    body.replaceChildren(intro, go, sum, grid);
    grid.querySelector(".is-next")?.scrollIntoView({ block: "nearest" });
  }

  // ---- Playing a level ----
  function startLevel(n) {
    if (!isOpenLevel(n)) return;
    stopPlay();
    const level = S.levelOf(n);
    const dealt = S.deal(level);
    const view = el("section", "screws-play");
    const bar = el("div", "screws-bar");
    const name = el("b", "screws-name", `ด่าน ${n}`);
    const left = el("span", "screws-left");
    const undo = button("screws-tool", null, () => useUndo(), "ย้อนกลับ");
    const slot = button("screws-tool", null, () => useSlot(), "เพิ่มช่องพัก");
    const drill = button("screws-tool", null, () => armDrill(), "สว่าน");
    const hint = button("screws-tool", "💡", () => useHint(), "คำใบ้");
    const again = button("screws-tool", "⟲", () => startLevel(n), "เริ่มด่านใหม่");
    bar.append(name, left, undo, slot, drill, hint, again);
    const top = el("div", "screws-top");
    const boxes = el("div", "screws-boxes");
    const queue = el("div", "screws-queue");
    top.append(boxes, queue);
    const tray = el("div", "screws-tray");
    const wrap = el("div", "screws-wrap");
    const board = svg("svg", { class: "screws-board", viewBox: `-.3 -.3 ${S.W + .6} ${S.H + .6}`, role: "group", "aria-label": "กระดานแผ่นไม้และน็อต" });
    wrap.append(board);
    const note = el("p", "screws-note");
    note.setAttribute("aria-live", "polite");
    view.append(bar, top, tray, wrap, note);
    body.replaceChildren(view);
    play = { level, state: S.start(dealt.state), history: [], tools: 0, undos: S.UNDOS, slots: S.SLOTS, drills: S.DRILLS, armed: false, busy: false, over: false,
      view, boxes, queue, tray, board, wrap, note, left, undo, slot, drill, hint };
    render();
    paintTools();
    announce(`ด่าน ${n} · น็อต ${play.state.screws.length} ตัว`);
    tone(523, .08, "triangle", .05); tone(784, .1, "triangle", .05, .08);
  }

  // Everything drawn again from the state (at the start and after undo).
  function render() {
    const p = play, s = p.state;
    const board = p.board;
    board.replaceChildren();
    const defs = svg("defs");
    TINTS.forEach((t, i) => {
      for (const [id, x2, y2] of [[`screws-wood-${i}`, 0, 1], [`screws-disc-${i}`, 1, 1]]) {
        const g = svg("linearGradient", { id, x1: 0, y1: 0, x2, y2 });
        g.append(svg("stop", { offset: "0", "stop-color": t[0] }), svg("stop", { offset: ".55", "stop-color": t[1] }), svg("stop", { offset: "1", "stop-color": t[2] }));
        defs.append(g);
      }
    });
    S.COLOURS.forEach((c, i) => {
      const g = svg("radialGradient", { id: `screws-head-${i}`, cx: ".35", cy: ".3", r: ".75" });
      g.append(svg("stop", { offset: "0", "stop-color": "#fff" }), svg("stop", { offset: ".25", "stop-color": c.hex }), svg("stop", { offset: "1", "stop-color": shade(c.hex, -.45) }));
      defs.append(g);
    });
    board.append(defs);
    // the backboard with its grid of studs
    board.append(svg("rect", { class: "screws-back", x: -.3, y: -.3, width: S.W + .6, height: S.H + .6, rx: .45 }));
    p.plateNodes = new Map();
    p.screwNodes = new Map();
    for (const plate of [...s.plates].sort((a, b) => a.layer - b.layer)) {
      if (plate.gone) continue;
      const g = svg("g", { class: "screws-plate" });
      const tint = plate.tint % TINTS.length;
      if (plate.kind === "bar") {
        const len = Math.hypot(plate.x2 - plate.x1, plate.y2 - plate.y1), angle = Math.atan2(plate.y2 - plate.y1, plate.x2 - plate.x1) * 180 / Math.PI;
        const cx = (plate.x1 + plate.x2) / 2, cy = (plate.y1 + plate.y2) / 2, hw = S.BAR_HALF;
        g.append(svg("rect", { x: -len / 2 - hw, y: -hw, width: len + hw * 2, height: hw * 2, rx: hw, fill: `url(#screws-wood-${tint})`, class: "screws-face", transform: `translate(${cx} ${cy}) rotate(${angle})` }));
      } else g.append(svg("circle", { cx: plate.cx, cy: plate.cy, r: plate.r, fill: `url(#screws-disc-${tint})`, class: "screws-face" }));
      // its screws, under any plate drawn later (above)
      for (const screw of s.screws.filter(x => x.plate === plate.id)) {
        g.append(svg("circle", { class: "screws-hole", cx: screw.x, cy: screw.y, r: S.SCREW_R * .62 }));
        if (screw.out) continue;
        const head = svg("g", { class: "screws-screw", tabindex: 0, role: "button", transform: `translate(${screw.x} ${screw.y})` });
        head.dataset.id = String(screw.id);
        head.append(svg("circle", { r: S.SCREW_R, fill: `url(#screws-head-${screw.colour})`, class: "screws-cap" }),
          svg("path", { d: `M${-S.SCREW_R * .5} 0H${S.SCREW_R * .5}M0 ${-S.SCREW_R * .5}V${S.SCREW_R * .5}`, class: "screws-cross" }));
        head.setAttribute("aria-label", `น็อตสี${colourName(screw.colour)}`);
        game().onTap(head, () => tap(screw.id));
        head.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); tap(screw.id); } });
        g.append(head);
        p.screwNodes.set(screw.id, head);
      }
      board.append(g);
      p.plateNodes.set(plate.id, g);
    }
    markCovered();
    paintBoxes();
    paintTray();
  }
  // lighter or darker: amount -1..1
  function shade(hex, amount) {
    const n = parseInt(hex.slice(1), 16), mix = (v) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount);
    return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
  }
  // covered screws say so (for the screen reader; the eye sees the plate)
  function markCovered() {
    const p = play;
    for (const screw of p.state.screws) {
      const node = p.screwNodes.get(screw.id);
      if (!node) continue;
      const free = S.isFree(p.state, screw);
      node.classList.toggle("is-free", free);
      node.setAttribute("aria-label", `น็อตสี${colourName(screw.colour)}${free ? "" : " ถูกแผ่นด้านบนทับอยู่"}`);
    }
    p.left.textContent = `เหลือ ${p.state.screws.filter(x => !x.out).length}`;
  }
  function paintBoxes() {
    const p = play, s = p.state;
    p.boxes.replaceChildren(...s.boxes.map((b, i) => {
      const box = el("div", `screws-box${b ? "" : " is-empty"}`);
      box.dataset.i = String(i);
      if (b) {
        box.style.setProperty("--c", S.COLOURS[b.colour].hex);
        for (let k = 0; k < S.BOX_SIZE; k++) box.append(el("i", k < b.count ? "is-in" : ""));
        box.setAttribute("aria-label", `กล่องสี${colourName(b.colour)} ใส่แล้ว ${b.count} จาก ${S.BOX_SIZE}`);
      } else box.setAttribute("aria-label", "ไม่มีกล่องแล้ว");
      return box;
    }));
    const coming = s.queue.slice(s.next, s.next + 4);
    p.queue.replaceChildren(el("small", null, coming.length ? "ต่อไป" : "กล่องสุดท้าย"), ...coming.map(c => { const chip = el("i"); chip.style.setProperty("--c", S.COLOURS[c].hex); return chip; }));
    p.queue.setAttribute("aria-label", coming.length ? `กล่องต่อไป ${coming.map(colourName).join(" ")}` : "ไม่มีกล่องต่อไป");
  }
  function paintTray() {
    const p = play, s = p.state;
    const slots = [];
    for (let k = 0; k < s.trayCap; k++) {
      const c = s.tray[k];
      const slot = el("i", c == null ? "" : "is-in");
      if (c != null) slot.style.setProperty("--c", S.COLOURS[c].hex);
      slots.push(slot);
    }
    p.tray.replaceChildren(...slots);
    p.tray.classList.toggle("is-tight", s.tray.length >= s.trayCap - 1);
    p.tray.setAttribute("aria-label", `ช่องพัก ${s.tray.length} จาก ${s.trayCap}${s.tray.length ? `: ${s.tray.map(colourName).join(" ")}` : ""}`);
  }

  // ---- Taking a screw out ----
  async function tap(id) {
    const p = play;
    if (!p || p.over) return;
    // a tap while the last screw is still on its way waits its turn
    if (p.busy) { p.pending = id; return; }
    clearHint();
    const screw = p.state.screws.find(x => x.id === id);
    if (!screw || screw.out) return;
    const drilling = p.armed;
    if (!drilling && !S.isFree(p.state, screw)) {
      const node = p.screwNodes.get(id);
      node?.classList.remove("is-no"); void node?.getBoundingClientRect(); node?.classList.add("is-no");
      tone(160, .1, "square", .04);
      say("น็อตตัวนี้ถูกแผ่นด้านบนทับอยู่ คลายน็อตของแผ่นที่ทับก่อน");
      return;
    }
    p.history.push(S.clone(p.state));
    const events = S.unscrew(p.state, id, drilling);
    if (!events) { p.history.pop(); return; }
    if (drilling) { p.drills--; p.tools++; p.armed = false; p.drill.classList.remove("is-armed"); p.board.classList.remove("is-drill"); }
    p.busy = true;
    paintTools();
    const node = p.screwNodes.get(id);
    const from = node.getBoundingClientRect();
    node.classList.add("is-out");
    tone(880, .05, "triangle", .04); tone(1175, .05, "triangle", .03, .05);
    setTimeout(() => node.remove(), 300);
    p.screwNodes.delete(id);
    for (const ev of events) {
      if (ev.t === "box" || ev.t === "tray" || ev.t === "full") {
        // the box on screen may be about to be replaced: its first empty hole
        const target = ev.t === "box" ? p.boxes.children[ev.i]?.querySelector("i:not(.is-in)") : ev.t === "tray" ? p.tray.children[ev.at] : p.tray;
        await fly(from, target, screw.colour);
        if (ev.t === "box") target?.classList.add("is-in");
        if (ev.t === "tray") { paintTray(); if (p.state.tray.length >= p.state.trayCap - 1) { say(`ช่องพักเหลือ ${p.state.trayCap - p.state.tray.length} ช่อง ระวังนะ!`); tone(330, .1, "sawtooth", .03); } }
      } else if (ev.t === "fall") {
        const plate = p.plateNodes.get(ev.plate);
        if (plate) { plate.classList.add("is-falling"); setTimeout(() => plate.remove(), 700); }
        [523, 392, 262].forEach((note, i) => tone(note, .07, "triangle", .035, i * .05));
      } else if (ev.t === "boxDone") {
        const box = p.boxes.children[ev.i];
        box?.classList.add("is-done");
        [784, 988, 1319].forEach((note, i) => tone(note, .09, "triangle", .045, i * .06));
        await wait(calm() ? 0 : 380);
        paintBoxes();
        p.boxes.children[ev.i]?.classList.add("is-new");
      } else if (ev.t === "fromTray") {
        paintTray();
        paintBoxes();
        p.boxes.children[ev.i]?.classList.add("is-new");
        tone(659, .06, "sine", .035);
      }
    }
    if (play !== p) return;
    paintBoxes();
    paintTray();
    markCovered();
    p.busy = false;
    paintTools();
    if (p.state.failed) { finish(false); return; }
    if (S.cleared(p.state)) { finish(true); return; }
    const next = p.pending;
    p.pending = null;
    if (next) tap(next);
  }
  // a screw head flies from the board to its box hole or tray slot
  async function fly(from, target, colour) {
    if (calm() || !target) return;
    const to = target.getBoundingClientRect(), box = screen.getBoundingClientRect();
    const bit = el("i", "screws-fly");
    bit.style.setProperty("--c", S.COLOURS[colour].hex);
    const size = from.width;
    bit.style.width = bit.style.height = `${size}px`;
    bit.style.left = `${from.left - box.left}px`;
    bit.style.top = `${from.top - box.top}px`;
    screen.append(bit);
    void bit.offsetWidth;
    bit.style.transform = `translate(${to.left + to.width / 2 - from.left - size / 2}px, ${to.top + to.height / 2 - from.top - size / 2}px) rotate(540deg)`;
    await wait(300);
    bit.remove();
  }

  // ---- Tools ----
  function useUndo() {
    const p = play;
    if (!p || p.over || p.busy || p.undos <= 0 || !p.history.length) return;
    p.state = p.history.pop();
    p.undos--;
    p.tools++;
    render();
    paintTools();
    tone(440, .05, "triangle", .03); tone(330, .06, "triangle", .03, .05);
    say("ย้อนกลับ 1 ครั้ง");
  }
  function useSlot() {
    const p = play;
    if (!p || p.over || p.busy || p.slots <= 0) return;
    p.slots--;
    p.tools++;
    p.state.trayCap++;
    for (const h of p.history) h.trayCap++;
    paintTray();
    paintTools();
    [523, 784].forEach((note, i) => tone(note, .07, "triangle", .04, i * .06));
    say("เพิ่มช่องพักอีก 1 ช่อง");
  }
  function armDrill() {
    const p = play;
    if (!p || p.over || p.busy || p.drills <= 0) return;
    p.armed = !p.armed;
    p.drill.classList.toggle("is-armed", p.armed);
    p.board.classList.toggle("is-drill", p.armed);
    say(p.armed ? "แตะน็อตตัวไหนก็ได้ แม้จะถูกทับอยู่ (แตะสว่านอีกครั้งเพื่อยกเลิก)" : "");
    tone(p.armed ? 523 : 330, .05, "triangle", .03);
  }
  function useHint() {
    const p = play;
    if (!p || p.over || p.busy) return;
    const screw = S.hint(p.state);
    if (!screw) return;
    clearHint();
    p.screwNodes.get(screw.id)?.classList.add("is-hint");
    p.hintTimer = setTimeout(clearHint, 2400);
    const to = S.whereTo(p.state, screw.colour);
    say(to === "box" ? `น็อตสี${colourName(screw.colour)}ตัวที่กระพริบลงกล่องได้เลย` : `น็อตสี${colourName(screw.colour)}ตัวที่กระพริบต้องพักไว้ก่อน รอกล่องสีนั้น`);
    tone(880, .06, "sine", .04); tone(1175, .08, "sine", .04, .06);
  }
  function clearHint() {
    if (!play) return;
    clearTimeout(play.hintTimer);
    play.board.querySelectorAll(".is-hint").forEach(n => n.classList.remove("is-hint"));
  }
  function paintTools() {
    const p = play;
    const set = (node, icon, n, label) => {
      node.replaceChildren(el("span", null, icon), el("small", null, String(n)));
      node.setAttribute("aria-label", `${label} เหลือ ${n} ครั้ง`);
    };
    set(p.undo, "↶", p.undos, "ย้อนกลับ");
    set(p.slot, "➕", p.slots, "เพิ่มช่องพัก");
    set(p.drill, "🪛", p.drills, "สว่านคลายน็อตที่ถูกทับ");
    p.undo.disabled = p.undos <= 0 || !p.history.length || p.over;
    p.slot.disabled = p.slots <= 0 || p.over;
    p.drill.disabled = p.drills <= 0 || p.over;
    p.hint.disabled = p.over;
  }
  function say(text) {
    if (!play) return;
    play.note.textContent = text;
    clearTimeout(play.noteTimer);
    if (text) play.noteTimer = setTimeout(() => { if (play) play.note.textContent = ""; }, 3200);
  }
  function stopPlay() {
    if (!play) return;
    clearTimeout(play.hintTimer); clearTimeout(play.noteTimer);
    play = null;
  }

  // ---- The end ----
  function finish(won) {
    const p = play;
    p.over = true;
    paintTools();
    const n = p.level.num, r = record(), before = r.stars[n] || 0;
    const box = el("div", `screws-cover screws-result${won ? " is-won" : ""}`);
    if (won) {
      const got = S.starsFor(p.tools);
      const reward = S.rewardFor(p.level, !before, got, before);
      r.stars[n] = Math.max(before, got);
      save().coins += reward.coins;
      save().gems = (save().gems || 0) + reward.gems;
      // star dust and ore go to the card battles, once their save exists
      const cards = save().cards;
      const toCards = cards && typeof cards === "object" && typeof cards.dust === "number" && typeof cards.ore === "number";
      if (toCards) { cards.dust += reward.dust; cards.ore += reward.ore; }
      store();
      showCoins();
      const parts = [`● ${fmt(reward.coins)}`];
      if (reward.gems) parts.push(`💎 ${reward.gems}`);
      if (toCards && reward.dust) parts.push(`✧ ${reward.dust}`);
      if (toCards && reward.ore) parts.push(`⛏ ${reward.ore}`);
      box.append(el("span", "screws-medal", "🏆"), el("h3", null, `ผ่านด่าน ${n}!`), el("p", "screws-stars", stars(got)),
        el("p", null, p.tools ? `ใช้ตัวช่วย ${p.tools} ครั้ง` : "ไม่ใช้ตัวช่วยเลย!"),
        el("p", "screws-reward", `ได้รับ ${parts.join(" · ")}`),
        el("p", "screws-tip", got < 3 ? "ไม่ใช้ย้อนกลับ เพิ่มช่อง หรือสว่าน เพื่อได้ ★★★" : "ได้ครบ 3 ดาว!"));
      [523, 659, 784, 1047].forEach((note, i) => tone(note, .14, "triangle", .05, i * .1));
      announce(`ผ่านด่าน ${n} ได้ ${got} ดาว`);
      confetti(p.view);
    } else {
      box.append(el("span", "screws-medal", "🧰"), el("h3", null, "ช่องพักเต็ม!"), el("p", null, `น็อตไม่มีที่ไปแล้ว · ลองคลายน็อตที่ลงกล่องได้ก่อน ใช้ ↶ ย้อนกลับ หรือ ➕ เพิ่มช่องพัก แล้วลองใหม่นะ`));
      if (p.undos > 0 && p.history.length) box.append(button("primary-button", `↶ ย้อนกลับ (เหลือ ${p.undos})`, () => { box.remove(); p.over = false; useUndo(); }));
      [392, 330, 262].forEach((note, i) => tone(note, .18, "triangle", .04, i * .14));
      announce("ช่องพักเต็ม");
    }
    const actions = el("div", "title-actions");
    if (won && n < S.LEVELS) actions.append(button("primary-button", `ด่าน ${n + 1} ▶`, () => startLevel(n + 1)));
    actions.append(button(won && n < S.LEVELS ? "secondary-button" : won ? "primary-button" : "secondary-button", "เล่นอีกครั้ง", () => startLevel(n)), button("secondary-button", "เลือกด่าน", () => showLevels()));
    box.append(actions);
    p.view.append(box);
    box.querySelector("button")?.focus();
  }
  function confetti(host) {
    if (calm()) return;
    const colours = S.COLOURS.map(c => c.hex);
    for (let i = 0; i < 40; i++) {
      const bit = el("i", "screws-confetti");
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = colours[i % colours.length];
      bit.style.animationDelay = `${Math.random() * .5}s`;
      bit.style.setProperty("--drift", `${(Math.random() - .5) * 120}px`);
      host.append(bit);
      setTimeout(() => bit.remove(), 2600);
    }
  }

  window.PupaScrews = { open, close: goHome, key, get isOpen() { return isShown; } };
  // Test link: ?screws opens straight into the screw puzzle.
  if (new URLSearchParams(location.search).has("screws")) setTimeout(() => open(), 400);
})();

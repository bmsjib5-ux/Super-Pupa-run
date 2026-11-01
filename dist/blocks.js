// Mushroom block jam (ปลดล็อกบล็อกเห็ด): the screens. The rules live in
// blocks-engine.js; game.js lends the save, sounds and coins through
// window.PupaGame and keeps its own keys quiet while this is open.
//
// save.blocks = { stars: { level: best stars } }.
(() => {
  "use strict";
  const B = window.PupaBlocksEngine;
  const screen = document.querySelector("#blocksScreen");
  if (!B || !screen) return;

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
  const stars = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  const colourName = (c) => B.COLOURS[c].name;
  const ARROW = { top: "▲", bottom: "▼", left: "◀", right: "▶" };
  const SIDE_NAME = { top: "บน", bottom: "ล่าง", left: "ซ้าย", right: "ขวา" };

  // ---- The save ----
  function progress() {
    const s = save();
    const raw = s.blocks && typeof s.blocks === "object" ? s.blocks : {};
    const out = {};
    for (let n = 1; n <= B.LEVELS; n++) { const v = Math.min(3, Math.floor(Number(raw.stars?.[n]) || 0)); if (v > 0) out[n] = v; }
    s.blocks = { stars: out };
    return s.blocks;
  }
  const record = () => save().blocks;
  const isOpenLevel = (n) => n === 1 || (record().stars[n - 1] || 0) > 0;
  const nextLevel = () => { for (let n = 1; n <= B.LEVELS; n++) if (!record().stars[n]) return n; return B.LEVELS; };
  const twistIcons = (level) => `${level.rocks ? "🪨" : ""}${level.ice ? "❄" : ""}${level.arrows ? "↔" : ""}`;

  // ---- The frame ----
  const frame = el("div", "shop-card blocks-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "ปลดล็อกบล็อกเห็ด");
  title.id = "blocksTitle";
  const wallet = el("div", "shop-wallet");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  const homeButton = button("icon-button blocks-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(homeButton, title, wallet);
  const body = el("div", "blocks-body");
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
    game().setBlocksOpen?.(true);
    showLevels();
    tone(659, .07, "triangle", .04);
    homeButton.focus();
  }
  function goHome() {
    stopPlay();
    isShown = false;
    screen.hidden = true;
    game().setBlocksOpen?.(false);
    game().showModes?.();
  }
  // Escape pauses (or goes back); arrow keys slide the block in focus.
  function key(event) {
    const p = play;
    const dirs = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (p && !p.over && !p.paused && dirs[event.key]) {
      const id = Number(document.activeElement?.dataset?.block);
      if (id) { event.preventDefault(); const [dx, dy] = dirs[event.key]; if (!slide(id, dx, dy)) bump(id); }
      return;
    }
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (p && !p.over) { if (p.paused) resume(); else pause(); }
    else if (p) showLevels();
    else goHome();
  }

  // ---- Choosing a level ----
  function showLevels() {
    stopPlay();
    showCoins();
    const r = record(), next = nextLevel();
    const got = Object.values(r.stars).reduce((a, b) => a + b, 0);
    const intro = el("section", "blocks-intro");
    const pic = el("img", "blocks-intro-pic");
    pic.src = "assets/pupa-hero.webp";
    pic.alt = "";
    const words = el("div", "blocks-intro-words");
    words.append(el("b", null, "ลากบล็อกเยลลี่ออกทางประตูสีเดียวกัน"),
      el("span", null, "บล็อกเลื่อนได้ทีละช่องผ่านช่องว่าง ต้องกว้างไม่เกินประตูถึงจะลอดออกได้ คิดลำดับให้ดีเพราะบล็อกขวางทางกันเอง · ❄ บล็อกน้ำแข็งจะละลายเมื่อมีบล็อกอื่นออกครบตามตัวเลข · ↔ ↕ บางบล็อกเลื่อนได้ทางเดียว · 🪨 หินขวางทาง · เหลือเวลา 35% ได้ ★★★"));
    intro.append(pic, words);
    const go = button("primary-button blocks-go", `▶ เล่นด่าน ${next}`, () => startLevel(next));
    const sum = el("p", "blocks-sum", `★ ${got}/${B.LEVELS * 3} · ผ่านแล้ว ${Object.keys(r.stars).length}/${B.LEVELS} ด่าน`);
    const grid = el("div", "blocks-levels");
    for (let n = 1; n <= B.LEVELS; n++) {
      const lv = B.levelOf(n), open = isOpenLevel(n), have = r.stars[n] || 0;
      const tile = button(`blocks-level${have ? " is-cleared" : open ? " is-next" : " is-locked"}`, null, () => startLevel(n),
        `ด่าน ${n} ${open ? (have ? `ได้ ${have} ดาว` : "เล่นได้") : "ล็อกอยู่"} · กระดาน ${lv.w}×${lv.h} · บล็อก ${lv.blocks} ชิ้น`);
      tile.disabled = !open;
      tile.append(el("b", null, open ? String(n) : "🔒"), el("small", "blocks-level-stars", open ? stars(have) : ""), el("small", "blocks-level-info", `${lv.blocks} ชิ้น ${twistIcons(lv)}`));
      grid.append(tile);
    }
    body.replaceChildren(intro, go, sum, grid);
    grid.querySelector(".is-next")?.scrollIntoView({ block: "nearest" });
  }

  // ---- Playing a level ----
  function startLevel(n) {
    if (!isOpenLevel(n)) return;
    stopPlay();
    const level = B.levelOf(n);
    const dealt = B.deal(level);
    const view = el("section", "blocks-play");
    const bar = el("div", "blocks-bar");
    const name = el("b", "blocks-name", `ด่าน ${n} · ${level.w}×${level.h}`);
    const left = el("span", "blocks-left");
    const hammer = button("blocks-tool", null, () => armHammer(), "ค้อน");
    const freeze = button("blocks-tool", null, () => useFreeze(), "หยุดเวลา");
    const hint = button("blocks-tool", null, () => useHint(), "คำใบ้");
    const stop = button("blocks-tool", "⏸", () => pause(), "พักเกม");
    bar.append(name, left, hammer, freeze, hint, stop);
    const clock = el("div", "blocks-clock");
    const fill = el("i");
    clock.append(fill);
    const wrap = el("div", "blocks-wrap");
    const boardEl = el("div", "blocks-board");
    wrap.append(boardEl);
    const note = el("p", "blocks-note");
    note.setAttribute("aria-live", "polite");
    view.append(bar, clock, wrap, note);
    body.replaceChildren(view);
    play = { level, state: B.clone(dealt.state), total: dealt.state.blocks.length, view, wrap, boardEl, fill, clock, note, left, hammer, freeze, hint,
      nodes: new Map(), gateNodes: [], hammers: B.HAMMERS, freezes: B.FREEZES, hints: B.HINTS, armed: false,
      time: level.time, remaining: level.time, frozenUntil: 0, paused: false, over: false, last: performance.now(), size: 0, drag: null };
    build();
    paintTools();
    tick();
    boardEl.addEventListener("pointerdown", grab);
    boardEl.addEventListener("pointermove", follow);
    boardEl.addEventListener("pointerup", drop);
    boardEl.addEventListener("pointercancel", drop);
    announce(`ด่าน ${n} · บล็อก ${play.total} ชิ้น · เวลา ${level.time} วินาที`);
    tone(523, .08, "triangle", .05); tone(784, .1, "triangle", .05, .08);
  }

  // The board: cells, rocks, gates in the rim, then the blocks.
  function build() {
    const p = play, s = p.state;
    p.boardEl.replaceChildren();
    p.boardEl.style.setProperty("--w", String(s.w));
    p.boardEl.style.setProperty("--h", String(s.h));
    const floor = el("div", "blocks-floor");
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
      const cell = el("i", s.rocks.includes(`${x},${y}`) ? "blocks-rock" : "blocks-cell");
      cell.style.gridColumn = String(x + 1);
      cell.style.gridRow = String(y + 1);
      floor.append(cell);
    }
    p.boardEl.append(floor);
    p.gateNodes = s.gates.map(g => {
      const gate = el("span", `blocks-gate is-${g.side}`);
      gate.style.setProperty("--c", B.COLOURS[g.colour].hex);
      for (let k = 0; k < g.len; k++) gate.append(el("b", null, ARROW[g.side]));
      gate.setAttribute("aria-label", `ประตูสี${colourName(g.colour)} ด้าน${SIDE_NAME[g.side]} กว้าง ${g.len} ช่อง`);
      p.boardEl.append(gate);
      return gate;
    });
    for (const b of s.blocks) {
      const node = el("button", "blocks-block");
      node.type = "button";
      node.dataset.block = String(b.id);
      node.style.setProperty("--c", B.COLOURS[b.colour].hex);
      const has = new Set(b.cells.map(([x, y]) => `${x},${y}`));
      const w = Math.max(...b.cells.map(c => c[0])) + 1, h = Math.max(...b.cells.map(c => c[1])) + 1;
      node.style.setProperty("--bw", String(w));
      node.style.setProperty("--bh", String(h));
      b.cells.forEach(([x, y], k) => {
        const cell = el("i", "blocks-jelly");
        cell.style.gridColumn = String(x + 1);
        cell.style.gridRow = String(y + 1);
        // round only the outer corners, so the cells read as one piece
        const n = (dx, dy) => has.has(`${x + dx},${y + dy}`);
        cell.style.borderRadius = [[!n(-1, 0) && !n(0, -1)], [!n(1, 0) && !n(0, -1)], [!n(1, 0) && !n(0, 1)], [!n(-1, 0) && !n(0, 1)]].map(([round]) => (round ? "28%" : "4%")).join(" ");
        // an edge drawn only round the outside of the block
        cell.style.borderWidth = [n(0, -1), n(1, 0), n(0, 1), n(-1, 0)].map(inside => (inside ? "0" : "2px")).join(" ");
        if (k === b.cells.length - 1 && b.cells.length > 1 && b.id % 3 === 0) cell.append(el("span", "blocks-shroom", "🍄"));
        node.append(cell);
      });
      // the mark (ice count, one-way arrow) on the block's first cell
      const mark = el("span", "blocks-mark");
      mark.style.left = `calc(var(--cell) * ${b.cells[0][0]})`;
      mark.style.top = `calc(var(--cell) * ${b.cells[0][1]})`;
      node.append(mark);
      p.boardEl.append(node);
      p.nodes.set(b.id, node);
    }
    layout();
    paint();
  }
  function layout() {
    const p = play;
    if (!p) return;
    const s = p.state, W = p.wrap.clientWidth, H = p.wrap.clientHeight;
    // the board and a half-cell rim each side for the gates
    const size = Math.max(26, Math.min(76, Math.floor(Math.min(W / (s.w + 1), H / (s.h + 1)))));
    p.size = size;
    p.boardEl.style.setProperty("--cell", `${size}px`);
    for (const b of s.blocks) place(b);
    s.gates.forEach((g, i) => {
      const gate = p.gateNodes[i], rim = size / 2;
      const along = rim + g.from * size, span = g.len * size;
      const v = g.side === "top" || g.side === "bottom";
      gate.style.left = `${v ? along : g.side === "left" ? 0 : rim + s.w * size}px`;
      gate.style.top = `${!v ? along : g.side === "top" ? 0 : rim + s.h * size}px`;
      gate.style.width = `${v ? span : rim}px`;
      gate.style.height = `${v ? rim : span}px`;
    });
  }
  const placeOf = (b, x = b.x, y = b.y) => `translate(${play.size / 2 + x * play.size}px, ${play.size / 2 + y * play.size}px)`;
  function place(b) { const node = play.nodes.get(b.id); if (node) node.style.transform = placeOf(b); }
  function paint() {
    const p = play;
    for (const b of p.state.blocks) {
      const node = p.nodes.get(b.id);
      if (!node) continue;
      node.classList.toggle("is-ice", b.ice > 0);
      const mark = node.querySelector(".blocks-mark");
      mark.textContent = b.ice > 0 ? `❄${b.ice}` : b.axis === "h" ? "↔" : b.axis === "v" ? "↕" : "";
      node.classList.toggle("is-oneway", Boolean(b.axis) && !b.ice);
      node.setAttribute("aria-label", `บล็อกสี${colourName(b.colour)} ${b.cells.length} ช่อง${b.ice ? ` แช่แข็ง ละลายเมื่อมีบล็อกออกอีก ${b.ice} ชิ้น` : ""}${b.axis === "h" ? " เลื่อนได้แค่ซ้ายขวา" : b.axis === "v" ? " เลื่อนได้แค่ขึ้นลง" : ""} · ใช้ปุ่มลูกศรเลื่อน`);
    }
    p.left.textContent = `เหลือ ${p.state.blocks.length}`;
  }

  // ---- Moving blocks ----
  function grab(event) {
    const p = play;
    const node = event.target.closest?.(".blocks-block");
    if (!p || p.over || p.paused || !node) return;
    const id = Number(node.dataset.block), b = p.state.blocks.find(x => x.id === id);
    if (!b) return;
    if (p.armed) { smash(id); return; }
    if (b.ice) { bump(id); say(`บล็อกนี้ถูกแช่แข็ง ละลายเมื่อมีบล็อกอื่นออกอีก ${b.ice} ชิ้น`); return; }
    event.preventDefault();
    p.boardEl.setPointerCapture?.(event.pointerId);
    p.drag = { id, pointer: event.pointerId, x0: event.clientX, y0: event.clientY, bx: b.x, by: b.y };
    node.classList.add("is-held");
    clearHint();
  }
  // follow the finger a cell at a time, the longer way first, sliding
  // round what is in the way where it can
  function follow(event) {
    const p = play, d = p?.drag;
    if (!d || event.pointerId !== d.pointer) return;
    const b = p.state.blocks.find(x => x.id === d.id);
    if (!b) return;
    const tx = d.bx + Math.round((event.clientX - d.x0) / p.size), ty = d.by + Math.round((event.clientY - d.y0) / p.size);
    for (let guard = 0; guard < 24 && play === p && p.drag && (b.x !== tx || b.y !== ty); guard++) {
      const ox = Math.sign(tx - b.x), oy = Math.sign(ty - b.y);
      const order = Math.abs(tx - b.x) >= Math.abs(ty - b.y) ? [[ox, 0], [0, oy]] : [[0, oy], [ox, 0]];
      if (!order.some(([dx, dy]) => (dx || dy) && slide(d.id, dx, dy))) break;
    }
  }
  function drop(event) {
    const p = play, d = p?.drag;
    if (!d || event.pointerId !== d.pointer) return;
    p.nodes.get(d.id)?.classList.remove("is-held");
    p.drag = null;
    // a tap without moving: keyboard focus, and a word on how it moves
    if (Math.abs(event.clientX - d.x0) < 6 && Math.abs(event.clientY - d.y0) < 6) p.nodes.get(d.id)?.focus({ preventScroll: true });
  }
  // One cell; then out through its gate if it can go.
  function slide(id, dx, dy) {
    const p = play;
    if (!B.step(p.state, id, dx, dy)) return false;
    const b = p.state.blocks.find(x => x.id === id);
    place(b);
    tone(300 + Math.random() * 40, .025, "triangle", .02);
    const gate = B.exitOf(p.state, b);
    if (gate) leave(b, gate);
    return true;
  }
  function bump(id) {
    const node = play.nodes.get(id);
    if (!node) return;
    node.classList.remove("is-no"); void node.offsetWidth; node.classList.add("is-no");
    tone(160, .08, "square", .03);
  }
  // A block goes out through its gate.
  function leave(b, gate) {
    const p = play, node = p.nodes.get(b.id);
    if (p.drag?.id === b.id) { p.drag = null; node.classList.remove("is-held"); }
    const side = B.SIDES[gate.side], reach = Math.max(p.state.w, p.state.h) + 2;
    B.remove(p.state, b.id);
    p.nodes.delete(b.id);
    node.disabled = true;
    node.classList.add("is-out");
    node.style.transform = placeOf(b, b.x + side.dx * reach, b.y + side.dy * reach);
    setTimeout(() => node.remove(), 420);
    const gateNode = p.gateNodes[p.state.gates.indexOf(gate)];
    gateNode?.classList.remove("is-eat"); void gateNode?.offsetWidth; gateNode?.classList.add("is-eat");
    [659, 880, 1047].forEach((note, i) => tone(note, .07, "triangle", .045, i * .05));
    afterGone();
  }
  function afterGone() {
    const p = play;
    const thawed = p.state.blocks.some(x => x.ice === 0 && p.nodes.get(x.id)?.classList.contains("is-ice"));
    paint();
    if (B.cleared(p.state)) { finish(true); return; }
    if (thawed) { say("บล็อกน้ำแข็งละลายแล้ว!"); [1175, 1568].forEach((note, i) => tone(note, .06, "sine", .035, i * .06)); }
  }

  // ---- Tools ----
  function armHammer() {
    const p = play;
    if (!p || p.over || p.paused || p.hammers <= 0) return;
    p.armed = !p.armed;
    p.hammer.classList.toggle("is-armed", p.armed);
    p.boardEl.classList.toggle("is-hammer", p.armed);
    say(p.armed ? "แตะบล็อกที่จะทุบ (แตะค้อนอีกครั้งเพื่อยกเลิก)" : "");
    tone(p.armed ? 523 : 330, .05, "triangle", .03);
  }
  function smash(id) {
    const p = play, node = p.nodes.get(id);
    p.hammers--;
    p.armed = false;
    p.hammer.classList.remove("is-armed");
    p.boardEl.classList.remove("is-hammer");
    B.remove(p.state, id);
    p.nodes.delete(id);
    node.disabled = true;
    node.classList.add("is-smashed");
    setTimeout(() => node.remove(), 420);
    [220, 165].forEach((note, i) => tone(note, .1, "square", .05, i * .06));
    paintTools();
    say("ทุบบล็อกแล้ว!");
    afterGone();
  }
  function useFreeze() {
    const p = play;
    if (!p || p.over || p.paused || p.freezes <= 0) return;
    p.freezes--;
    p.frozenUntil = performance.now() + B.FREEZE_SECONDS * 1000;
    p.clock.classList.add("is-frozen");
    paintTools();
    [988, 1319].forEach((note, i) => tone(note, .08, "sine", .04, i * .07));
    say(`หยุดเวลา ${B.FREEZE_SECONDS} วินาที!`);
  }
  function useHint() {
    const p = play;
    if (!p || p.over || p.paused || p.hints <= 0) return;
    const way = B.ways(p.state)[0];
    if (!way) { say("ตอนนี้ยังไม่มีบล็อกที่ออกได้ ลองเลื่อนบล็อกที่ขวางทางออกก่อน"); return; }
    p.hints--;
    paintTools();
    clearHint();
    const b = p.state.blocks.find(x => x.id === way.id);
    const gate = p.state.gates.find(g => g.colour === b.colour);
    p.nodes.get(b.id)?.classList.add("is-hint");
    p.gateNodes[p.state.gates.indexOf(gate)]?.classList.add("is-hint");
    p.hintTimer = setTimeout(clearHint, 2800);
    say(`บล็อกสี${colourName(b.colour)}ออกทางประตูด้าน${SIDE_NAME[gate.side]}ได้`);
    tone(880, .06, "sine", .04); tone(1175, .08, "sine", .04, .06);
  }
  function clearHint() {
    if (!play) return;
    clearTimeout(play.hintTimer);
    play.boardEl.querySelectorAll(".is-hint").forEach(n => n.classList.remove("is-hint"));
  }
  function paintTools() {
    const p = play;
    const set = (node, icon, n, label) => {
      node.replaceChildren(el("span", null, icon), el("small", null, String(n)));
      node.setAttribute("aria-label", `${label} เหลือ ${n} ครั้ง`);
      node.disabled = n <= 0 || p.over;
    };
    set(p.hammer, "🔨", p.hammers, "ค้อนทุบบล็อก");
    set(p.freeze, "❄", p.freezes, "หยุดเวลา");
    set(p.hint, "💡", p.hints, "คำใบ้");
  }
  function say(text) {
    if (!play) return;
    play.note.textContent = text;
    clearTimeout(play.noteTimer);
    if (text) play.noteTimer = setTimeout(() => { if (play) play.note.textContent = ""; }, 3200);
  }

  // ---- The clock ----
  function tick() {
    const p = play;
    if (!p || p.over) return;
    const now = performance.now();
    if (!p.paused && now >= p.frozenUntil) p.remaining = Math.max(0, p.remaining - (now - p.last) / 1000);
    if (p.frozenUntil && now >= p.frozenUntil) { p.frozenUntil = 0; p.clock.classList.remove("is-frozen"); }
    p.last = now;
    const share = p.remaining / p.time;
    p.fill.style.width = `${share * 100}%`;
    p.clock.classList.toggle("is-low", share < .2);
    p.clock.classList.toggle("is-gold", share >= B.STAR_TIME[1]);
    p.clock.dataset.time = `${Math.ceil(p.remaining)} วิ`;
    if (p.remaining <= 0) { finish(false); return; }
    p.frame = requestAnimationFrame(tick);
  }
  function pause() {
    const p = play;
    if (!p || p.over || p.paused) return;
    p.paused = true;
    if (p.frozenUntil) p.frozenLeft = p.frozenUntil - performance.now();
    p.view.classList.add("is-paused");
    const box = el("div", "blocks-cover");
    box.append(el("h3", null, "พักเกม"), el("p", null, `ด่าน ${p.level.num} · เหลือเวลา ${Math.ceil(p.remaining)} วินาที`));
    const actions = el("div", "title-actions");
    actions.append(button("primary-button", "เล่นต่อ ▶", () => resume()), button("secondary-button", "เริ่มใหม่", () => startLevel(p.level.num)), button("secondary-button", "เลือกด่าน", () => showLevels()));
    box.append(actions);
    p.cover = box;
    p.view.append(box);
    box.querySelector("button")?.focus();
  }
  function resume() {
    const p = play;
    if (!p || !p.paused) return;
    p.paused = false;
    p.last = performance.now();
    if (p.frozenLeft > 0) { p.frozenUntil = p.last + p.frozenLeft; p.frozenLeft = 0; }
    p.view.classList.remove("is-paused");
    p.cover?.remove();
    p.cover = null;
  }
  function stopPlay() {
    if (!play) return;
    cancelAnimationFrame(play.frame);
    clearTimeout(play.hintTimer); clearTimeout(play.noteTimer);
    play = null;
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden && play && !play.over) pause(); });
  new ResizeObserver(() => { if (play && !play.over) layout(); }).observe(screen);

  // ---- The end ----
  function finish(won) {
    const p = play;
    p.over = true;
    cancelAnimationFrame(p.frame);
    paintTools();
    const n = p.level.num, r = record(), before = r.stars[n] || 0;
    const box = el("div", `blocks-cover blocks-result${won ? " is-won" : ""}`);
    if (won) {
      const got = B.starsFor(p.level, p.remaining);
      const reward = B.rewardFor(p.level, !before, got, before);
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
      box.append(el("span", "blocks-medal", "🏆"), el("h3", null, `ผ่านด่าน ${n}!`), el("p", "blocks-stars", stars(got)),
        el("p", null, `เหลือเวลา ${Math.ceil(p.remaining)} วินาที จาก ${p.time}`),
        el("p", "blocks-reward", `ได้รับ ${parts.join(" · ")}`),
        el("p", "blocks-tip", got < 3 ? `เหลือเวลาอย่างน้อย ${Math.round(B.STAR_TIME[1] * 100)}% เพื่อได้ ★★★` : "ได้ครบ 3 ดาว!"));
      [523, 659, 784, 1047].forEach((note, i) => tone(note, .14, "triangle", .05, i * .1));
      announce(`ผ่านด่าน ${n} ได้ ${got} ดาว`);
      confetti(p.view);
    } else {
      box.append(el("span", "blocks-medal", "⏰"), el("h3", null, "หมดเวลา!"), el("p", null, `เหลือบล็อก ${p.state.blocks.length} ชิ้น · ลองใช้ 💡 คำใบ้ ❄ หยุดเวลา หรือ 🔨 ค้อน แล้วลองใหม่นะ`));
      [392, 330, 262].forEach((note, i) => tone(note, .18, "triangle", .04, i * .14));
      announce("หมดเวลา");
    }
    const actions = el("div", "title-actions");
    if (won && n < B.LEVELS) actions.append(button("primary-button", `ด่าน ${n + 1} ▶`, () => startLevel(n + 1)));
    actions.append(button(won && n < B.LEVELS ? "secondary-button" : "primary-button", "เล่นอีกครั้ง", () => startLevel(n)), button("secondary-button", "เลือกด่าน", () => showLevels()));
    box.append(actions);
    p.view.append(box);
    box.querySelector("button")?.focus();
  }
  function confetti(host) {
    if (calm()) return;
    const colours = B.COLOURS.map(c => c.hex);
    for (let i = 0; i < 40; i++) {
      const bit = el("i", "blocks-confetti");
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = colours[i % colours.length];
      bit.style.animationDelay = `${Math.random() * .5}s`;
      bit.style.setProperty("--drift", `${(Math.random() - .5) * 120}px`);
      host.append(bit);
      setTimeout(() => bit.remove(), 2600);
    }
  }

  window.PupaBlocks = { open, close: goHome, key, get isOpen() { return isShown; } };
  // Test link: ?blocks opens straight into the block jam.
  if (new URLSearchParams(location.search).has("blocks")) setTimeout(() => open(), 400);
})();

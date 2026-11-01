// The perspective maze (เขาวงกตมุมมอง): the screens. The rules and levels
// live in maze-engine.js; game.js lends the save, sounds and coins through
// window.PupaGame and keeps its own keys quiet while this is open.
//
// save.maze = { stars: { level: best stars } }.
(() => {
  "use strict";
  const M = window.PupaMazeEngine;
  const screen = document.querySelector("#mazeScreen");
  if (!M || !screen) return;

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
  const LEVELS = M.LEVELS.length;
  // each moving part's colours: top, left side, right side
  const GROUP_LOOK = [["#ffd1e1", "#f29ab8", "#d9779a"], ["#c8f1ff", "#86cde8", "#5ea9c9"], ["#d9f7c8", "#9ed48a", "#78b266"], ["#ffe6b8", "#f2c27a", "#d39d52"]];
  const STONE = ["#f3ecff", "#c6b8ec", "#a493d8"];

  // ---- The save ----
  function progress() {
    const s = save();
    const raw = s.maze && typeof s.maze === "object" ? s.maze : {};
    const out = {};
    for (let n = 1; n <= LEVELS; n++) { const v = Math.min(3, Math.floor(Number(raw.stars?.[n]) || 0)); if (v > 0) out[n] = v; }
    s.maze = { stars: out };
    return s.maze;
  }
  const record = () => save().maze;
  const isOpenLevel = (n) => n === 1 || (record().stars[n - 1] || 0) > 0;
  const nextLevel = () => { for (let n = 1; n <= LEVELS; n++) if (!record().stars[n]) return n; return LEVELS; };
  // the fewest moves of each level, worked out once
  const best = new Map();
  const bestOf = (n) => { if (!best.has(n)) best.set(n, M.solve(n)?.moves ?? 0); return best.get(n); };

  // ---- The frame ----
  const frame = el("div", "shop-card maze-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "เขาวงกตมุมมอง");
  title.id = "mazeTitle";
  const wallet = el("div", "shop-wallet");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  const homeButton = button("icon-button maze-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(homeButton, title, wallet);
  const body = el("div", "maze-body");
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
    game().setMazeOpen?.(true);
    showLevels();
    tone(659, .07, "triangle", .04);
    homeButton.focus();
  }
  function goHome() {
    stopPlay();
    isShown = false;
    screen.hidden = true;
    game().setMazeOpen?.(false);
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
    const intro = el("section", "maze-intro");
    const pic = el("img", "maze-intro-pic");
    pic.src = "assets/pupa-hero.webp";
    pic.alt = "";
    const words = el("div", "maze-intro-words");
    words.append(el("b", null, "พา Pupa เดินไปถึงประตูมิติที่เรืองแสง"),
      el("span", null, "แตะช่องที่อยากไป Pupa จะเดินไปเอง ความลับของที่นี่: ทางที่ดูต่อกันบนจอ เดินข้ามได้จริง แม้จะอยู่คนละความสูง! หมุนกลไก ⟳ และเลื่อนแท่น ⇅ ด้วยปุ่มด้านล่าง ให้ทางที่ขาดดูต่อกัน · ยืนบนกลไกแล้วขยับ Pupa จะไปด้วย · ขยับน้อยที่สุดได้ ★★★"));
    intro.append(pic, words);
    const go = button("primary-button maze-go", `▶ เล่นด่าน ${next}`, () => startLevel(next));
    const sum = el("p", "maze-sum", `★ ${got}/${LEVELS * 3} · ผ่านแล้ว ${Object.keys(r.stars).length}/${LEVELS} ด่าน`);
    const grid = el("div", "maze-levels");
    for (let n = 1; n <= LEVELS; n++) {
      const open = isOpenLevel(n), have = r.stars[n] || 0, def = M.LEVELS[n - 1];
      const tile = button(`maze-level${have ? " is-cleared" : open ? " is-next" : " is-locked"}`, null, () => startLevel(n), `ด่าน ${n} ${def.name} ${open ? (have ? `ได้ ${have} ดาว` : "เล่นได้") : "ล็อกอยู่"}`);
      tile.disabled = !open;
      tile.append(el("b", null, open ? String(n) : "🔒"), el("small", "maze-level-name", open ? def.name : ""), el("small", "maze-level-stars", open ? stars(have) : ""));
      grid.append(tile);
    }
    body.replaceChildren(intro, go, sum, grid);
    grid.querySelector(".is-next")?.scrollIntoView({ block: "nearest" });
  }

  // ---- Playing a level ----
  function startLevel(n) {
    if (!isOpenLevel(n)) return;
    stopPlay();
    const def = M.LEVELS[n - 1];
    const view = el("section", "maze-play");
    const bar = el("div", "maze-bar");
    const name = el("b", "maze-name", `ด่าน ${n} · ${def.name}`);
    const count = el("span", "maze-count");
    const undo = button("maze-tool", "↶", () => useUndo(), "ย้อนกลับ");
    const hint = button("maze-tool", "💡", () => useHint(), "คำใบ้");
    const again = button("maze-tool", "⟲", () => startLevel(n), "เริ่มด่านใหม่");
    bar.append(name, count, undo, hint, again);
    const wrap = el("div", "maze-wrap");
    const scene = svg("svg", { class: "maze-scene", role: "group", "aria-label": "ฉากเขาวงกต แตะช่องเพื่อเดิน" });
    wrap.append(scene);
    const controls = el("div", "maze-controls");
    const note = el("p", "maze-note", def.tip);
    note.setAttribute("aria-live", "polite");
    view.append(bar, wrap, controls, note);
    body.replaceChildren(view);
    play = { n, def, state: M.build(n), history: [], best: bestOf(n), hints: 0, busy: false, over: false,
      view, wrap, scene, controls, note, count, undo, hint, frame: null, offset: null, facing: 1 };
    buildControls();
    fit();
    draw();
    paintTools();
    announce(`ด่าน ${n} ${def.name}. ${def.tip}`);
    tone(523, .08, "triangle", .05); tone(784, .1, "triangle", .05, .08);
  }

  // one button per moving part, in its colour
  function buildControls() {
    const p = play;
    p.controlNodes = p.state.groups.map((g, i) => {
      const look = GROUP_LOOK[i % GROUP_LOOK.length];
      const box = el("div", "maze-control");
      box.style.setProperty("--c", look[1]);
      box.style.setProperty("--d", look[2]);
      if (g.turn) box.append(button("maze-knob", "⟳", () => act(i, 1), `หมุนกลไกสี${i + 1}`));
      else {
        // which way each push goes on the screen: +x down-right, +y down-left, +z up
        const [lessIcon, moreIcon] = { x: ["↖", "↘"], y: ["↗", "↙"], z: ["⬇", "⬆"] }[g.slide];
        box.append(button("maze-knob", lessIcon, () => act(i, -1), `เลื่อนแท่นสี${i + 1} ถอยหลัง`), button("maze-knob", moreIcon, () => act(i, 1), `เลื่อนแท่นสี${i + 1} ไปข้างหน้า`));
      }
      box.addEventListener("pointerenter", () => mark(i, true));
      box.addEventListener("pointerleave", () => mark(i, false));
      p.controls.append(box);
      return box;
    });
    if (!p.state.groups.length) p.controls.append(el("span", "maze-controls-none", "ด่านนี้ไม่มีกลไก แตะช่องเพื่อเดินได้เลย"));
  }
  function mark(i, on) { play?.scene.querySelectorAll(`[data-group="${i}"]`).forEach(n => n.classList.toggle("is-marked", on)); }

  // The scene's scale: the world's corners projected, fitted to the space.
  function fit() {
    const p = play;
    const pts = [];
    // every place each block can ever be, so turning doesn't leave the view
    p.state.blocks.forEach(b => {
      const g = p.state.groups[b.group];
      const steps = !g ? [0] : g.turn ? [0, 1, 2, 3] : Array.from({ length: g.to - g.from + 1 }, (_, k) => g.from + k);
      for (const step of steps) {
        const [x, y, z] = g ? M.spot(g, b.home, step) : b.home;
        for (const [dx, dy, dz] of [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 0], [1, 0, 0], [0, 1, 0]]) pts.push(M.project(x + dx, y + dy, z + dz));
      }
    });
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const minX = Math.min(...xs) - .6, maxX = Math.max(...xs) + .6, minY = Math.min(...ys) - 1.8, maxY = Math.max(...ys) + .4;
    p.scene.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
  }

  // Draw the world: blocks back to front, Pupa just after her block.
  // During a move, `p.offset` gives the moving group's blocks their place.
  function draw() {
    const p = play, s = p.state;
    const at = (b) => p.offset?.get(b.id) || [b.x, b.y, b.z];
    const shown = M.tops(s), reach = p.busy ? new Map() : M.reach(s);
    const order = s.blocks.map(b => ({ b, pos: at(b) })).sort((a, c) => (a.pos[0] + a.pos[1] + a.pos[2]) - (c.pos[0] + c.pos[1] + c.pos[2]) || a.pos[2] - c.pos[2]);
    const nodes = [];
    const pt = (x, y, z) => M.project(x, y, z).join(",");
    for (const { b, pos: [x, y, z] } of order) {
      const look = b.group < 0 ? STONE : GROUP_LOOK[b.group % GROUP_LOOK.length];
      const g = svg("g", { class: "maze-block" });
      if (b.group >= 0) g.dataset.group = String(b.group);
      g.append(
        svg("polygon", { class: "maze-left", points: [pt(x, y + 1, z + 1), pt(x + 1, y + 1, z + 1), pt(x + 1, y + 1, z), pt(x, y + 1, z)].join(" "), fill: look[1] }),
        svg("polygon", { class: "maze-right", points: [pt(x + 1, y, z + 1), pt(x + 1, y + 1, z + 1), pt(x + 1, y + 1, z), pt(x + 1, y, z)].join(" "), fill: look[2] })
      );
      const isTop = shown.get(`${b.x - b.z},${b.y - b.z}`) === b;
      const top = svg("polygon", { class: `maze-top${isTop ? " is-walk" : ""}${b.id === s.goal ? " is-goal" : ""}`, points: [pt(x, y, z + 1), pt(x + 1, y, z + 1), pt(x + 1, y + 1, z + 1), pt(x, y + 1, z + 1)].join(" "), fill: look[0] });
      if (isTop) {
        top.dataset.id = String(b.id);
        top.setAttribute("tabindex", "0");
        top.setAttribute("role", "button");
        top.setAttribute("aria-label", `${b.id === s.goal ? "ประตูมิติ" : "ช่อง"}${reach.has(b.id) ? " เดินไปได้" : " ยังไปไม่ถึง"}`);
      }
      g.append(top);
      // a mark on the side of what moves, and the portal on the goal
      if (b.group >= 0) g.append(svg("circle", { class: "maze-stud", cx: M.project(x + 1, y + .5, z + .5)[0], cy: M.project(x + 1, y + .5, z + .5)[1], r: .1 }));
      const [cx, cy] = M.project(x + .5, y + .5, z + 1);
      if (b.id === s.goal) {
        g.append(svg("ellipse", { class: "maze-portal-glow", cx, cy, rx: .55, ry: .28 }), svg("path", { class: "maze-portal", d: `M${cx - .32} ${cy}v-.7a.32 .32 0 0 1 .64 0v.7z` }));
      } else if (isTop && reach.has(b.id) && b.id !== s.at) g.append(svg("circle", { class: "maze-dot", cx, cy, r: .07 }));
      nodes.push(g);
      // Pupa stands on her block
      if (b.id === s.at) nodes.push(pupa(cx, cy));
    }
    p.scene.replaceChildren(...nodes);
    p.count.textContent = `ขยับ ${s.moves}`;
  }
  function pupa(cx, cy) {
    const p = play;
    const g = svg("g", { class: "maze-pupa", transform: `translate(${p.walkAt?.[0] ?? cx} ${p.walkAt?.[1] ?? cy})` });
    const img = svg("image", { href: "assets/pupa-hero.webp", x: -.55, y: -1.25, width: 1.1, height: 1.2, transform: `scale(${p.facing} 1)` });
    g.append(svg("ellipse", { class: "maze-shadow", cx: 0, cy: 0, rx: .32, ry: .14 }), img);
    return g;
  }

  // ---- Walking ----
  screen.addEventListener("click", (event) => {
    const top = event.target.closest?.(".maze-top.is-walk");
    if (top && play?.scene.contains(top)) goTo(Number(top.dataset.id));
  });
  screen.addEventListener("keydown", (event) => {
    const top = event.target.closest?.(".maze-top.is-walk");
    if (top && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); goTo(Number(top.dataset.id)); }
  });
  async function goTo(id) {
    const p = play;
    if (!p || p.over || p.busy) return;
    clearHint();
    if (id === p.state.at) return;
    const path = M.pathTo(p.state, id);
    if (!path) {
      tone(180, .1, "square", .04);
      say("ยังเดินไปไม่ถึง ลองหมุนกลไกหรือเลื่อนแท่นให้ทางดูต่อกัน");
      return;
    }
    p.busy = true;
    draw();
    for (let k = 1; k < path.length; k++) {
      const from = p.state.blocks.find(b => b.id === path[k - 1]), to = p.state.blocks.find(b => b.id === path[k]);
      const a = M.project(from.x + .5, from.y + .5, from.z + 1), c = M.project(to.x + .5, to.y + .5, to.z + 1);
      p.facing = c[0] < a[0] ? -1 : 1;
      if (!calm()) {
        // glide across the screen; the step's depth changes when she lands
        const frames = 8;
        for (let f = 1; f <= frames; f++) {
          p.walkAt = [a[0] + (c[0] - a[0]) * f / frames, a[1] + (c[1] - a[1]) * f / frames - Math.sin(Math.PI * f / frames) * .12];
          p.scene.querySelector(".maze-pupa")?.setAttribute("transform", `translate(${p.walkAt[0]} ${p.walkAt[1]})`);
          await wait(18);
          if (play !== p) return;
        }
      }
      p.walkAt = null;
      p.state.at = to.id;
      draw();
      tone(523 + (k % 3) * 66, .04, "triangle", .025);
    }
    p.busy = false;
    draw();
    if (M.won(p.state)) finish();
  }

  // ---- Moving parts ----
  async function act(i, dir) {
    const p = play;
    if (!p || p.over || p.busy) return;
    clearHint();
    if (!M.canMove(p.state, i, dir)) {
      p.controlNodes[i]?.classList.remove("is-no"); void p.controlNodes[i]?.offsetWidth; p.controlNodes[i]?.classList.add("is-no");
      tone(160, .1, "square", .04);
      say("ขยับไม่ได้ ติดสิ่งกีดขวาง สุดทาง หรือจะบัง Pupa");
      return;
    }
    p.history.push(M.clone(p.state));
    const g = p.state.groups[i];
    const before = g.step, after = g.turn ? before + 1 : before + dir;
    p.busy = true;
    tone(g.turn ? 330 : 392, .12, "sawtooth", .025);
    if (!calm()) {
      // turn or slide smoothly: each block of the group along its way
      const blocks = p.state.blocks.filter(b => b.group === i);
      const frames = 16;
      for (let f = 1; f < frames; f++) {
        const t = easeInOut(f / frames);
        p.offset = new Map(blocks.map(b => [b.id, between(g, b.home, before, after, t)]));
        draw();
        await wait(22);
        if (play !== p) return;
      }
      p.offset = null;
    }
    M.move(p.state, i, dir);
    p.busy = false;
    draw();
    paintTools();
    tone(g.turn ? 494 : 523, .06, "triangle", .04);
  }
  const easeInOut = (t) => t * t * (3 - 2 * t);
  // a block's place part way between two steps of its group
  function between(g, home, from, to, t) {
    if (g.turn) {
      const angle = (from + t * (to - from)) * Math.PI / 2;
      const dx = home[0] - g.turn[0], dy = home[1] - g.turn[1];
      return [g.turn[0] + dx * Math.cos(angle) - dy * Math.sin(angle), g.turn[1] + dx * Math.sin(angle) + dy * Math.cos(angle), home[2]];
    }
    const a = M.spot(g, home, from), b = M.spot(g, home, to);
    return a.map((v, k) => v + (b[k] - v) * t);
  }

  // ---- Tools ----
  function useUndo() {
    const p = play;
    if (!p || p.over || p.busy || !p.history.length) return;
    p.state = p.history.pop();
    draw();
    paintTools();
    tone(440, .05, "triangle", .03);
  }
  // The solver's next step from here: walk somewhere, or work a part.
  function useHint() {
    const p = play;
    if (!p || p.over || p.busy) return;
    const plan = M.solveFrom(p.state);
    if (!plan) { say("ทางตันแล้ว ลองย้อนกลับหรือเริ่มใหม่"); return; }
    p.hints++;
    clearHint();
    if (!plan.plan.length) {
      p.scene.querySelector(".maze-top.is-goal")?.classList.add("is-hint");
      say("ทางไปประตูมิติเปิดแล้ว แตะที่ประตูได้เลย!");
    } else {
      const step = plan.plan[0];
      if (step.at !== p.state.at) {
        p.scene.querySelector(`.maze-top[data-id="${step.at}"]`)?.classList.add("is-hint");
        say("เดินไปที่ช่องที่กระพริบก่อน แล้วค่อยขยับกลไก");
      } else {
        p.controlNodes[step.group]?.classList.add("is-hint");
        say(p.state.groups[step.group].turn ? "ลองหมุนกลไกที่กระพริบ" : "ลองเลื่อนแท่นที่กระพริบ");
      }
    }
    p.hintTimer = setTimeout(clearHint, 3000);
    tone(880, .06, "sine", .04); tone(1175, .08, "sine", .04, .06);
  }
  function clearHint() {
    if (!play) return;
    clearTimeout(play.hintTimer);
    play.view.querySelectorAll(".is-hint").forEach(n => n.classList.remove("is-hint"));
  }
  function paintTools() {
    const p = play;
    p.undo.disabled = p.over || !p.history.length;
    p.hint.disabled = p.over;
  }
  function say(text) {
    if (!play) return;
    play.note.textContent = text;
  }
  function stopPlay() {
    if (!play) return;
    clearTimeout(play.hintTimer);
    play = null;
  }

  // ---- The end ----
  async function finish() {
    const p = play;
    p.over = true;
    paintTools();
    p.view.classList.add("is-won");
    [659, 784, 988, 1319].forEach((note, i) => tone(note, .12, "sine", .045, i * .09));
    await wait(calm() ? 0 : 700);
    if (play !== p) return;
    const n = p.n, r = record(), before = r.stars[n] || 0;
    const got = Math.min(M.starsFor(p.best, p.state.moves), p.hints ? 2 : 3);
    const reward = M.rewardFor(n, !before, got, before);
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
    const box = el("div", "maze-cover maze-result");
    box.append(el("span", "maze-medal", "🌙"), el("h3", null, `ผ่านด่าน ${n}!`), el("p", "maze-stars", stars(got)),
      el("p", null, `ขยับกลไก ${p.state.moves} ครั้ง · น้อยที่สุด ${p.best} ครั้ง${p.hints ? ` · ใช้คำใบ้ ${p.hints}` : ""}`),
      el("p", "maze-reward", `ได้รับ ${parts.join(" · ")}`),
      el("p", "maze-tip", got < 3 ? (p.hints ? "ไม่ใช้คำใบ้ และขยับให้น้อยที่สุด เพื่อได้ ★★★" : `ขยับไม่เกิน ${p.best} ครั้ง เพื่อได้ ★★★`) : "ได้ครบ 3 ดาว!"));
    const actions = el("div", "title-actions");
    if (n < LEVELS) actions.append(button("primary-button", `ด่าน ${n + 1} ▶`, () => startLevel(n + 1)));
    else box.append(el("p", "maze-tip", "ผ่านครบทุกด่านแล้ว เก่งมาก!"));
    actions.append(button(n < LEVELS ? "secondary-button" : "primary-button", "เล่นอีกครั้ง", () => startLevel(n)), button("secondary-button", "เลือกด่าน", () => showLevels()));
    box.append(actions);
    p.view.append(box);
    announce(`ผ่านด่าน ${n} ได้ ${got} ดาว`);
    box.querySelector("button")?.focus();
  }

  window.PupaMaze = { open, close: goHome, key, get isOpen() { return isShown; } };
  // Test link: ?maze opens straight into the perspective maze.
  if (new URLSearchParams(location.search).has("maze")) setTimeout(() => open(), 400);
})();

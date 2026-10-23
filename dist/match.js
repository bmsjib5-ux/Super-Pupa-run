// Match mode (จับคู่การ์ด): the screens. The rules live in match-engine.js;
// game.js lends the save, sounds and coins through window.PupaGame and
// keeps its own keys quiet while this is open.
//
// save.match = { stars: { level: best stars }, best: { level: best score } }.
(() => {
  "use strict";
  const M = window.PupaMatchEngine;
  const screen = document.querySelector("#matchScreen");
  if (!M || !screen) return;

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

  // ---- The pictures: the card characters, then the monsters ----
  const CE = window.PupaCardsEngine;
  const PETS = new Set(["firefly", "kitten", "minibat", "starsprite", "dragon", "moonrabbit", "starowl", "silverwolf", "phoenix", "qilin"]);
  const FOE_ART = ["bat", "hopper", "urchin", "spitter", "jelly", "crab", "roller", "swooper", "runeknight", "spellbook", "candlewisp", "towergolem", "shadowcat", "mirrorwraith", "tombguard", "skullarcher", "wraithhound", "banshee", "hauntdoll", "ghostlantern", "manticore", "gargoyle", "griffin", "basilisk", "nightunicorn", "shelltortoise", "windupsoldier", "cuckoobird", "gearspider", "steamowl", "repairbot", "sentinelorb", "starknight", "cometimp", "voidassassin", "astromage", "moonpriestess", "crystalwarden"];
  const HEROES = (CE?.CARD_IDS || []).map(id => ({ id, name: CE.CARDS[id].name, src: `assets/${id}-${PETS.has(id) ? "pet" : "hero"}.webp`, grade: CE.CARDS[id].rarity }));
  const MONSTERS = FOE_ART.filter(id => CE?.FOES?.[id]).map(id => ({ id, name: CE.FOES[id].name, src: `assets/foe-${id}.webp`, grade: 0 }));

  // ---- The save ----
  function progress() {
    const s = save();
    const raw = s.match && typeof s.match === "object" ? s.match : {};
    const clean = (map, max) => {
      const out = {};
      for (let n = 1; n <= M.LEVELS; n++) { const v = Math.min(max, Math.floor(Number(map?.[n]) || 0)); if (v > 0) out[n] = v; }
      return out;
    };
    s.match = { stars: clean(raw.stars, 3), best: clean(raw.best, 1e7) };
    return s.match;
  }
  const record = () => save().match;
  const isOpenLevel = (n) => n === 1 || (record().stars[n - 1] || 0) > 0;
  const nextLevel = () => { for (let n = 1; n <= M.LEVELS; n++) if (!record().stars[n]) return n; return M.LEVELS; };
  const stars = (n) => "★".repeat(n) + "☆".repeat(3 - n);

  // ---- The frame ----
  const frame = el("div", "shop-card match-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "จับคู่การ์ด");
  title.id = "matchTitle";
  const wallet = el("div", "shop-wallet");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  const homeButton = button("icon-button match-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(homeButton, title, wallet);
  const body = el("div", "match-body");
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
    game().setMatchOpen?.(true);
    showLevels();
    tone(659, .07, "triangle", .04);
    homeButton.focus();
  }
  function goHome() {
    stopPlay();
    isShown = false;
    screen.hidden = true;
    game().setMatchOpen?.(false);
    game().showModes?.();
  }
  function key(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (play && !play.over) { if (play.paused) resume(); else pause(); }
    else if (play) showLevels();
    else goHome();
  }

  // ---- Choosing a level ----
  function showLevels() {
    stopPlay();
    showCoins();
    const r = record(), next = nextLevel();
    const got = Object.values(r.stars).reduce((a, b) => a + b, 0);
    const intro = el("section", "match-intro");
    const pics = el("div", "match-intro-pics");
    for (const id of ["pupa", "jibjib", "chantra", "ikuya"]) { const p = HEROES.find(h => h.id === id); if (p) { const img = el("img"); img.src = p.src; img.alt = ""; pics.append(img); } }
    const words = el("div", "match-intro-words");
    words.append(el("b", null, "แตะการ์ดหน้าเหมือนกัน 2 ใบเพื่อจับคู่"), el("span", null, "ลากเส้นเชื่อมได้หักมุมไม่เกิน 2 ครั้ง เส้นอ้อมขอบนอกกระดานได้ แต่ห้ามผ่านการ์ดใบอื่น เก็บให้หมดก่อนหมดเวลา · จับคู่ติด ๆ กันได้คอมโบ · เหลือเวลา 35% ได้ ★★★"));
    intro.append(pics, words);
    const go = button("primary-button match-go", `▶ เล่นด่าน ${next}`, () => startLevel(next));
    const sum = el("p", "match-sum", `★ ${got}/${M.LEVELS * 3} · ผ่านแล้ว ${Object.keys(r.stars).length}/${M.LEVELS} ด่าน`);
    const grid = el("div", "match-levels");
    for (let n = 1; n <= M.LEVELS; n++) {
      const lv = M.levelOf(n), open = isOpenLevel(n), got = r.stars[n] || 0;
      const tile = button(`match-level${got ? " is-cleared" : open ? " is-next" : " is-locked"}`, null, () => startLevel(n), `ด่าน ${n} ${open ? `${got ? `ได้ ${got} ดาว` : "เล่นได้"}` : "ล็อกอยู่"} · ${lv.rows}×${lv.cols} · ${M.GRAVITY_NAMES[lv.gravity]}`);
      tile.disabled = !open;
      tile.append(el("b", null, open ? String(n) : "🔒"), el("small", "match-level-stars", open ? stars(got) : ""), el("small", "match-level-info", `${lv.rows * lv.cols} ใบ${lv.gravity !== "none" ? ` · ${GRAVITY_ICON[lv.gravity]}` : ""}`));
      grid.append(tile);
    }
    body.replaceChildren(intro, go, sum, grid);
    grid.querySelector(".is-next")?.scrollIntoView({ block: "nearest" });
  }
  const GRAVITY_ICON = { down: "⬇", up: "⬆", left: "⬅", right: "➡" };

  // ---- Playing a level ----
  function startLevel(n) {
    if (!isOpenLevel(n)) return;
    stopPlay();
    const level = M.levelOf(n);
    const view = el("section", "match-play");
    const bar = el("div", "match-bar");
    const name = el("b", "match-name", `ด่าน ${n}${level.gravity !== "none" ? ` · ${GRAVITY_ICON[level.gravity]} ${M.GRAVITY_NAMES[level.gravity]}` : ""}`);
    const score = el("span", "match-score", "0");
    const clock = el("div", "match-clock");
    const fill = el("i");
    clock.append(fill);
    const hint = button("match-tool", null, () => useHint(), "คำใบ้");
    const mix = button("match-tool", null, () => useShuffle(), "สลับการ์ด");
    const stop = button("match-tool", "⏸", () => pause(), "พักเกม");
    bar.append(name, score, hint, mix, stop);
    const wrap = el("div", "match-wrap");
    const boardEl = el("div", "match-board");
    const line = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    line.classList.add("match-line");
    line.setAttribute("aria-hidden", "true");
    boardEl.append(line);
    wrap.append(boardEl);
    const note = el("p", "match-note");
    note.setAttribute("aria-live", "polite");
    view.append(bar, clock, wrap, note);
    body.replaceChildren(view);
    // a tall screen turns the board
    const tall = wrap.clientHeight > wrap.clientWidth * 1.1;
    const rows = tall ? level.cols : level.rows, cols = tall ? level.rows : level.cols;
    const rnd = M.random((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const grid = M.deal(level, rnd, rows, cols);
    // the pictures this time: card characters first, monsters from level 11
    const pool = [...HEROES, ...(n > 10 ? MONSTERS : [])];
    const pics = [];
    const bag = pool.slice();
    for (let t = 0; t < level.types; t++) {
      if (!bag.length) bag.push(...pool);
      pics.push(bag.splice(Math.floor(rnd() * bag.length), 1)[0]);
    }
    play = { level, rows, cols, grid, ids: M.emptyGrid(rows, cols), tiles: new Map(), pics, rnd, boardEl, line, fill, score, note, hint, mix, stop, view, wrap,
      pick: null, points: 0, combo: 0, lastMatch: 0, hints: M.HINTS, shuffles: M.SHUFFLES, left: level.time, paused: false, over: false, size: 0, last: performance.now() };
    let id = 0;
    for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) {
      const t = grid[r][c];
      if (!t) continue;
      id++;
      const pic = pics[t - 1];
      const tile = button("match-tile", null, () => tap(tileId), null);
      // each picture its own tint, spread round the colour wheel, so a pair
      // is easy to spot
      tile.style.setProperty("--hue", String(Math.round((t * 137.508) % 360)));
      const tileId = id;
      const img = el("img");
      img.src = pic.src; img.alt = ""; img.draggable = false; img.decoding = "async";
      tile.append(img);
      boardEl.append(tile);
      play.ids[r][c] = id;
      play.tiles.set(id, { id, type: t, r, c, node: tile, name: pic.name });
    }
    layout();
    paintTools();
    tick();
    announce(`ด่าน ${n} · ${rows * cols} ใบ · เวลา ${level.time} วินาที`);
    tone(523, .08, "triangle", .05); tone(784, .1, "triangle", .05, .08);
  }

  // Fit the board to the space: square tiles, a ring of half-tiles round
  // the edge for lines that run outside.
  function layout() {
    const p = play;
    if (!p) return;
    const W = p.wrap.clientWidth, H = p.wrap.clientHeight;
    const size = Math.max(22, Math.min(92, Math.floor(Math.min(W / (p.cols + 1), H / (p.rows + 1)))));
    p.size = size;
    p.boardEl.style.width = `${(p.cols + 1) * size}px`;
    p.boardEl.style.height = `${(p.rows + 1) * size}px`;
    p.boardEl.style.setProperty("--tile", `${size}px`);
    p.line.setAttribute("width", String((p.cols + 1) * size));
    p.line.setAttribute("height", String((p.rows + 1) * size));
    for (const t of p.tiles.values()) place(t);
  }
  // cell (r, c) with the ring: r and c run 0..rows+1; the board shows
  // half a tile of ring each side
  const cellX = (c) => (c - .5) * play.size;
  const cellY = (r) => (r - .5) * play.size;
  function place(t) {
    t.node.style.transform = `translate(${cellX(t.c)}px, ${cellY(t.r)}px)`;
    t.node.setAttribute("aria-label", `${t.name} แถว ${t.r} คอลัมน์ ${t.c}`);
  }

  function tap(id) {
    const p = play;
    if (!p || p.over || p.paused) return;
    const t = p.tiles.get(id);
    if (!t || t.gone) return;
    if (!p.pick) { select(t); return; }
    if (p.pick === t) { unselect(); tone(330, .04, "triangle", .03); return; }
    const a = p.pick;
    if (a.type !== t.type) { unselect(); select(t); return; }
    const path = M.findPath(p.grid, { r: a.r, c: a.c }, { r: t.r, c: t.c });
    if (!path) {
      // alike but walled in
      for (const x of [a, t]) { x.node.classList.remove("is-blocked"); void x.node.offsetWidth; x.node.classList.add("is-blocked"); }
      unselect();
      tone(160, .1, "square", .04);
      say("ลากเส้นหักมุมเกิน 2 ครั้ง หรือมีการ์ดขวางอยู่");
      return;
    }
    matchPair(a, t, path);
  }
  function select(t) {
    play.pick = t;
    t.node.classList.add("is-picked");
    tone(660, .04, "triangle", .03);
  }
  function unselect() {
    play.pick?.node.classList.remove("is-picked");
    play.pick = null;
  }

  function matchPair(a, b, path) {
    const p = play;
    unselect();
    clearHint();
    drawLine(path);
    const now = performance.now();
    p.combo = now - p.lastMatch < 3500 ? p.combo + 1 : 1;
    p.lastMatch = now;
    const gained = M.pairScore(p.combo);
    p.points += gained;
    p.score.textContent = fmt(p.points);
    for (const t of [a, b]) {
      t.gone = true;
      t.node.classList.add("is-gone");
      t.node.disabled = true;
      setTimeout(() => t.node.remove(), 380);
      p.tiles.delete(t.id);
    }
    bubble(path, p.combo > 1 ? `คอมโบ ×${p.combo}! +${gained}` : `+${gained}`, p.combo > 1);
    [784, 1047].forEach((note, i) => tone(note + Math.min(5, p.combo - 1) * 60, .07, "triangle", .05, i * .05));
    // the board: take the pair, slide what is left, follow with the tiles
    M.take(p.grid, { r: a.r, c: a.c }, { r: b.r, c: b.c }, p.level.gravity);
    p.ids[a.r][a.c] = 0; p.ids[b.r][b.c] = 0;
    M.slide(p.ids, p.level.gravity);
    setTimeout(() => { if (play === p) followIds(); }, p.level.gravity === "none" ? 0 : 160);
    if (!M.tilesLeft(p.grid)) { finish(true); return; }
    if (!M.findMove(p.grid)) setTimeout(() => { if (play === p && !p.over) reshuffle(true); }, 420);
  }
  // put every tile where the ids grid says it now is
  function followIds() {
    const p = play;
    for (let r = 1; r <= p.rows; r++) for (let c = 1; c <= p.cols; c++) {
      const t = p.tiles.get(p.ids[r][c]);
      if (t && (t.r !== r || t.c !== c)) { t.r = r; t.c = c; place(t); }
    }
  }

  // the joining line, glowing for a moment
  function drawLine(path) {
    const p = play;
    const points = path.map(q => `${cellX(q.c) + p.size / 2},${cellY(q.r) + p.size / 2}`).join(" ");
    const make = (cls) => { const l = document.createElementNS("http://www.w3.org/2000/svg", "polyline"); l.setAttribute("points", points); l.setAttribute("class", cls); return l; };
    p.line.replaceChildren(make("match-glow"), make("match-core"));
    p.line.classList.remove("is-on"); void p.line.getBoundingClientRect(); p.line.classList.add("is-on");
    clearTimeout(p.lineTimer);
    p.lineTimer = setTimeout(() => p.line.replaceChildren(), 420);
  }
  // points floating up from the middle of the line
  function bubble(path, text, big) {
    const p = play, mid = path[Math.floor(path.length / 2)];
    const n = el("span", `match-pop${big ? " is-combo" : ""}`, text);
    n.style.left = `${cellX(mid.c) + p.size / 2}px`;
    n.style.top = `${cellY(mid.r)}px`;
    p.boardEl.append(n);
    setTimeout(() => n.remove(), 900);
  }

  function useHint() {
    const p = play;
    if (!p || p.over || p.paused || p.hints <= 0) return;
    const move = M.findMove(p.grid);
    if (!move) { reshuffle(true); return; }
    p.hints--;
    paintTools();
    clearHint();
    for (const q of [move.a, move.b]) p.tiles.get(p.ids[q.r][q.c])?.node.classList.add("is-hint");
    p.hintTimer = setTimeout(clearHint, 2600);
    tone(880, .06, "sine", .04); tone(1175, .08, "sine", .04, .06);
  }
  function clearHint() {
    if (!play) return;
    clearTimeout(play.hintTimer);
    for (const t of play.tiles.values()) t.node.classList.remove("is-hint");
  }
  function useShuffle() {
    const p = play;
    if (!p || p.over || p.paused || p.shuffles <= 0) return;
    p.shuffles--;
    paintTools();
    reshuffle(false);
  }
  // shuffle the tiles left, moving each picture's tiles to its new places
  function reshuffle(free) {
    const p = play;
    unselect(); clearHint();
    M.shuffle(p.grid, p.rnd);
    const byType = new Map();
    for (const t of p.tiles.values()) { if (!byType.has(t.type)) byType.set(t.type, []); byType.get(t.type).push(t); }
    for (let r = 1; r <= p.rows; r++) for (let c = 1; c <= p.cols; c++) {
      const type = p.grid[r][c];
      if (!type) { p.ids[r][c] = 0; continue; }
      const t = byType.get(type).pop();
      p.ids[r][c] = t.id; t.r = r; t.c = c; place(t);
    }
    p.boardEl.classList.remove("is-mixing"); void p.boardEl.offsetWidth; p.boardEl.classList.add("is-mixing");
    [523, 659, 523, 784].forEach((note, i) => tone(note, .05, "triangle", .04, i * .05));
    say(free ? "ไม่มีคู่ให้จับแล้ว สลับการ์ดให้ใหม่ฟรี" : "สลับการ์ดแล้ว");
  }
  function paintTools() {
    const p = play;
    p.hint.replaceChildren(el("span", null, "💡"), el("small", null, String(p.hints)));
    p.mix.replaceChildren(el("span", null, "🔀"), el("small", null, String(p.shuffles)));
    p.hint.disabled = p.hints <= 0;
    p.mix.disabled = p.shuffles <= 0;
    p.hint.setAttribute("aria-label", `คำใบ้ เหลือ ${p.hints} ครั้ง`);
    p.mix.setAttribute("aria-label", `สลับการ์ด เหลือ ${p.shuffles} ครั้ง`);
  }
  function say(text) {
    if (!play) return;
    play.note.textContent = text;
    clearTimeout(play.noteTimer);
    play.noteTimer = setTimeout(() => { if (play) play.note.textContent = ""; }, 2600);
  }

  // ---- The clock ----
  function tick() {
    const p = play;
    if (!p || p.over) return;
    const now = performance.now();
    if (!p.paused) p.left = Math.max(0, p.left - (now - p.last) / 1000);
    p.last = now;
    const share = p.left / p.level.time;
    p.fill.style.width = `${share * 100}%`;
    p.fill.parentElement.classList.toggle("is-low", share < .2);
    p.fill.parentElement.classList.toggle("is-gold", share >= M.STAR_TIME[1]);
    if (p.left <= 0) { finish(false); return; }
    p.frame = requestAnimationFrame(tick);
  }
  function pause() {
    const p = play;
    if (!p || p.over || p.paused) return;
    p.paused = true;
    p.view.classList.add("is-paused");
    const box = el("div", "match-cover");
    box.append(el("h3", null, "พักเกม"), el("p", null, `ด่าน ${p.level.num} · เหลือเวลา ${Math.ceil(p.left)} วินาที`));
    const actions = el("div", "title-actions");
    actions.append(button("primary-button", "เล่นต่อ ▶", () => resume()), button("secondary-button", "เลือกด่าน", () => showLevels()));
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
    p.view.classList.remove("is-paused");
    p.cover?.remove();
    p.cover = null;
  }
  function stopPlay() {
    if (!play) return;
    cancelAnimationFrame(play.frame);
    clearTimeout(play.hintTimer); clearTimeout(play.noteTimer); clearTimeout(play.lineTimer);
    play = null;
  }
  document.addEventListener("visibilitychange", () => { if (document.hidden && play && !play.over) pause(); });
  new ResizeObserver(() => { if (play && !play.over) layout(); }).observe(screen);

  // ---- The end ----
  function finish(won) {
    const p = play;
    p.over = true;
    cancelAnimationFrame(p.frame);
    unselect(); clearHint();
    const n = p.level.num, r = record(), before = r.stars[n] || 0;
    const box = el("div", `match-cover match-result${won ? " is-won" : ""}`);
    if (won) {
      const bonus = M.timeBonus(p.left), total = p.points + bonus;
      const got = M.starsFor(p.level, p.left);
      const reward = M.rewardFor(p.level, !before, got, before);
      r.stars[n] = Math.max(before, got);
      r.best[n] = Math.max(r.best[n] || 0, total);
      save().coins += reward.coins;
      save().gems = (save().gems || 0) + reward.gems;
      store();
      showCoins();
      box.append(el("span", "match-medal", "🏆"), el("h3", null, `ผ่านด่าน ${n}!`), el("p", "match-stars", stars(got)),
        el("p", null, `คะแนน ${fmt(p.points)} + เวลาที่เหลือ ${fmt(bonus)} = ${fmt(total)}${total >= (r.best[n] || 0) && total > 0 ? " · สถิติใหม่!" : ""}`),
        el("p", "match-reward", `ได้รับ ● ${fmt(reward.coins)}${reward.gems ? ` · 💎 ${reward.gems}` : ""}`),
        el("p", "match-goal", got < 3 ? `เหลือเวลาอย่างน้อย ${Math.round(M.STAR_TIME[1] * 100)}% เพื่อได้ ★★★` : "ได้ครบ 3 ดาว!"));
      [523, 659, 784, 1047].forEach((note, i) => tone(note, .14, "triangle", .05, i * .1));
      announce(`ผ่านด่าน ${n} ได้ ${got} ดาว`);
      confetti(p.boardEl);
    } else {
      box.append(el("span", "match-medal", "⏰"), el("h3", null, "หมดเวลา!"), el("p", null, `เหลือการ์ด ${M.tilesLeft(p.grid)} ใบ · ลองใช้ 💡 คำใบ้ หรือ 🔀 สลับการ์ด แล้วลองใหม่นะ`));
      [392, 330, 262].forEach((note, i) => tone(note, .18, "triangle", .04, i * .14));
      announce("หมดเวลา");
    }
    const actions = el("div", "title-actions");
    if (won && n < M.LEVELS) actions.append(button("primary-button", `ด่าน ${n + 1} ▶`, () => startLevel(n + 1)));
    actions.append(button(won && n < M.LEVELS ? "secondary-button" : "primary-button", "เล่นอีกครั้ง", () => startLevel(n)), button("secondary-button", "เลือกด่าน", () => showLevels()));
    box.append(actions);
    p.view.append(box);
  }
  function confetti(host) {
    if (calm()) return;
    const colours = ["#ffd76a", "#ff6fb5", "#7fe3ff", "#9dffb8", "#ffffff", "#c58bff"];
    for (let i = 0; i < 40; i++) {
      const bit = el("i", "match-confetti");
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = colours[i % colours.length];
      bit.style.animationDelay = `${Math.random() * .5}s`;
      bit.style.setProperty("--drift", `${(Math.random() - .5) * 120}px`);
      host.append(bit);
      setTimeout(() => bit.remove(), 2600);
    }
  }

  window.PupaMatch = { open, close: goHome, key, get isOpen() { return isShown; } };
  // Test link: ?match opens straight into the match mode.
  if (new URLSearchParams(location.search).has("match")) setTimeout(() => open(), 400);
})();

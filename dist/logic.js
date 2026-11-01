// Pupa Logic (ปริศนาประจำวัน): the screens. The rules and puzzles live in
// logic-engine.js and logic-puzzles.js; the day's ranking on the server
// (account.js logicStart/Hint/Finish/Board); game.js lends the save,
// sounds and coins through window.PupaGame and keeps its own keys quiet.
//
// save.logic = { stars: { level: best stars }, last: the last day's puzzle
// solved, streak: days in a row up to it, best: the longest, days: count }.
(() => {
  "use strict";
  const L = window.PupaLogicEngine;
  const screen = document.querySelector("#logicScreen");
  if (!L || !screen) return;

  const game = () => window.PupaGame;
  const save = () => game().save;
  const account = () => window.PupaAccount;
  const signedIn = () => Boolean(account()?.state?.user);
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
  const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  // the day in Bangkok, as the server counts it
  const today = () => new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10);
  const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const thaiDay = (day) => { const [, m, d] = day.split("-").map(Number); return `${d} ${THAI_MONTHS[m - 1]}`; };
  const PRACTICE_HINTS = 3, LOCAL_HINTS = 3;

  // ---- The save ----
  function progress() {
    const s = save();
    const raw = s.logic && typeof s.logic === "object" ? s.logic : {};
    const starsOut = {};
    for (let n = 1; n <= L.PRACTICE.length; n++) { const v = Math.min(3, Math.floor(Number(raw.stars?.[n]) || 0)); if (v > 0) starsOut[n] = v; }
    const count = (v) => Math.max(0, Math.floor(Number(v) || 0));
    s.logic = { stars: starsOut, last: /^\d{4}-\d{2}-\d{2}$/.test(raw.last || "") ? raw.last : "", streak: count(raw.streak), best: count(raw.best), days: count(raw.days) };
    return s.logic;
  }
  const record = () => save().logic;
  // the streak as it stands today: broken if yesterday was missed
  const liveStreak = () => { const r = record(), d = today(); return r.last === d || r.last === L.previousDay(d) ? r.streak : 0; };
  const isOpenLevel = (n) => n === 1 || (record().stars[n - 1] || 0) > 0;
  const nextLevel = () => { for (let n = 1; n <= L.PRACTICE.length; n++) if (!record().stars[n]) return n; return L.PRACTICE.length; };

  // ---- The frame ----
  const frame = el("div", "shop-card logic-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "Pupa Logic · ปริศนาภาพ");
  title.id = "logicTitle";
  const wallet = el("div", "shop-wallet");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  const homeButton = button("icon-button logic-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(homeButton, title, wallet);
  const body = el("div", "logic-body");
  frame.append(head, body);
  screen.append(frame);
  function showCoins() {
    wallet.querySelector("b").textContent = fmt(save().coins);
    wallet.querySelector(".gems").textContent = fmt(save().gems || 0);
    wallet.setAttribute("aria-label", `เหรียญ ${fmt(save().coins)} เพชร ${fmt(save().gems || 0)}`);
  }

  let isShown = false;
  let play = null;    // the puzzle being played, if any
  let board = null;   // today's ranking as last loaded (its `me`: today's solve)

  function open() {
    if (!game()) return;
    progress();
    isShown = true;
    screen.hidden = false;
    game().setLogicOpen?.(true);
    showHome();
    tone(659, .07, "triangle", .04);
    homeButton.focus();
    // the first visit shows how to play
    let seen = true;
    try { seen = localStorage.getItem(HELP_KEY) === "1"; } catch { /* no storage: show it each time */ seen = false; }
    if (!seen) showHelp(true);
  }
  function goHome() {
    closeHelp();
    stopPlay();
    isShown = false;
    screen.hidden = true;
    game().setLogicOpen?.(false);
    game().showModes?.();
  }
  function key(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (help) closeHelp();
    else if (play) leave();
    else goHome();
  }

  // ---- Home: today's puzzle, its ranking, the practice ladder ----
  function showHome() {
    stopPlay();
    showCoins();
    const day = today(), puzzle = L.dailyFor(day), r = record();
    // solved here, or (signed in) on another device
    const mine = board?.day === day ? board.me : null, solved = r.last === day || Boolean(mine);
    const card = el("section", "logic-daily");
    const top = el("div", "logic-daily-top");
    const cal = el("div", "logic-cal");
    cal.append(el("small", null, THAI_MONTHS[Number(day.slice(5, 7)) - 1]), el("b", null, String(Number(day.slice(8)))));
    const words = el("div", "logic-daily-words");
    words.append(el("b", null, `📅 ปริศนาประจำวัน${puzzle.weekend ? " · สุดสัปดาห์" : ""}`), el("small", null, `${puzzle.n}×${puzzle.n} · ทุกคนได้โจทย์เดียวกัน · เฉลยเป็นตัวละครในเกม`));
    const streak = el("div", "logic-streak");
    streak.append(el("b", null, `🔥 ${liveStreak()}`), el("small", null, `วันติด · สูงสุด ${Math.max(r.best, liveStreak())}`));
    top.append(cal, words, streak);
    const status = el("p", "logic-daily-status");
    const actions = el("div", "logic-daily-actions");
    if (solved) {
      status.textContent = mine ? `✓ แก้แล้ว ${clock(mine.ms)}${mine.hints ? ` (คำใบ้ ${mine.hints})` : ""} · อันดับ #${mine.rank} วันนี้` : "✓ แก้ปริศนาวันนี้แล้ว พรุ่งนี้มาใหม่นะ!";
      actions.append(button("secondary-button", "เล่นอีกครั้ง (ไม่นับอันดับ)", () => startDaily(true)));
    } else {
      const reward = L.dailyReward(liveStreak() + 1, puzzle.weekend);
      status.textContent = `รางวัลวันนี้: ● ${fmt(reward.coins)} · 💎 ${reward.gems} · ✧ ${reward.dust} · ⛏ ${reward.ore}${liveStreak() ? ` (ต่อเนื่อง ${liveStreak() + 1} วันได้เพชรเพิ่ม)` : ""}`;
      actions.append(button("primary-button logic-go", "▶ เล่นปริศนาวันนี้", () => startDaily(false)));
    }
    card.append(top, status, actions);
    const how = el("div", "logic-how");
    how.append(el("span", null, "ระบายช่องให้ตรงกับตัวเลขข้างแถวและบนคอลัมน์ ตัวเลข = จำนวนช่องระบายติดกัน แก้เสร็จจะได้ภาพตัวละคร"), button("logic-how-go", "❓ วิธีเล่น", () => showHelp(false)));
    card.append(how);
    // the day's ranking
    const rank = el("div", "logic-rank");
    rank.append(el("b", "logic-rank-title", "🏆 อันดับวันนี้ (เวลาเร็วที่สุด)"));
    if (!signedIn()) rank.append(el("p", "logic-rank-note", "เข้าสู่ระบบเพื่อจัดอันดับเวลากับเพื่อน ๆ (เล่นได้เลยโดยไม่ต้องเข้าสู่ระบบ แต่ไม่นับอันดับ)"));
    else if (!board || board.day !== day) { rank.append(el("p", "logic-rank-note", "กำลังโหลดอันดับ…")); loadBoard(); }
    else rank.append(rankList(board, 10));
    card.append(rank);
    // practice
    const got = Object.values(r.stars).reduce((a, b) => a + b, 0);
    const practiceHead = el("div", "logic-practice-head");
    practiceHead.append(el("b", null, "🧩 ฝึกฝน"), el("small", null, `★ ${got}/${L.PRACTICE.length * 3} · ${Object.keys(r.stars).length}/${L.PRACTICE.length} ด่าน · ไม่ใช้คำใบ้ได้ ★★★`));
    const grid = el("div", "logic-levels");
    L.PRACTICE.forEach((p, k) => {
      const n = k + 1, open = isOpenLevel(n), have = r.stars[n] || 0;
      const tile = button(`logic-level${have ? " is-cleared" : open ? " is-next" : " is-locked"}`, null, () => startPractice(n),
        `ฝึกฝนด่าน ${n} ${open ? (have ? `ได้ ${have} ดาว` : "เล่นได้") : "ล็อกอยู่"} · ${p.n}×${p.n}`);
      tile.disabled = !open;
      if (have) { const img = el("img", "logic-level-art"); img.src = p.art; img.alt = ""; img.loading = "lazy"; tile.append(img); }
      tile.append(el("b", null, open ? String(n) : "🔒"), el("small", "logic-level-stars", open ? stars(have) : ""), el("small", "logic-level-info", `${p.n}×${p.n}`));
      grid.append(tile);
    });
    body.replaceChildren(card, practiceHead, grid);
  }
  function rankList(b, count) {
    const list = el("ol", "logic-rank-list");
    if (!b.places.length) list.append(el("li", "logic-rank-empty", "ยังไม่มีใครแก้ได้วันนี้ เป็นคนแรกเลย!"));
    for (const p of b.places.slice(0, count)) {
      const li = el("li", p.me ? "is-me" : "");
      li.append(el("span", "logic-rank-no", `#${p.rank}`), el("span", "logic-rank-name", p.name), el("b", null, clock(p.ms)));
      if (p.hints) li.append(el("small", null, `💡${p.hints}`));
      list.append(li);
    }
    if (b.me && !b.places.slice(0, count).some(p => p.me)) {
      const li = el("li", "is-me");
      li.append(el("span", "logic-rank-no", `#${b.me.rank}`), el("span", "logic-rank-name", "คุณ"), el("b", null, clock(b.me.ms)));
      list.append(li);
    }
    return list;
  }
  async function loadBoard() {
    try {
      board = await account().logicBoard();
      if (isShown && !play) showHome();
    } catch { /* stays as it was */ }
  }

  // ---- Playing ----
  async function startDaily(replay) {
    const day = today(), puzzle = L.dailyFor(day);
    let ranked = null;
    if (!replay && signedIn()) {
      try {
        const run = await account().logicStart();
        if (run.done) { board = null; showHome(); return; }
        ranked = run;
      } catch { /* the server can't be reached: unranked */ }
    }
    begin({ puzzle, kind: "daily", day, ranked, replay, startAt: ranked ? Math.min(Date.now(), ranked.at) : Date.now() });
    if (ranked?.hints?.length) { for (const [r, c] of ranked.hints) giveCell(r, c); play.hintsUsed = ranked.hints.length; paintTools(); }
  }
  function startPractice(n) {
    if (!isOpenLevel(n)) return;
    begin({ puzzle: L.PRACTICE[n - 1], kind: "practice", level: n, startAt: Date.now() });
  }
  function begin(opts) {
    stopPlay();
    const { puzzle } = opts;
    const n = puzzle.n, clues = L.cluesOf(puzzle.rows);
    const view = el("section", "logic-play");
    const bar = el("div", "logic-bar");
    const name = el("b", "logic-name", opts.kind === "daily" ? `📅 ${thaiDay(opts.day)}${opts.ranked ? " · 🏆 จัดอันดับ" : opts.replay ? " · เล่นซ้ำ" : ""}` : `🧩 ฝึกฝนด่าน ${opts.level}`);
    const time = el("span", "logic-time", "0:00");
    const pen = button("logic-tool logic-mode", "✏️", () => setMode("fill"), "ระบายช่อง");
    const cross = button("logic-tool logic-mode", "✖", () => setMode("cross"), "กากบาทช่องว่าง");
    const undo = button("logic-tool", "↶", () => useUndo(), "ย้อนกลับ");
    const hint = button("logic-tool", null, () => useHint(), "คำใบ้");
    const ask = button("logic-tool", "❓", () => showHelp(false), "วิธีเล่น");
    bar.append(name, time, pen, cross, undo, hint, ask);
    const wrap = el("div", "logic-wrap");
    const gridEl = el("div", "logic-grid");
    wrap.append(gridEl);
    const note = el("p", "logic-note");
    note.setAttribute("aria-live", "polite");
    view.append(bar, wrap, note);
    body.replaceChildren(view);
    play = { ...opts, n, clues, view, wrap, gridEl, note, time, pen, cross, undo, hint,
      cells: Array.from({ length: n }, () => new Array(n).fill(0)),   // 0 blank, 1 filled, 2 crossed
      given: new Set(), history: [], mode: "fill", hintsUsed: 0, over: false, stroke: null };
    build();
    setMode("fill");
    paintTools();
    tick();
    announce(`${opts.kind === "daily" ? "ปริศนาประจำวัน" : `ฝึกฝนด่าน ${opts.level}`} ขนาด ${n} คูณ ${n}`);
    tone(523, .08, "triangle", .05); tone(784, .1, "triangle", .05, .08);
  }
  function leave() {
    const p = play;
    if (!p) return;
    stopPlay();
    showHome();
  }

  // The grid: column clues on top, row clues on the left, the cells.
  function build() {
    const p = play, n = p.n;
    const colDepth = Math.max(1, ...p.clues.cols.map(c => c.length)), rowDepth = Math.max(1, ...p.clues.rows.map(c => c.length));
    p.gridEl.style.setProperty("--n", String(n));
    p.gridEl.style.setProperty("--cd", String(colDepth));
    p.gridEl.style.setProperty("--rd", String(rowDepth));
    const corner = el("div", "logic-corner");
    const colClues = el("div", "logic-cols");
    p.colNodes = p.clues.cols.map((clue, c) => {
      const node = el("div", `logic-clue is-col${c % 5 === 4 && c < n - 1 ? " is-five" : ""}`);
      for (const v of clue.length ? clue : [0]) node.append(el("span", null, String(v)));
      colClues.append(node);
      return node;
    });
    const rowClues = el("div", "logic-rows");
    p.rowNodes = p.clues.rows.map((clue, r) => {
      const node = el("div", `logic-clue is-row${r % 5 === 4 && r < n - 1 ? " is-five" : ""}`);
      for (const v of clue.length ? clue : [0]) node.append(el("span", null, String(v)));
      rowClues.append(node);
      return node;
    });
    const cellsEl = el("div", "logic-cells");
    cellsEl.setAttribute("role", "grid");
    cellsEl.setAttribute("aria-label", `ตาราง ${n} คูณ ${n}`);
    p.cellNodes = [];
    for (let r = 0; r < n; r++) {
      p.cellNodes.push([]);
      for (let c = 0; c < n; c++) {
        const cell = el("button", `logic-cell${c % 5 === 4 && c < n - 1 ? " is-five-c" : ""}${r % 5 === 4 && r < n - 1 ? " is-five-r" : ""}`);
        cell.type = "button";
        cell.dataset.r = String(r);
        cell.dataset.c = String(c);
        cell.setAttribute("aria-label", `แถว ${r + 1} คอลัมน์ ${c + 1} ว่าง`);
        cellsEl.append(cell);
        p.cellNodes[r].push(cell);
      }
    }
    // keyboard: Enter fills, X crosses
    cellsEl.addEventListener("keydown", (event) => {
      const cell = event.target.closest?.(".logic-cell");
      if (!cell) return;
      const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); strokeStart(r, c, p.mode); strokeEnd(); }
      else if (event.key === "x" || event.key === "X") { event.preventDefault(); strokeStart(r, c, "cross"); strokeEnd(); }
      const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
      if (moves) { event.preventDefault(); p.cellNodes[Math.max(0, Math.min(n - 1, r + moves[0]))][Math.max(0, Math.min(n - 1, c + moves[1]))].focus(); }
    });
    cellsEl.addEventListener("pointerdown", grab);
    cellsEl.addEventListener("pointermove", sweep);
    cellsEl.addEventListener("pointerup", release);
    cellsEl.addEventListener("pointercancel", release);
    p.gridEl.replaceChildren(corner, colClues, rowClues, cellsEl);
    p.cellsEl = cellsEl;
    layout();
  }
  function layout() {
    const p = play;
    if (!p) return;
    const n = p.n, cd = Number(p.gridEl.style.getPropertyValue("--cd")), rd = Number(p.gridEl.style.getPropertyValue("--rd"));
    const W = p.wrap.clientWidth, H = p.wrap.clientHeight;
    // clue numbers take about .62 of a cell each
    const size = Math.max(16, Math.min(46, Math.floor(Math.min(W / (n + rd * .62 + .3), H / (n + cd * .62 + .3)))));
    p.gridEl.style.setProperty("--cell", `${size}px`);
  }
  new ResizeObserver(() => { if (play && !play.over) layout(); }).observe(screen);

  // ---- Painting ----
  // A stroke: what the first cell asks (fill, cross or clear), carried
  // along one row or column as the finger moves.
  function cellAt(event) {
    const node = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".logic-cell");
    return node && play?.cellsEl.contains(node) ? [Number(node.dataset.r), Number(node.dataset.c)] : null;
  }
  function grab(event) {
    const p = play;
    const at = cellAt(event);
    if (!p || p.over || !at) return;
    event.preventDefault();
    p.cellsEl.setPointerCapture?.(event.pointerId);
    // a right click or a held second finger crosses
    strokeStart(at[0], at[1], event.button === 2 ? "cross" : p.mode);
    p.stroke.pointer = event.pointerId;
  }
  function sweep(event) {
    const p = play, s = p?.stroke;
    if (!s || event.pointerId !== s.pointer) return;
    const at = cellAt(event);
    if (!at) return;
    let [r, c] = at;
    // keep to the first cell's row or column
    if (!s.axis && (r !== s.r || c !== s.c)) s.axis = Math.abs(r - s.r) >= Math.abs(c - s.c) ? "col" : "row";
    if (s.axis === "row") r = s.r; else if (s.axis === "col") c = s.c;
    // every cell between the last and this one
    const [lr, lc] = s.last;
    const steps = Math.max(Math.abs(r - lr), Math.abs(c - lc));
    for (let k = 1; k <= steps; k++) apply(lr + Math.sign(r - lr) * k, lc + Math.sign(c - lc) * k);
    s.last = [r, c];
  }
  function release(event) {
    if (play?.stroke && event.pointerId === play.stroke.pointer) strokeEnd();
  }
  function strokeStart(r, c, mode) {
    const p = play;
    const now = p.cells[r][c];
    // fill an empty cell, clear a filled one; cross likewise
    const want = mode === "fill" ? (now === 1 ? 0 : 1) : (now === 2 ? 0 : 2);
    p.stroke = { r, c, last: [r, c], axis: null, want, before: p.cells.map(row => row.slice()), changed: false };
    apply(r, c);
  }
  // a stroke only turns cells into its own state from blank (or back to
  // blank from its own), so a sweep doesn't wipe the other kind
  function apply(r, c) {
    const p = play, s = p.stroke;
    if (!s || p.given.has(`${r},${c}`)) return;
    const now = p.cells[r][c];
    let next = now;
    if (s.want === 0) { if (now === (s.wantFrom ??= now)) next = 0; }
    else if (now === 0) next = s.want;
    if (next === now) return;
    p.cells[r][c] = next;
    s.changed = true;
    paintCell(r, c);
    tone(next === 1 ? 600 + (r + c) * 6 : next === 2 ? 330 : 280, .03, "triangle", .025);
  }
  function strokeEnd() {
    const p = play, s = p?.stroke;
    if (!s) return;
    p.stroke = null;
    if (s.changed) { p.history.push(s.before); paintTools(); }
    paintClues();
    if (L.isSolved(p.clues, p.cells.map(row => row.map(v => (v === 1 ? 1 : 0))))) finish();
  }
  function paintCell(r, c) {
    const p = play, v = p.cells[r][c], node = p.cellNodes[r][c];
    node.classList.toggle("is-filled", v === 1);
    node.classList.toggle("is-crossed", v === 2);
    node.classList.toggle("is-given", p.given.has(`${r},${c}`));
    node.setAttribute("aria-label", `แถว ${r + 1} คอลัมน์ ${c + 1} ${v === 1 ? "ระบายแล้ว" : v === 2 ? "กากบาท" : "ว่าง"}`);
  }
  // clues of rows and columns that already match go quiet
  function paintClues() {
    const p = play, filled = p.cells.map(row => row.map(v => (v === 1 ? 1 : 0)));
    p.rowNodes.forEach((node, r) => node.classList.toggle("is-done", L.matches(filled[r], p.clues.rows[r])));
    p.colNodes.forEach((node, c) => node.classList.toggle("is-done", L.matches(filled.map(row => row[c]), p.clues.cols[c])));
  }
  function setMode(mode) {
    const p = play;
    p.mode = mode;
    p.pen.classList.toggle("is-on", mode === "fill");
    p.cross.classList.toggle("is-on", mode === "cross");
    p.pen.setAttribute("aria-pressed", String(mode === "fill"));
    p.cross.setAttribute("aria-pressed", String(mode === "cross"));
  }

  // ---- Tools ----
  function useUndo() {
    const p = play;
    if (!p || p.over || !p.history.length) return;
    p.cells = p.history.pop();
    for (const key of p.given) { const [r, c] = key.split(",").map(Number); p.cells[r][c] = 1; }
    for (let r = 0; r < p.n; r++) for (let c = 0; c < p.n; c++) paintCell(r, c);
    paintClues();
    paintTools();
    tone(440, .05, "triangle", .03);
  }
  // A hint fills one cell of the answer for good: on a ranked daily the
  // server picks it (and adds time); else a filled cell still missing.
  async function useHint() {
    const p = play;
    if (!p || p.over || p.busyHint) return;
    if (p.ranked) {
      p.busyHint = true;
      try {
        const got = await account().logicHint({ runId: p.ranked.runId });
        if (play !== p) return;
        giveCell(got.cell[0], got.cell[1]);
        p.hintsUsed = got.hints;
        say(`คำใบ้: ระบายช่องนี้ (+${L.HINT_PENALTY} วินาที)`);
      } catch (error) {
        say(error?.code === "no_hints" ? "ใช้คำใบ้ครบแล้ววันนี้" : "ขอคำใบ้ไม่สำเร็จ ลองอีกครั้ง");
      } finally { p.busyHint = false; paintTools(); }
      return;
    }
    const limit = p.kind === "practice" ? PRACTICE_HINTS : LOCAL_HINTS;
    if (p.hintsUsed >= limit) return;
    const missing = [];
    p.puzzle.rows.forEach((row, r) => [...row].forEach((v, c) => { if (v === "1" && p.cells[r][c] !== 1) missing.push([r, c]); }));
    if (!missing.length) { say("ระบายครบแล้ว ลองลบช่องที่เกินดูนะ"); return; }
    const [r, c] = missing[Math.floor(Math.random() * missing.length)];
    giveCell(r, c);
    p.hintsUsed++;
    say(p.kind === "daily" ? `คำใบ้: ระบายช่องนี้ (+${L.HINT_PENALTY} วินาที)` : "คำใบ้: ระบายช่องนี้");
    paintTools();
    paintClues();
    if (L.isSolved(p.clues, p.cells.map(row => row.map(v => (v === 1 ? 1 : 0))))) finish();
  }
  function giveCell(r, c) {
    const p = play;
    p.given.add(`${r},${c}`);
    p.cells[r][c] = 1;
    paintCell(r, c);
    const node = p.cellNodes[r][c];
    node.classList.remove("is-hinted"); void node.offsetWidth; node.classList.add("is-hinted");
    tone(880, .06, "sine", .04); tone(1175, .08, "sine", .04, .06);
  }
  function paintTools() {
    const p = play;
    const limit = p.ranked ? 5 : p.kind === "practice" ? PRACTICE_HINTS : LOCAL_HINTS;
    p.hint.replaceChildren(el("span", null, "💡"), el("small", null, String(Math.max(0, limit - p.hintsUsed))));
    p.hint.disabled = p.over || p.hintsUsed >= limit;
    p.hint.setAttribute("aria-label", `คำใบ้ เหลือ ${Math.max(0, limit - p.hintsUsed)} ครั้ง`);
    p.undo.disabled = p.over || !p.history.length;
  }
  function say(text) {
    if (!play) return;
    play.note.textContent = text;
    clearTimeout(play.noteTimer);
    if (text) play.noteTimer = setTimeout(() => { if (play) play.note.textContent = ""; }, 3200);
  }
  // the clock shown (a daily's hints add their penalty)
  const elapsed = (p) => Date.now() - p.startAt + (p.kind === "daily" ? p.hintsUsed * L.HINT_PENALTY * 1000 : 0);
  function tick() {
    const p = play;
    if (!p || p.over) return;
    p.time.textContent = `⏱ ${clock(elapsed(p))}`;
    p.timer = setTimeout(tick, 500);
  }
  function stopPlay() {
    if (!play) return;
    clearTimeout(play.timer); clearTimeout(play.noteTimer);
    play = null;
  }

  // ---- The end ----
  async function finish() {
    const p = play;
    if (p.over) return;
    p.over = true;
    clearTimeout(p.timer);
    paintTools();
    p.view.classList.add("is-solved");
    const box = el("div", "logic-cover logic-result");
    const reveal = el("figure", "logic-reveal");
    const img = el("img");
    img.src = p.puzzle.art;
    img.alt = p.puzzle.name;
    reveal.append(img, el("figcaption", null, `ภาพนี้คือ ${p.puzzle.name}!`));
    box.append(reveal, el("h3", null, "แก้ปริศนาสำเร็จ!"));
    let ms = elapsed(p);
    if (p.kind === "daily") {
      let ranked = null;
      if (p.ranked) {
        box.append(el("p", "logic-sending", "กำลังส่งเวลาไปจัดอันดับ…"));
        p.view.append(box);
        try {
          ranked = await account().logicFinish({ runId: p.ranked.runId, rows: p.cells.map(row => row.map(v => (v === 1 ? "1" : "0")).join("")) });
          ms = ranked.ms;
          board = null;
        } catch { /* kept on this device */ }
        box.querySelector(".logic-sending")?.remove();
        box.remove();
      }
      const r = record(), first = r.last !== p.day && !p.replay;
      box.append(el("p", "logic-time-big", `⏱ ${clock(ms)}${p.hintsUsed ? ` (คำใบ้ ${p.hintsUsed})` : ""}`));
      if (ranked) box.append(el("p", "logic-rank-line", `🏆 อันดับ #${ranked.rank} วันนี้`));
      else if (p.ranked) box.append(el("p", "logic-rank-line", "ส่งเวลาไม่สำเร็จ (ไม่นับอันดับ)"));
      if (first) {
        r.streak = r.last === L.previousDay(p.day) ? r.streak + 1 : 1;
        r.last = p.day;
        r.best = Math.max(r.best, r.streak);
        r.days++;
        const reward = L.dailyReward(r.streak, p.puzzle.weekend);
        const parts = giveReward(reward);
        store();
        showCoins();
        box.append(el("p", "logic-streak-line", `🔥 เล่นต่อเนื่อง ${r.streak} วัน${r.streak >= r.best && r.streak > 1 ? " · สถิติใหม่!" : ""}`), el("p", "logic-reward", `ได้รับ ${parts.join(" · ")}`));
      } else box.append(el("p", "logic-tip", p.replay ? "เล่นซ้ำ ไม่นับรางวัลและอันดับ" : "รับรางวัลวันนี้ไปแล้ว"));
      announce(`แก้ปริศนาประจำวันสำเร็จ เวลา ${clock(ms)}`);
    } else {
      const n = p.level, r = record(), before = r.stars[n] || 0, got = L.starsFor(p.hintsUsed);
      const reward = L.practiceReward(n, !before, got, before);
      r.stars[n] = Math.max(before, got);
      const parts = giveReward(reward);
      store();
      showCoins();
      box.append(el("p", "logic-stars", stars(got)), el("p", null, `เวลา ${clock(ms)}${p.hintsUsed ? ` · ใช้คำใบ้ ${p.hintsUsed} ครั้ง` : ""}`), el("p", "logic-reward", `ได้รับ ${parts.join(" · ")}`),
        el("p", "logic-tip", got < 3 ? "ไม่ใช้คำใบ้เพื่อได้ ★★★" : "ได้ครบ 3 ดาว!"));
      announce(`ผ่านฝึกฝนด่าน ${n} ได้ ${got} ดาว ภาพนี้คือ ${p.puzzle.name}`);
    }
    const actions = el("div", "title-actions");
    if (p.kind === "practice" && p.level < L.PRACTICE.length) actions.append(button("primary-button", `ด่าน ${p.level + 1} ▶`, () => startPractice(p.level + 1)));
    actions.append(button(p.kind === "practice" ? "secondary-button" : "primary-button", "กลับหน้าปริศนา", () => showHome()));
    box.append(actions);
    p.view.append(box);
    [523, 659, 784, 1047].forEach((note, i) => tone(note, .14, "triangle", .05, i * .1));
    confetti(p.view);
    box.querySelector("button")?.focus();
  }
  // coins and gems; star dust and ore to the card battles once their save exists
  function giveReward(reward) {
    save().coins += reward.coins;
    save().gems = (save().gems || 0) + reward.gems;
    const cards = save().cards;
    const toCards = cards && typeof cards === "object" && typeof cards.dust === "number" && typeof cards.ore === "number";
    if (toCards) { cards.dust += reward.dust; cards.ore += reward.ore; }
    const parts = [`● ${fmt(reward.coins)}`];
    if (reward.gems) parts.push(`💎 ${reward.gems}`);
    if (toCards && reward.dust) parts.push(`✧ ${reward.dust}`);
    if (toCards && reward.ore) parts.push(`⛏ ${reward.ore}`);
    return parts;
  }
  function confetti(host) {
    if (calm()) return;
    const colours = ["#ffd76a", "#ff6fb5", "#7fe3ff", "#9dffb8", "#ffffff", "#c58bff"];
    for (let i = 0; i < 40; i++) {
      const bit = el("i", "logic-confetti");
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = colours[i % colours.length];
      bit.style.animationDelay = `${Math.random() * .5}s`;
      bit.style.setProperty("--drift", `${(Math.random() - .5) * 120}px`);
      host.append(bit);
      setTimeout(() => bit.remove(), 2600);
    }
  }

  // ---- How to play ----
  // A sheet over the screen: what the numbers mean, worked on little
  // rows, the two tricks that solve most lines, the controls, and what the
  // daily puzzle and the practice ladder are.
  const HELP_KEY = "superPupaLogicHelp";
  let help = null;
  // a row of example cells: "1" filled, "x" crossed, "s" sure (just found), "." blank
  function sample(clue, cells, note) {
    const row = el("div", "logic-ex");
    const nums = el("span", "logic-ex-clue");
    for (const v of clue) nums.append(el("b", null, String(v)));
    const line = el("span", "logic-ex-cells");
    for (const ch of cells) line.append(el("i", ch === "1" ? "is-filled" : ch === "x" ? "is-crossed" : ch === "s" ? "is-sure" : ""));
    row.append(nums, line);
    if (note) row.append(el("small", null, note));
    return row;
  }
  function showHelp(first) {
    closeHelp();
    const sheet = el("div", "logic-help");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.setAttribute("aria-label", "วิธีเล่น Pupa Logic");
    const box = el("div", "logic-help-box");
    const close = button("icon-button logic-help-close", "✕", () => closeHelp(), "ปิดวิธีเล่น");
    const step = (no, titleText, ...parts) => {
      const sec = el("section", "logic-help-step");
      const h = el("h4");
      h.append(el("span", "logic-help-no", String(no)), document.createTextNode(titleText));
      sec.append(h, ...parts);
      return sec;
    };
    const p = (text) => el("p", null, text);
    const list = (className, items) => {
      const ul = el("ul", className);
      for (const [icon, text] of items) { const li = el("li"); li.append(el("b", null, icon), document.createTextNode(text)); ul.append(li); }
      return ul;
    };
    box.append(close, el("h3", null, "❓ วิธีเล่น Pupa Logic"), p("ปริศนาภาพตัวเลข (โนโนแกรม): ระบายช่องในตารางให้ถูก แล้วภาพตัวละครในเกมจะปรากฏออกมา ใช้แค่เหตุผล ไม่ต้องเดา"),
      step(1, "ตัวเลขคือกลุ่มช่องที่ระบายติดกัน",
        p("ตัวเลขหน้าแถว (และบนคอลัมน์) บอกว่าแถวนั้นมีช่องระบายติดกันกี่ช่อง เรียงตามลำดับจากซ้ายไปขวา (หรือบนลงล่าง)"),
        sample([3, 1], "111.1.", "3 ช่องติดกัน แล้วอีก 1 ช่อง"),
        p("ถ้ามีหลายตัวเลข แต่ละกลุ่มต้องมีช่องว่างคั่นอย่างน้อย 1 ช่อง"),
        sample([2, 2], "11x11", "2 กับ 2 ใน 5 ช่อง มีแบบเดียวพอดี"),
        sample([0], "xxxxx", "เลข 0 = ทั้งแถวว่าง กากบาทได้เลย")),
      step(2, "เทคนิค: ช่องที่ทับกัน",
        p("ลองเลื่อนกลุ่มไปชิดซ้ายสุด และชิดขวาสุด ช่องที่ระบายตรงกันทั้งสองแบบ ระบายได้แน่นอน"),
        sample([7], "1111111...", "ชิดซ้ายสุด"),
        sample([7], "...1111111", "ชิดขวาสุด"),
        sample([7], "...ssss...", "4 ช่องกลางระบายแน่นอน")),
      step(3, "เทคนิค: กากบาทช่องที่ว่างแน่ ๆ",
        p("เมื่อแถวไหนครบตามตัวเลขแล้ว ช่องที่เหลือในแถวนั้นว่างทั้งหมด ใส่ ✖ ไว้กันลืม แล้วใช้ข้อมูลนี้ไปช่วยแก้คอลัมน์ ตัวเลขที่ครบแล้วจะจางลงให้เห็น"),
        sample([1, 2], "x1x11x", "ครบแล้ว ช่องอื่นว่างหมด")),
      step(4, "วิธีกด",
        list("logic-help-keys", [
          ["✏️", "แตะเพื่อระบาย แตะซ้ำเพื่อลบ ลากนิ้วเพื่อระบายหลายช่องในแถวหรือคอลัมน์เดียว"],
          ["✖", "สลับเป็นโหมดกากบาท ใช้มาร์กช่องที่ว่างแน่ ๆ (บนคอมคลิกขวาก็ได้)"],
          ["↶", "ย้อนกลับ ไม่จำกัดครั้ง"],
          ["💡", "คำใบ้ ระบายช่องที่ถูกให้ 1 ช่อง (ปริศนาประจำวันบวกเวลา 30 วินาที)"]
        ])),
      step(5, "ปริศนาประจำวัน และฝึกฝน",
        p("📅 ปริศนาประจำวัน: วันละ 1 ข้อ ทุกคนได้โจทย์เดียวกัน (จันทร์–ศุกร์ 10×10 เสาร์–อาทิตย์ 15×15) เข้าสู่ระบบแล้วจับเวลาจัดอันดับคนแก้เร็วที่สุดของวัน เวลาเริ่มนับตั้งแต่เปิดโจทย์ เล่นทุกวันต่อเนื่องได้ 🔥 และเพชรเพิ่มขึ้น"),
        p("🧩 ฝึกฝน: 30 ด่าน ตั้งแต่ 5×5 ไปจนถึง 15×15 ไม่ใช้คำใบ้ได้ ★★★ เริ่มจากด่านเล็กก่อนจะค่อย ๆ เข้าใจ")));
    const actions = el("div", "title-actions");
    if (first && !play) actions.append(button("primary-button", "ลองด่านฝึกแรก 5×5 ▶", () => { closeHelp(); startPractice(1); }));
    actions.append(button(first && !play ? "secondary-button" : "primary-button", "เข้าใจแล้ว", () => closeHelp()));
    box.append(actions);
    sheet.append(box);
    sheet.addEventListener("click", (event) => { if (event.target === sheet) closeHelp(); });
    screen.append(sheet);
    help = sheet;
    try { localStorage.setItem(HELP_KEY, "1"); } catch { /* fine */ }
    close.focus({ preventScroll: true });
    tone(659, .06, "triangle", .04);
  }
  function closeHelp() {
    help?.remove();
    help = null;
  }

  // signing in or out changes the ranking shown
  window.addEventListener("pupa-account", () => { board = null; if (isShown && !play) showHome(); });
  window.PupaLogic = { open, close: goHome, key, get isOpen() { return isShown; } };
  // Test link: ?logic opens straight into Pupa Logic.
  if (new URLSearchParams(location.search).has("logic")) setTimeout(() => open(), 400);
})();

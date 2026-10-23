// Match mode (จับคู่การ์ด): the rules, with no page in them, so Node can
// test them too. A board of picture tiles dealt in pairs. Two alike are
// taken off when a line of at most three straight runs (two turns) joins
// them through empty cells; the line may go round the outside of the
// board. From level 2 the tiles may slide after each pair (gravity).
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaMatchEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LEVELS = 30;
  // which way the tiles slide after a pair goes, level by level
  const GRAVITY = ["none", "down", "left", "up", "right"];
  const GRAVITY_NAMES = { none: "อยู่กับที่", down: "ไหลลง", up: "ไหลขึ้น", left: "ไหลซ้าย", right: "ไหลขวา" };
  // Stars: one for clearing, two with STAR_TIME[0] of the time left, three
  // with STAR_TIME[1].
  const STAR_TIME = [.15, .35];
  const HINTS = 3, SHUFFLES = 3;

  // A level: its board ([rows, cols], cols the longer side, turned on tall
  // screens), how many different pictures, which way tiles slide and the
  // time allowed (a little less per pair as the levels climb).
  function levelOf(n) {
    const num = Math.max(1, Math.min(LEVELS, Math.floor(n) || 1));
    const [rows, cols] = num <= 3 ? [6, 8] : num <= 6 ? [6, 10] : num <= 10 ? [7, 10] : num <= 15 ? [8, 10] : num <= 22 ? [8, 12] : [8, 14];
    const pairs = rows * cols / 2;
    const types = Math.min(pairs, 10 + 2 * num, 40);
    const gravity = GRAVITY[(num - 1) % GRAVITY.length];
    const time = Math.round(pairs * Math.max(4.6, 9 - (num - 1) * .16));
    return { num, rows, cols, pairs, types, gravity, time };
  }

  // A small seeded random source (a run of one level is repeatable in tests).
  function random(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function mix(list, rnd) {
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    return list;
  }

  // The board: grid[r][c] for r in 0..rows+1 and c in 0..cols+1; the
  // outer ring stays empty (0) so lines can run round the edge. Tiles hold
  // their picture's number, 1..types.
  function emptyGrid(rows, cols) { return Array.from({ length: rows + 2 }, () => Array(cols + 2).fill(0)); }
  const inner = (grid) => ({ rows: grid.length - 2, cols: grid[0].length - 2 });
  function cellsOf(grid) {
    const { rows, cols } = inner(grid), out = [];
    for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) if (grid[r][c]) out.push({ r, c });
    return out;
  }
  const tilesLeft = (grid) => cellsOf(grid).length;

  // Deal a level: each pair a picture, in turn, so every picture comes an
  // even number of times; then shuffled until there is a move.
  function deal(level, rnd, rows = level.rows, cols = level.cols) {
    const grid = emptyGrid(rows, cols), tiles = [];
    for (let k = 0; k < rows * cols / 2; k++) { const t = (k % level.types) + 1; tiles.push(t, t); }
    mix(tiles, rnd);
    let i = 0;
    for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) grid[r][c] = tiles[i++];
    if (!findMove(grid)) shuffle(grid, rnd);
    return grid;
  }

  const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
  // The line joining a and b with at most two turns, as its corner points
  // [a, ..., b], or null. Cells on the way must be empty.
  function findPath(grid, a, b) {
    if (!a || !b || (a.r === b.r && a.c === b.c)) return null;
    const type = grid[a.r]?.[a.c];
    if (!type || grid[b.r]?.[b.c] !== type) return null;
    const R = grid.length, C = grid[0].length;
    const open = (r, c) => r >= 0 && c >= 0 && r < R && c < C && (grid[r][c] === 0 || (r === b.r && c === b.c));
    let frontier = [{ r: a.r, c: a.c, d: -1, path: [{ r: a.r, c: a.c }] }];
    const seen = new Set();
    for (let turn = 0; turn <= 2; turn++) {
      const next = [];
      for (const at of frontier) {
        for (let d = 0; d < 4; d++) {
          if (at.d >= 0 && (d === at.d || d === (at.d + 2) % 4)) continue;
          let r = at.r + DR[d], c = at.c + DC[d];
          while (open(r, c)) {
            if (r === b.r && c === b.c) return [...at.path, { r, c }];
            const key = (r * C + c) * 4 + d;
            if (!seen.has(key)) { seen.add(key); next.push({ r, c, d, path: [...at.path, { r, c }] }); }
            r += DR[d]; c += DC[d];
          }
        }
      }
      frontier = next;
    }
    return null;
  }

  // Any pair that can be taken now: { a, b, path } or null.
  function findMove(grid) {
    const byType = new Map();
    for (const cell of cellsOf(grid)) {
      const t = grid[cell.r][cell.c];
      if (!byType.has(t)) byType.set(t, []);
      byType.get(t).push(cell);
    }
    for (const list of byType.values()) {
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const path = findPath(grid, list[i], list[j]);
        if (path) return { a: list[i], b: list[j], path };
      }
    }
    return null;
  }

  // Shuffle the tiles left among the places they hold, until a move shows.
  function shuffle(grid, rnd) {
    const cells = cellsOf(grid);
    for (let tries = 0; tries < 30; tries++) {
      const values = mix(cells.map(cell => grid[cell.r][cell.c]), rnd);
      cells.forEach((cell, i) => { grid[cell.r][cell.c] = values[i]; });
      if (!cells.length || findMove(grid)) return true;
    }
    return Boolean(findMove(grid));
  }

  // After a pair: slide the tiles toward one side, closing the gaps.
  function slide(grid, gravity) {
    if (gravity === "none") return;
    const { rows, cols } = inner(grid);
    const vertical = gravity === "down" || gravity === "up";
    const lines = vertical ? cols : rows, length = vertical ? rows : cols;
    for (let k = 1; k <= lines; k++) {
      const at = (i) => (vertical ? [i, k] : [k, i]);
      const values = [];
      for (let i = 1; i <= length; i++) { const [r, c] = at(i); if (grid[r][c]) values.push(grid[r][c]); }
      const toEnd = gravity === "down" || gravity === "right";
      for (let i = 1; i <= length; i++) {
        const [r, c] = at(i);
        const from = toEnd ? i - (length - values.length) - 1 : i - 1;
        grid[r][c] = from >= 0 && from < values.length ? values[from] : 0;
      }
    }
  }

  // Take a pair off if it may go; returns the line, or null.
  function take(grid, a, b, gravity = "none") {
    const path = findPath(grid, a, b);
    if (!path) return null;
    grid[a.r][a.c] = 0;
    grid[b.r][b.c] = 0;
    slide(grid, gravity);
    return path;
  }

  // Points: more for pairs taken quickly one after another (the combo).
  const pairScore = (combo) => 10 * Math.min(6, Math.max(1, combo));
  const timeBonus = (secondsLeft) => Math.max(0, Math.round(secondsLeft)) * 3;
  function starsFor(level, secondsLeft) {
    const share = Math.max(0, secondsLeft) / level.time;
    return share >= STAR_TIME[1] ? 3 : share >= STAR_TIME[0] ? 2 : 1;
  }
  // Coins each clear (half on a replay), gems the first time and the
  // first time at three stars.
  function rewardFor(level, first, stars, before = 0) {
    const coins = Math.round((40 + 8 * level.num) * (first ? 1 : .5));
    const gems = (first ? 15 : 0) + (stars >= 3 && before < 3 ? 15 : 0);
    return { coins, gems };
  }

  return {
    LEVELS, GRAVITY, GRAVITY_NAMES, STAR_TIME, HINTS, SHUFFLES,
    levelOf, random, emptyGrid, cellsOf, tilesLeft, deal, findPath, findMove, shuffle, slide, take,
    pairScore, timeBonus, starsFor, rewardFor
  };
});

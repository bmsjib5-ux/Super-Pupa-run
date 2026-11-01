// Pupa Logic (ปริศนาประจำวัน): the rules, with no page in them, so Node
// (and the server, for the daily ranking) can use them too. A nonogram: the
// numbers by each row and column are the runs of filled cells in it, in
// order. Fill the cells so every row and column matches; the picture is a
// character of the game. Every puzzle (logic-puzzles.js) solves by line
// logic alone, so it has one answer and needs no guessing.
//
// One daily puzzle, the same for everyone that (Bangkok) day: 10 x 10 on
// weekdays, 15 x 15 at the weekend; and a ladder of practice puzzles.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./logic-puzzles.js"));
  else root.PupaLogicEngine = factory(root.PupaLogicPuzzles);
})(typeof self !== "undefined" ? self : this, function (DATA) {
  "use strict";

  const HINT_PENALTY = 30;   // seconds a daily hint adds to the time
  const PRACTICE = DATA.practice;
  const DAILY = DATA.daily, WEEKEND = DATA.weekend;
  const FIRST_DAY = "2026-11-01";

  // ---- Clues ----
  // rows: ["0110", ...] -> the runs of 1s in each row and column
  function runsOf(cells) {
    const out = [];
    let run = 0;
    for (const v of cells) { if (v) run++; else if (run) { out.push(run); run = 0; } }
    if (run) out.push(run);
    return out;
  }
  function cluesOf(rows) {
    const n = rows.length, m = rows[0].length;
    const grid = rows.map(r => [...r].map(Number));
    return {
      rows: grid.map(runsOf),
      cols: Array.from({ length: m }, (_, c) => runsOf(grid.map(r => r[c])))
    };
  }
  const matches = (cells, clue) => { const runs = runsOf(cells); return runs.length === clue.length && runs.every((v, i) => v === clue[i]); };

  // ---- Line logic ----
  // cells: -1 unknown, 0 empty, 1 filled. Every way the clue's runs can lie
  // in the line, keeping to what is known; cells the same in all of them
  // are settled. Returns the line, or null if no way fits.
  function solveLine(clue, cells) {
    const n = cells.length, k = clue.length;
    // can[i][j]: runs j.. fit in cells i..; filled with memo
    const memo = new Map();
    const fits = (i, j) => {
      const key = i * 64 + j;
      if (memo.has(key)) return memo.get(key);
      let ok;
      if (j === k) { ok = true; for (let x = i; x < n; x++) if (cells[x] === 1) { ok = false; break; } }
      else {
        ok = false;
        const len = clue[j];
        for (let s = i; s + len <= n; s++) {
          if (s > i && cells[s - 1] === 1) break; // a filled cell left behind
          let room = true;
          for (let x = s; x < s + len; x++) if (cells[x] === 0) { room = false; break; }
          if (!room) continue;
          if (s + len < n && cells[s + len] === 1) continue;
          if (fits(Math.min(n, s + len + 1), j + 1)) { ok = true; break; }
        }
      }
      memo.set(key, ok);
      return ok;
    };
    if (!fits(0, 0)) return null;
    // which cells can be filled, which can be empty, over every fit
    const canFill = new Array(n).fill(false), canEmpty = new Array(n).fill(false);
    const walk = (i, j) => {
      if (j === k) { for (let x = i; x < n; x++) canEmpty[x] = true; return; }
      const len = clue[j];
      for (let s = i; s + len <= n; s++) {
        if (s > i && cells[s - 1] === 1) break;
        let room = true;
        for (let x = s; x < s + len; x++) if (cells[x] === 0) { room = false; break; }
        if (!room || (s + len < n && cells[s + len] === 1) || !fits(Math.min(n, s + len + 1), j + 1)) continue;
        for (let x = i; x < s; x++) canEmpty[x] = true;
        for (let x = s; x < s + len; x++) canFill[x] = true;
        if (s + len < n) canEmpty[s + len] = true;
        const key = `${Math.min(n, s + len + 1)}:${j + 1}`;
        if (!walked.has(key)) { walked.add(key); walk(Math.min(n, s + len + 1), j + 1); }
      }
    };
    const walked = new Set();
    walk(0, 0);
    return cells.map((v, x) => (v !== -1 ? v : canFill[x] && !canEmpty[x] ? 1 : canEmpty[x] && !canFill[x] ? 0 : -1));
  }
  // Rows and columns in turn until nothing more settles. The grid, or
  // null if it doesn't settle every cell (or contradicts).
  function solve(rowClues, colClues) {
    const n = rowClues.length, m = colClues.length;
    const grid = Array.from({ length: n }, () => new Array(m).fill(-1));
    for (let changed = true; changed;) {
      changed = false;
      for (let r = 0; r < n; r++) {
        const line = solveLine(rowClues[r], grid[r]);
        if (!line) return null;
        line.forEach((v, c) => { if (v !== grid[r][c]) { grid[r][c] = v; changed = true; } });
      }
      for (let c = 0; c < m; c++) {
        const line = solveLine(colClues[c], grid.map(row => row[c]));
        if (!line) return null;
        line.forEach((v, r) => { if (v !== grid[r][c]) { grid[r][c] = v; changed = true; } });
      }
    }
    return grid.every(row => row.every(v => v !== -1)) ? grid : null;
  }

  // ---- Puzzles ----
  // A puzzle: { id, n, rows, art, name } (rows: strings of 0 and 1).
  const solvedBy = (puzzle, filled) => puzzle.rows.every((row, r) => [...row].every((v, c) => (v === "1") === Boolean(filled[r]?.[c])));
  // The clues' grid is solved when every row and column matches (it then
  // is the puzzle's picture, the answer being unique).
  function isSolved(clues, filled) {
    return clues.rows.every((clue, r) => matches(filled[r], clue)) && clues.cols.every((clue, c) => matches(filled.map(row => row[c]), clue));
  }
  // The day's number since FIRST_DAY, and its puzzle: the pools are
  // walked in a fixed shuffled order, weekends from the bigger pool.
  const dayNumber = (day) => Math.round((Date.parse(`${day}T00:00:00Z`) - Date.parse(`${FIRST_DAY}T00:00:00Z`)) / 86_400_000);
  const isWeekend = (day) => [0, 6].includes(new Date(`${day}T00:00:00Z`).getUTCDay());
  function dailyFor(day) {
    const k = dayNumber(day), pool = isWeekend(day) ? WEEKEND : DAILY;
    const at = ((k * 37) % pool.length + pool.length) % pool.length;
    return { ...pool[at], day, weekend: isWeekend(day) };
  }
  const previousDay = (day) => new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

  // ---- Stars and rewards ----
  // Practice: three stars without a hint, two with one, else one.
  const starsFor = (hints) => (hints <= 0 ? 3 : hints === 1 ? 2 : 1);
  function practiceReward(level, first, stars, before = 0) {
    const coins = Math.round((30 + 5 * level) * (first ? 1 : .5));
    const gems = (first ? 10 : 0) + (stars >= 3 && before < 3 ? 10 : 0);
    return { coins, gems, dust: first ? 3 : 0, ore: first ? 5 : 0 };
  }
  // The day's puzzle, solved: more for a longer streak and the weekend's.
  function dailyReward(streak, weekend) {
    return { coins: weekend ? 300 : 150, gems: (weekend ? 40 : 20) + Math.min(30, 5 * Math.max(0, streak - 1)), dust: 5, ore: 10 };
  }

  return {
    HINT_PENALTY, PRACTICE, DAILY, WEEKEND, FIRST_DAY,
    runsOf, cluesOf, matches, solveLine, solve, solvedBy, isSolved, dayNumber, isWeekend, dailyFor, previousDay, starsFor, practiceReward, dailyReward
  };
});

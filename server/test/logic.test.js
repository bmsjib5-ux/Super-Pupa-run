// Pupa Logic: the puzzle rules (dist/logic-engine.js) and the daily
// ranking (src/logic.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryStore } from "../src/store.js";
import { L, startLogic, hintLogic, finishLogic, boardLogic, MAX_HINTS } from "../src/logic.js";
import { cleanSave, mergeSave } from "../src/merge.js";

test("logic: clues are the runs of each row and column", () => {
  const clues = L.cluesOf(["1101", "0000", "1111"]);
  assert.deepEqual(clues.rows, [[2, 1], [], [4]]);
  assert.deepEqual(clues.cols, [[1, 1], [1, 1], [1], [1, 1]]);
});

test("logic: line logic settles what every fit agrees on", () => {
  // 8 in 10: the middle six are sure
  assert.deepEqual(L.solveLine([8], new Array(10).fill(-1)), [-1, -1, 1, 1, 1, 1, 1, 1, -1, -1]);
  // a known empty pushes the run
  assert.deepEqual(L.solveLine([3], [0, -1, -1, -1, 0]), [0, 1, 1, 1, 0]);
  // a run too long for the room left: no way to fit
  assert.equal(L.solveLine([4], [-1, 0, -1, -1, -1]), null);
  assert.deepEqual(L.solveLine([3], [-1, 0, -1, -1, -1]), [0, 0, 1, 1, 1]);
  // the empty clue empties the line
  assert.deepEqual(L.solveLine([], [-1, -1, -1]), [0, 0, 0]);
});

test("logic: every puzzle has one answer that line logic finds, at its size", () => {
  const check = (p, n) => {
    assert.equal(p.n, n, p.id);
    assert.equal(p.rows.length, n, p.id);
    assert.ok(p.rows.every(r => r.length === n && /^[01]+$/.test(r)), p.id);
    const clues = L.cluesOf(p.rows);
    const grid = L.solve(clues.rows, clues.cols);
    assert.ok(grid && grid.every((row, r) => row.join("") === p.rows[r]), p.id);
    assert.ok(p.name && p.art.startsWith("assets/"), p.id);
  };
  assert.equal(L.PRACTICE.length, 30);
  let last = 0;
  for (const p of L.PRACTICE) { assert.ok(p.n >= last); last = p.n; check(p, p.n); }
  assert.equal(new Set(L.PRACTICE.map(p => p.art)).size, L.PRACTICE.length);
  for (const p of L.DAILY) check(p, 10);
  for (const p of L.WEEKEND) check(p, 15);
  assert.ok(L.DAILY.length >= 60 && L.WEEKEND.length >= 60);
});

test("logic: the day's puzzle is the same all day, 15 x 15 at the weekend, and changes each day", () => {
  assert.equal(L.dailyFor("2026-11-02").n, 10);   // a Monday
  assert.equal(L.dailyFor("2026-11-07").n, 15);   // a Saturday
  assert.deepEqual(L.dailyFor("2026-11-03"), L.dailyFor("2026-11-03"));
  const week = ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"].map(d => L.dailyFor(d).id);
  assert.equal(new Set(week).size, 5);
  assert.equal(L.previousDay("2026-11-01"), "2026-10-31");
  // a solved grid
  const p = L.dailyFor("2026-11-02"), filled = p.rows.map(r => [...r].map(Number));
  assert.ok(L.isSolved(L.cluesOf(p.rows), filled) && L.solvedBy(p, filled));
  filled[0][0] = 1 - filled[0][0];
  assert.ok(!L.isSolved(L.cluesOf(p.rows), filled));
});

test("logic: a daily run keeps its start, hints add time, a right grid ranks once", async () => {
  const store = new MemoryStore();
  const ann = { uid: "ann", name: "Ann Smith" }, bob = { uid: "bob", name: "Bob" };
  const t0 = Date.parse("2026-11-03T03:00:00Z"); // 10:00 in Bangkok
  const run = await startLogic(store, ann, t0);
  assert.ok(run.runId && run.day === "2026-11-03" && run.at === t0 && !run.hints.length);
  // asking again later keeps the same start
  assert.equal((await startLogic(store, ann, t0 + 60_000)).at, t0);
  const puzzle = L.dailyFor(run.day);
  const hint = await hintLogic(store, ann, { runId: run.runId }, t0 + 70_000);
  assert.equal(puzzle.rows[hint.cell[0]][hint.cell[1]], "1");
  assert.equal(hint.hints, 1);
  // a wrong grid is turned back and the run stays
  const wrong = puzzle.rows.map((r, i) => (i ? r : r.replace(/./, ch => (ch === "1" ? "0" : "1"))));
  assert.equal((await finishLogic(store, ann, { runId: run.runId, rows: wrong }, t0 + 90_000)).error, "wrong");
  const done = await finishLogic(store, ann, { runId: run.runId, rows: puzzle.rows }, t0 + 100_000);
  assert.equal(done.ms, 100_000 + L.HINT_PENALTY * 1000);
  assert.equal(done.rank, 1);
  // once solved, today's start says so
  assert.deepEqual((await startLogic(store, ann, t0 + 200_000)).done, { ms: done.ms, hints: 1, rank: 1 });
  assert.equal((await finishLogic(store, ann, { runId: run.runId, rows: puzzle.rows }, t0 + 210_000)).error, "no_run");
  // bob, faster and without a hint, goes first
  const b = await startLogic(store, bob, t0 + 300_000);
  const bobDone = await finishLogic(store, bob, { runId: b.runId, rows: puzzle.rows }, t0 + 350_000);
  assert.equal(bobDone.rank, 1);
  const board = await boardLogic(store, ann, t0 + 400_000);
  assert.deepEqual(board.places.map(p => [p.rank, p.name, p.ms, p.me]), [[1, "Bob", 50_000, false], [2, "Ann S.", 130_000, true]]);
  assert.equal(board.me.rank, 2);
  // hints run out
  const c = await startLogic(store, { uid: "cat", name: "Cat" }, t0);
  for (let k = 0; k < MAX_HINTS; k++) assert.ok((await hintLogic(store, { uid: "cat" }, { runId: c.runId }, t0)).cell);
  assert.equal((await hintLogic(store, { uid: "cat" }, { runId: c.runId }, t0)).error, "no_hints");
  // a new Bangkok day, a new run
  const next = await startLogic(store, ann, Date.parse("2026-11-03T17:30:00Z"));
  assert.equal(next.day, "2026-11-04");
  assert.ok(next.runId);
});

test("merge: Pupa Logic keeps practice stars and the later day's streak", () => {
  const a = mergeSave(null, cleanSave({ best: 1, points: 1, coins: 0, plays: 1, wins: 0, cleared: [], shop: { owned: [], items: {}, petLevels: {}, bring: {} }, logic: { stars: { 1: 3, 2: 1 }, last: "2026-11-03", streak: 4, best: 6, days: 9 } }), 0);
  assert.deepEqual(a.logic, { stars: { 1: 3, 2: 1 }, last: "2026-11-03", streak: 4, best: 6, days: 9 });
  const b = mergeSave(a, cleanSave({ best: 1, points: 1, coins: 0, plays: 1, wins: 0, cleared: [], shop: { owned: [], items: {}, petLevels: {}, bring: {} }, logic: { stars: { 2: 3 }, last: "2026-11-04", streak: 5, best: 5, days: 10 } }), 0);
  assert.deepEqual(b.logic, { stars: { 1: 3, 2: 3 }, last: "2026-11-04", streak: 5, best: 6, days: 10 });
  // an older device's day doesn't undo it
  const c = mergeSave(b, cleanSave({ best: 1, points: 1, coins: 0, plays: 1, wins: 0, cleared: [], shop: { owned: [], items: {}, petLevels: {}, bring: {} }, logic: { stars: {}, last: "2026-11-01", streak: 1, best: 1, days: 2 } }), 0);
  assert.equal(c.logic.last, "2026-11-04");
  assert.equal(c.logic.streak, 5);
});

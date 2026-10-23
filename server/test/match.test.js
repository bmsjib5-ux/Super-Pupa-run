// The match mode's rules (dist/match-engine.js) run in Node too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const M = createRequire(import.meta.url)("../../dist/match-engine.js");

// a board from rows of numbers (0 empty), padded with the empty ring
function board(rows) {
  const grid = M.emptyGrid(rows.length, rows[0].length);
  rows.forEach((row, r) => row.forEach((v, c) => { grid[r + 1][c + 1] = v; }));
  return grid;
}
const turns = (path) => path.length - 2;

test("match: every level deals an even board with a move", () => {
  for (let n = 1; n <= M.LEVELS; n++) {
    const level = M.levelOf(n);
    assert.equal((level.rows * level.cols) % 2, 0);
    assert.ok(level.types >= 2 && level.types <= level.pairs && level.time > 0);
    const grid = M.deal(level, M.random(n));
    assert.equal(M.tilesLeft(grid), level.rows * level.cols);
    const count = new Map();
    for (const { r, c } of M.cellsOf(grid)) count.set(grid[r][c], (count.get(grid[r][c]) || 0) + 1);
    for (const k of count.values()) assert.equal(k % 2, 0);
    assert.ok(M.findMove(grid), `level ${n}`);
  }
  // the levels get bigger, the time per pair shorter
  assert.ok(M.levelOf(30).pairs > M.levelOf(1).pairs);
  assert.ok(M.levelOf(30).time / M.levelOf(30).pairs < M.levelOf(1).time / M.levelOf(1).pairs);
});

test("match: a line joins two alike with at most two turns, round the edge too", () => {
  // side by side, and in a straight line across empty cells
  let g = board([[1, 1, 2], [3, 0, 3], [2, 4, 4]]);
  assert.equal(turns(M.findPath(g, { r: 1, c: 1 }, { r: 1, c: 2 })), 0);
  assert.equal(turns(M.findPath(g, { r: 2, c: 1 }, { r: 2, c: 3 })), 0);
  // opposite corners boxed in: round the outside would take three turns
  assert.equal(M.findPath(g, { r: 1, c: 3 }, { r: 3, c: 1 }), null);
  // round the outside: the two ends of the top row join over the edge
  const edge = board([[2, 1, 2], [3, 3, 3]]);
  const over = M.findPath(edge, { r: 1, c: 1 }, { r: 1, c: 3 });
  assert.equal(turns(over), 2);
  assert.ok(over.some(p => p.r === 0));
  // different pictures never join
  assert.equal(M.findPath(g, { r: 1, c: 1 }, { r: 1, c: 3 }), null);
  // one turn through an empty corner
  g = board([[5, 0], [6, 5]]);
  assert.equal(turns(M.findPath(g, { r: 1, c: 1 }, { r: 2, c: 2 })), 1);
  // walled in all round: no line
  g = board([[9, 9, 9, 9, 9], [9, 7, 9, 8, 9], [9, 9, 9, 9, 9]]);
  g[2][4] = 7; g[2][2] = 7;
  const shut = M.findPath(g, { r: 2, c: 2 }, { r: 2, c: 4 });
  assert.equal(shut, null);
  // three turns would be needed: not allowed
  // (an S-shaped corridor: right, down, left, down; round the edge is longer)
  g = board([
    [1, 0, 0, 2],
    [2, 2, 0, 2],
    [2, 0, 0, 2],
    [2, 1, 2, 2]
  ]);
  assert.equal(M.findPath(g, { r: 1, c: 1 }, { r: 4, c: 2 }), null);
  // open the corner and two turns do it
  g[3][1] = 0; g[4][1] = 0;
  assert.ok(turns(M.findPath(g, { r: 1, c: 1 }, { r: 4, c: 2 })) <= 2);
  // the line returned runs through empty cells only, corner to corner
  g = board([[1, 0, 0], [2, 2, 0], [0, 0, 1]]);
  const path = M.findPath(g, { r: 1, c: 1 }, { r: 3, c: 3 });
  assert.ok(path && turns(path) <= 2);
  for (let i = 1; i < path.length; i++) assert.ok(path[i].r === path[i - 1].r || path[i].c === path[i - 1].c);
});

test("match: tiles slide toward the level's side after a pair", () => {
  const g = board([[1, 2], [0, 3], [4, 0]]);
  M.slide(g, "down");
  assert.deepEqual([g[1][1], g[2][1], g[3][1]], [0, 1, 4]);
  assert.deepEqual([g[1][2], g[2][2], g[3][2]], [0, 2, 3]);
  const h = board([[0, 1, 0, 2], [3, 0, 0, 0]]);
  M.slide(h, "left");
  assert.deepEqual(h[1].slice(1, 5), [1, 2, 0, 0]);
  M.slide(h, "right");
  assert.deepEqual(h[1].slice(1, 5), [0, 0, 1, 2]);
  assert.deepEqual(h[2].slice(1, 5), [0, 0, 0, 3]);
  // taking a pair empties both and slides
  const t = board([[5, 6], [5, 6]]);
  assert.ok(M.take(t, { r: 1, c: 1 }, { r: 2, c: 1 }, "left"));
  assert.deepEqual([t[1][1], t[2][1], t[1][2], t[2][2]], [6, 6, 0, 0]);
});

test("match: every level can be cleared, shuffling when stuck", () => {
  for (let n = 1; n <= M.LEVELS; n++) {
    for (const seed of [1, 2]) {
      const level = M.levelOf(n), rnd = M.random(n * 31 + seed);
      const grid = M.deal(level, rnd);
      let shuffles = 0, steps = 0;
      while (M.tilesLeft(grid) && steps++ < 400) {
        const move = M.findMove(grid);
        if (!move) { assert.ok(M.shuffle(grid, rnd)); shuffles++; continue; }
        assert.ok(M.take(grid, move.a, move.b, level.gravity));
      }
      assert.equal(M.tilesLeft(grid), 0, `level ${n} seed ${seed}`);
      assert.ok(shuffles <= 12, `level ${n}: ${shuffles} shuffles`);
    }
  }
});

test("match: stars by the time left, rewards once for the first clear", () => {
  const level = M.levelOf(5);
  assert.equal(M.starsFor(level, level.time * .5), 3);
  assert.equal(M.starsFor(level, level.time * .2), 2);
  assert.equal(M.starsFor(level, 1), 1);
  const first = M.rewardFor(level, true, 3, 0), again = M.rewardFor(level, false, 3, 3);
  assert.ok(first.gems === 30 && first.coins > again.coins && again.gems === 0);
  assert.equal(M.rewardFor(level, false, 3, 2).gems, 15);
  assert.ok(M.pairScore(9) === 60 && M.timeBonus(10) === 30);
});

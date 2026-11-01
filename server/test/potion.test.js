// The potion sort's rules (dist/potion-engine.js) run in Node too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const P = createRequire(import.meta.url)("../../dist/potion-engine.js");

// a board from bottles of colours, bottom to top
const board = (...bottles) => ({ bottles: bottles.map(layers => ({ layers: layers.slice(), hide: 0, lock: -1 })) });

test("potion: a pour moves the top run, as much as fits, onto its colour or into an empty bottle", () => {
  const s = board([0, 1, 1], [2, 1], [], [0, 0, 0, 2]);
  assert.equal(P.pour(s, 0, 1), 2);
  assert.deepEqual(s.bottles[1].layers, [2, 1, 1, 1]);
  assert.deepEqual(s.bottles[0].layers, [0]);
  // not onto another colour, not into a full bottle, not from an empty one
  assert.equal(P.pour(s, 0, 3), 0);
  assert.equal(P.pour(s, 3, 1), 0);
  assert.equal(P.pour(s, 2, 0), 0);
  // only what fits goes
  const t = board([1, 2, 2, 2], [0, 0, 2]);
  assert.equal(P.pour(t, 0, 1), 1);
  assert.deepEqual(t.bottles[0].layers, [1, 2, 2]);
  // a bottle of one colour, full, stays put
  assert.equal(P.pour(board([3, 3, 3, 3], []), 0, 1), 0);
});

test("potion: hidden layers show as they come to the top; a corked bottle opens when its colour is filled", () => {
  const s = board([0, 1, 2, 3], [], [], [4, 4, 4]);
  s.bottles[0].hide = 3;
  P.pour(s, 0, 1);
  assert.equal(s.bottles[0].hide, 2);
  P.pour(s, 0, 2);
  assert.equal(s.bottles[0].hide, 1);
  const c = board([1, 0, 0, 0], [4, 4, 4], [4], []);
  c.bottles[0].lock = 4;
  assert.equal(P.canPour(c, 0, 3), false);
  assert.equal(P.canPour(c, 2, 0), false);
  P.pour(c, 2, 1);
  assert.equal(c.bottles[0].lock, -1);
  assert.equal(P.pour(c, 0, 3), 3);
});

test("potion: every level deals the same each time, starts unsorted, and the found way solves it", () => {
  let lastColours = 0;
  for (let n = 1; n <= P.LEVELS; n++) {
    const level = P.levelOf(n), dealt = P.deal(level), again = P.deal(level);
    assert.deepEqual(dealt.state, again.state, `level ${n}`);
    assert.ok(level.colours >= lastColours && level.colours <= P.COLOURS.length, `level ${n}`);
    lastColours = level.colours;
    const { bottles } = dealt.state;
    assert.equal(bottles.length, level.colours + level.empties);
    assert.ok(!P.isSolved(dealt.state) && bottles.every(b => P.run(b) < 3), `level ${n} starts sorted`);
    // each colour CAP times
    const count = {};
    for (const b of bottles) for (const c of b.layers) count[c] = (count[c] || 0) + 1;
    assert.ok(Object.values(count).every(v => v === P.CAP) && Object.keys(count).length === level.colours, `level ${n}`);
    assert.equal(bottles.some(b => b.lock >= 0), level.lock, `level ${n} lock`);
    assert.equal(bottles.some(b => b.hide > 0), level.hidden, `level ${n} hidden`);
    const s = P.clone(dealt.state);
    for (const [a, b] of dealt.way) assert.ok(P.pour(s, a, b) > 0, `level ${n}`);
    assert.ok(P.isSolved(s) && dealt.par === dealt.way.length, `level ${n}`);
  }
});

test("potion: a hint is a first pour of a way that still solves the board; none at a dead end", () => {
  const { state } = P.deal(P.levelOf(12));
  const s = P.clone(state);
  for (let k = 0; k < 6; k++) {
    const h = P.hint(s);
    assert.ok(h && P.pour(s, h[0], h[1]) > 0);
  }
  assert.ok(P.solve(s));
  // two bottles crossed with no room: stuck
  assert.equal(P.hint(board([0, 1, 0, 1], [1, 0, 1, 0])), null);
});

test("potion: stars by pours against par, and rewards", () => {
  assert.equal(P.starsFor(20, 20), 3);
  assert.equal(P.starsFor(20, 20, true), 2);
  assert.equal(P.starsFor(20, 32), 2);
  assert.equal(P.starsFor(20, 33), 1);
  const first = P.rewardFor(P.levelOf(10), true, 3, 0), again = P.rewardFor(P.levelOf(10), false, 3, 3);
  assert.deepEqual(first, { coins: 90, gems: 20, dust: 3, ore: 5 });
  assert.deepEqual(again, { coins: 45, gems: 0, dust: 0, ore: 0 });
});

// The potion sort's rules (dist/potion-engine.js) run in Node too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";

const P = createRequire(import.meta.url)("../../dist/potion-engine.js");

// a board from bottles of colours, bottom to top (or [layers, twists])
const board = (...bottles) => ({ bottles: bottles.map(b => Array.isArray(b[0]) ? P.bottle(b[0], b[1]) : P.bottle(b)) });

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

test("potion: frozen bottles thaw a pour at a time; small bottles hold less; tinted ones take one colour", () => {
  const s = board([[0, 1, 1], { ice: 2 }], [2, 2, 1], [1], []);
  assert.equal(P.canPour(s, 0, 3), false);
  assert.equal(P.canPour(s, 2, 0), false);
  assert.equal(P.pour(s, 1, 3), 1);
  assert.equal(s.bottles[0].ice, 1);
  assert.equal(P.canPour(s, 2, 0), false);
  P.pour(s, 3, 2);
  assert.equal(s.bottles[0].ice, 0);
  assert.equal(P.pour(s, 2, 0), 1, "the thawed bottle takes what fits");
  assert.deepEqual(s.bottles[0].layers, [0, 1, 1, 1]);
  // a small bottle: only what fits, then full
  const v = board([1, 2, 2, 2], [[], { cap: 2 }]);
  assert.equal(P.pour(v, 0, 1), 2);
  assert.equal(P.canPour(v, 0, 1), false);
  assert.equal(P.isSolved(board([0, 0, 0, 0], [[], { cap: 3 }])), true);
  assert.equal(P.isSolved(board([0, 0], [[0, 0], { cap: 2 }])), false, "a small bottle can't finish a colour");
  // a tinted bottle
  const t = board([0, 3], [1, 0], [[], { only: 0 }]);
  assert.equal(P.canPour(t, 0, 2), false);
  assert.equal(P.pour(t, 1, 2), 1);
  assert.deepEqual(t.bottles[2].layers, [0]);
});

test("potion: a drip bottle pours one layer at a time; a funnel takes potion but never gives it back", () => {
  const d = board([[0, 1, 1, 1], { drip: true }], []);
  assert.equal(P.pour(d, 0, 1), 1);
  assert.equal(P.pour(d, 0, 1), 1);
  assert.deepEqual(d.bottles[0].layers, [0, 1]);
  const f = board([2, 1, 1], [[], { funnel: true }], []);
  assert.equal(P.pour(f, 0, 1), 2);
  assert.equal(P.canPour(f, 1, 2), false);
  assert.equal(P.canPour(f, 0, 1), false, "only the funnel's colour goes on top");
  // a solver that knows the twists: ice to wait out, then sorted
  const w = board([[0, 1, 0, 1], { ice: 3 }], [1, 0, 1, 0], [], []);
  const way = P.solve(w);
  assert.ok(way);
  for (const [a, b] of way) assert.ok(P.pour(w, a, b) > 0);
  assert.ok(P.isSolved(w));
});

test("potion: levels 1–40 deal just as they did before the twists came in", () => {
  const boards = [];
  for (let n = 1; n <= 40; n++) boards.push(JSON.stringify(P.deal(P.levelOf(n)).state.bottles.map(b => [b.layers, b.hide, b.lock])));
  assert.equal(createHash("sha256").update(boards.join("\n")).digest("hex").slice(0, 16), "f2368d00005e3bb6");
});

test("potion: levels 41–100 deal just as they did before the hard chapters came in", () => {
  const boards = [];
  for (let n = 41; n <= 100; n++) { const d = P.deal(P.levelOf(n)); boards.push(JSON.stringify(d.state) + d.par); }
  assert.equal(createHash("sha256").update(boards.join("\n")).digest("hex").slice(0, 16), "12afa8e6a37c88e9");
});

test("potion: levels 101–120 deal just as they did before the hardest chapters came in", () => {
  const boards = [];
  for (let n = 101; n <= 120; n++) { const d = P.deal(P.levelOf(n)); boards.push(JSON.stringify(d.state) + d.par); }
  assert.equal(createHash("sha256").update(boards.join("\n")).digest("hex").slice(0, 16), "75500f2b4804d90e");
});

test("potion: levels 101–140 are harder: more colours, one plain empty bottle or none, twists stacked, the longest deals", () => {
  const pars = (from, to) => { let sum = 0; for (let n = from; n <= to; n++) sum += P.deal(P.levelOf(n)).par; return sum / (to - from + 1); };
  for (let n = 101; n <= P.LEVELS; n++) {
    const level = P.levelOf(n), dealt = P.deal(level);
    assert.ok(level.hard && P.chapterOf(n).hard, `level ${n}`);
    assert.equal(level.empties, n > 130 ? 0 : 1, `level ${n}`);
    assert.ok(level.colours >= (n > 110 ? 12 : 11), `level ${n} colours`);
    assert.ok(P.twistsOf(level).filter(k => k !== "hidden").length >= 2, `level ${n} twists`);
    // the picked deal is the one used, and a hint comes quickly from the start
    assert.equal(dealt.attempt, level.seed, `level ${n} seed`);
    const stats = {};
    assert.ok(P.solve(dealt.state, 60000, null, stats) && stats.boards <= 15000, `level ${n} effort`);
  }
  // every colour has its own look
  assert.equal(new Set(P.COLOURS.map(c => c.hex)).size, P.COLOURS.length);
  assert.equal(new Set(P.COLOURS.map(c => c.sign)).size, P.COLOURS.length);
  assert.ok(P.levelOf(120).colours === P.COLOURS.length);
  const before = pars(91, 100), hard = pars(101, 110), hardest = pars(111, 120);
  assert.ok(hard > before + 10 && hardest > hard, `average pours ${before} / ${hard} / ${hardest}`);
});

test("potion: levels 121–140 deal just as they did before the legend chapters came in", () => {
  const boards = [];
  for (let n = 121; n <= 140; n++) { const d = P.deal(P.levelOf(n)); boards.push(JSON.stringify(d.state) + d.par); }
  assert.equal(createHash("sha256").update(boards.join("\n")).digest("hex").slice(0, 16), "ef0e6d4e54686650");
});

test("potion: levels 141–160, the legend chapters: fog and no plain empty bottle together, more twists, a tighter mark", () => {
  for (let n = 141; n <= P.LEVELS; n++) {
    const level = P.levelOf(n), bottles = P.deal(level).state.bottles;
    assert.equal(level.hard, 3, `level ${n}`);
    assert.equal(P.chapterOf(n).hard, 3, `level ${n}`);
    assert.ok(level.hidden && bottles.every(b => !b.layers.length || b.hide === P.CAP - 1), `level ${n} fog`);
    assert.ok(!bottles.some(b => !b.layers.length && b.cap === P.CAP && b.only < 0 && !b.funnel), `level ${n} has a plain empty bottle`);
    assert.ok(P.twistsOf(level).length >= (n > 150 ? 5 : 4), `level ${n} twists`);
  }
});

test("potion: levels 121–160 are the hardest: fog over every layer, then no plain empty bottle, and a tighter three-star mark", () => {
  for (let n = 121; n <= P.LEVELS; n++) {
    const level = P.levelOf(n), dealt = P.deal(level), bottles = dealt.state.bottles;
    assert.equal(level.hard, n > 140 ? 3 : 2, `level ${n}`);
    if (n <= 130) assert.ok(level.hidden && P.twistsOf(level).length >= 4, `level ${n} fog`);
    else assert.ok(!bottles.some(b => !b.layers.length && b.cap === P.CAP && b.only < 0 && !b.funnel), `level ${n} has a plain empty bottle`);
    // the searched-out shake finds a shorter way than the plain searches
    assert.ok(level.jit > 0, `level ${n} jit`);
    assert.ok(dealt.par < P.deal({ ...level, jit: 0 }).par, `level ${n} par not tighter`);
  }
});

test("potion: 160 levels in chapters, each twist coming in along the way", () => {
  assert.equal(P.LEVELS, 160);
  let next = 1;
  for (const c of P.CHAPTERS) { assert.equal(c.from, next); assert.ok(c.to >= c.from); next = c.to + 1; }
  assert.equal(next, P.LEVELS + 1);
  const seen = new Set();
  for (let n = 1; n <= P.LEVELS; n++) for (const key of P.twistsOf(P.levelOf(n))) seen.add(key);
  assert.deepEqual([...seen].sort(), P.TWISTS.map(t => t.key).sort());
  // past level 40 every level has at least one of the new twists
  for (let n = 41; n <= P.LEVELS; n++) assert.ok(P.twistsOf(P.levelOf(n)).some(k => !["hidden", "lock"].includes(k)), `level ${n}`);
  assert.equal(P.levelOf(250).num, 160);
});

test("potion: every level deals the same each time, starts unsorted, and the found way solves it", () => {
  for (let n = 1; n <= P.LEVELS; n++) {
    const level = P.levelOf(n), dealt = P.deal(level), again = P.deal(level);
    assert.deepEqual(dealt.state, again.state, `level ${n}`);
    assert.ok(level.colours >= 3 && level.colours <= P.COLOURS.length, `level ${n}`);
    if (n > 1 && n <= 40) assert.ok(level.colours >= P.levelOf(n - 1).colours, `level ${n}`);
    const { bottles } = dealt.state;
    assert.equal(bottles.length, level.colours + level.empties + level.small.length + level.only + level.funnel, `level ${n}`);
    assert.ok(!P.isSolved(dealt.state) && bottles.every(b => P.run(b) < 3), `level ${n} starts sorted`);
    // each colour CAP times
    const count = {};
    for (const b of bottles) for (const c of b.layers) count[c] = (count[c] || 0) + 1;
    assert.ok(Object.values(count).every(v => v === P.CAP) && Object.keys(count).length === level.colours, `level ${n}`);
    assert.equal(bottles.some(b => b.lock >= 0), level.lock, `level ${n} lock`);
    assert.equal(bottles.some(b => b.hide > 0), level.hidden, `level ${n} hidden`);
    assert.equal(bottles.filter(b => b.ice > 0).length, level.ice, `level ${n} ice`);
    assert.equal(bottles.filter(b => b.drip).length, level.drip, `level ${n} drip`);
    assert.equal(bottles.filter(b => b.funnel).length, level.funnel, `level ${n} funnel`);
    assert.deepEqual(bottles.filter(b => b.cap < P.CAP).map(b => b.cap), level.small, `level ${n} small`);
    assert.equal(new Set(bottles.filter(b => b.only >= 0).map(b => b.only)).size, level.only, `level ${n} tinted`);
    // the twists only on the bottles they belong on
    assert.ok(bottles.every(b => !(b.ice > 0 && b.lock >= 0) && (!b.funnel && b.only < 0 && b.cap === P.CAP || !b.layers.length)), `level ${n}`);
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
  // the last level of a chapter, the first time, 20 gems more
  assert.deepEqual(P.rewardFor(P.levelOf(50), true, 1, 0), { coins: 330, gems: 30, dust: 3, ore: 5 });
  assert.equal(P.rewardFor(P.levelOf(50), false, 3, 1).gems, 10);
  assert.equal(P.rewardFor(P.levelOf(120), true, 1, 0).gems, 30);
  assert.equal(P.rewardFor(P.levelOf(119), true, 1, 0).gems, 10);
});

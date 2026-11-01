// The block jam's rules (dist/blocks-engine.js) run in Node too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const B = createRequire(import.meta.url)("../../dist/blocks-engine.js");

// a 4x4 board with a red gate on top over columns 1-2
const board = (blocks, rocks = []) => ({ w: 4, h: 4, rocks, gates: [{ side: "top", from: 1, len: 2, colour: 0 }], blocks, gone: 0 });
const block = (id, colour, cells, x, y, more = {}) => ({ id, colour, cells, x, y, axis: "", ice: 0, ...more });

test("blocks: a block slides through empty cells only, inside the board", () => {
  const s = board([block(1, 0, [[0, 0], [1, 0]], 1, 2), block(2, 1, [[0, 0]], 1, 3)], ["0,2"]);
  assert.equal(B.step(s, 1, -1, 0), false); // a rock
  assert.equal(B.step(s, 1, 0, 1), false);  // block 2 below
  assert.equal(B.step(s, 1, 1, 0), true);
  assert.equal(B.step(s, 1, 1, 0), false);  // the edge
  assert.equal(B.step(s, 1, 0, -1), true);
});

test("blocks: a block leaves by a gate of its colour when it fits the span and the way out is clear", () => {
  const s = board([block(1, 0, [[0, 0], [1, 0]], 1, 0)]);
  assert.ok(B.exitOf(s, s.blocks[0]));
  // too wide, or off the span, or the wrong colour: no
  const wide = block(1, 0, [[0, 0], [1, 0], [2, 0]], 1, 0);
  assert.equal(B.exitOf(board([wide]), wide), null);
  assert.equal(B.exitOf(board([]), block(1, 0, [[0, 0], [1, 0]], 2, 0)), null);
  assert.equal(B.exitOf(board([]), block(1, 1, [[0, 0], [1, 0]], 1, 0)), null);
  // an L whose lower arm must pass a cell another block fills
  const l = block(1, 0, [[0, 0], [1, 0], [1, 1]], 1, 1), blocker = block(2, 1, [[0, 0]], 2, 0);
  assert.equal(B.exitOf(board([l, blocker]), l), null);
  assert.equal(B.exitOf(board([l]), l), null); // not touching the edge yet
  const up = block(1, 0, [[0, 0], [1, 0], [1, 1]], 1, 0);
  assert.ok(B.exitOf(board([up]), up));
});

test("blocks: frozen blocks thaw as others leave; one-way blocks slide one way", () => {
  const s = board([block(1, 0, [[0, 0]], 1, 2, { ice: 2 }), block(2, 1, [[0, 0]], 3, 3), block(3, 1, [[0, 0]], 0, 3)]);
  assert.equal(B.step(s, 1, 0, -1), false);
  B.remove(s, 2);
  assert.equal(s.blocks[0].ice, 1);
  B.remove(s, 3);
  assert.equal(s.blocks[0].ice, 0);
  assert.equal(B.step(s, 1, 0, -1), true);
  const one = board([block(1, 0, [[0, 0]], 1, 2, { axis: "v" })]);
  assert.equal(B.step(one, 1, 1, 0), false);
  assert.equal(B.step(one, 1, 0, -1), true);
});

test("blocks: every level is the same each time and clears in its order, each way a real path", () => {
  for (let n = 1; n <= B.LEVELS; n++) {
    const level = B.levelOf(n), dealt = B.deal(level), again = B.deal(level);
    assert.deepEqual(dealt.state, again.state, `level ${n}`);
    const s = B.clone(dealt.state);
    assert.equal(s.blocks.length, level.blocks, `level ${n}`);
    assert.equal(s.gates.length, level.colours, `level ${n}`);
    assert.ok(s.blocks.filter(b => b.ice).length <= level.ice, `level ${n} ice`);
    assert.equal(s.blocks.filter(b => b.axis).length, level.arrows, `level ${n} arrows`);
    // no block starts on a way out
    for (const b of s.blocks) assert.equal(B.exitOf(s, b), null, `level ${n} block ${b.id}`);
    // play it: each block in turn walks its path a cell at a time and leaves
    for (const id of dealt.order) {
      const way = B.ways(s).find(w => w.id === id);
      assert.ok(way, `level ${n} block ${id}`);
      for (let k = 1; k < way.path.length; k++) {
        const [x0, y0] = way.path[k - 1], [x1, y1] = way.path[k];
        assert.ok(B.step(s, id, x1 - x0, y1 - y0), `level ${n} block ${id} step ${k}`);
      }
      assert.ok(B.exitOf(s, s.blocks.find(b => b.id === id)), `level ${n} block ${id} leaves`);
      B.remove(s, id);
    }
    assert.ok(B.cleared(s), `level ${n}`);
  }
});

test("blocks: stars by time left, and rewards", () => {
  const level = B.levelOf(10);
  assert.equal(B.starsFor(level, level.time * .4), 3);
  assert.equal(B.starsFor(level, level.time * .2), 2);
  assert.equal(B.starsFor(level, 1), 1);
  assert.deepEqual(B.rewardFor(level, true, 3, 0), { coins: 90, gems: 20, dust: 3, ore: 5 });
  assert.deepEqual(B.rewardFor(level, false, 2, 3), { coins: 45, gems: 0, dust: 0, ore: 0 });
});

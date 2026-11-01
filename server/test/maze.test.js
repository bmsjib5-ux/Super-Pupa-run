// The perspective maze's rules (dist/maze-engine.js) run in Node too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const M = createRequire(import.meta.url)("../../dist/maze-engine.js");
const idAt = (s, x, y, z) => s.blocks.find(b => b.x === x && b.y === y && b.z === z)?.id;

test("maze: tops that meet on the screen are joined, whatever their depth", () => {
  // level 4: the low path meets the tower top once it is turned
  const s = M.build(4);
  const goal = s.goal;
  assert.equal(M.pathTo(s, goal), null);
  assert.ok(M.move(s, 0));
  const path = M.pathTo(s, goal);
  assert.ok(path && path.length >= 4);
  // a step from z = 0 to z = 2: two cells apart in x, but next to each other on the screen
  const low = s.blocks.find(b => b.id === path[2]), high = s.blocks.find(b => b.id === path[3]);
  assert.equal(high.z - low.z, 2);
  assert.equal(Math.abs((high.x - high.z) - (low.x - low.z)) + Math.abs((high.y - high.z) - (low.y - low.z)), 1);
});

test("maze: turns go round the pivot, slides stop at their ends and against blocks", () => {
  const s = M.build(2);
  assert.deepEqual(M.spot(s.groups[0], [2, 0, 0], 1), [3, -1, 0]);
  assert.deepEqual(M.spot(s.groups[0], [2, 0, 0], 2), [4, 0, 0]);
  const t = M.build(3);
  assert.equal(t.groups[0].step, 3);
  assert.equal(M.canMove(t, 0, 1), false);       // at its end
  assert.ok(M.move(t, 0, -1));
  // the pillar level: the arm can't turn through the pillar until it moves
  // (and Pupa, on the arm's end, would end up hidden behind it: she steps in first)
  const p = M.build(10);
  assert.ok(M.move(p, 0));
  assert.equal(M.canMove(p, 0), false);
  assert.ok(M.move(p, 1, 1));
  assert.equal(M.canMove(p, 0), false);
  const pivot = p.blocks.find(b => b.group === 0 && b.home[0] === 3 && b.home[1] === 3);
  assert.ok(M.walk(p, pivot.id));
  assert.ok(M.canMove(p, 0));
});

test("maze: Pupa rides what she stands on, and nothing may bury or hide her", () => {
  const s = M.build(9);
  // walk onto the lift, ride it up
  const lift = s.blocks.find(b => b.group === 0);
  assert.ok(M.walk(s, lift.id));
  assert.ok(M.move(s, 0, 1));
  assert.equal(s.blocks.find(b => b.id === s.at).z, 1);
  // a lift under a block can't rise into it
  const t = M.build(5);
  t.groups[0].step = 2; M.place(t, 0);
  assert.equal(M.canMove(t, 0, 1), false);
});

test("maze: every level can be cleared, the solver's plan doing it move by move", () => {
  assert.equal(M.LEVELS.length, 12);
  let hardest = 0;
  for (let n = 1; n <= M.LEVELS.length; n++) {
    const res = M.solve(n);
    assert.ok(res, `level ${n}`);
    const s = M.build(n);
    for (const step of res.plan) {
      assert.ok(M.walk(s, step.at), `level ${n}: walk`);
      assert.ok(M.move(s, step.group, step.dir), `level ${n}: move`);
    }
    assert.ok(M.walk(s, s.goal) && M.won(s), `level ${n}`);
    assert.equal(s.moves, res.moves);
    // the goal isn't in reach at the start, past the first level
    if (n > 1) assert.ok(res.moves > 0, `level ${n} needs a move`);
    hardest = Math.max(hardest, res.moves);
  }
  assert.ok(hardest >= 4);
});

test("maze: a plan from part way picks up where the world is", () => {
  const s = M.build(12);
  const all = M.solve(12);
  const first = all.plan[0];
  M.walk(s, first.at);
  M.move(s, first.group, first.dir);
  assert.equal(M.solveFrom(s).moves, all.moves - 1);
});

test("maze: stars by moves against the fewest, and rewards", () => {
  assert.deepEqual([M.starsFor(3, 3), M.starsFor(3, 6), M.starsFor(3, 7)], [3, 2, 1]);
  assert.deepEqual(M.rewardFor(5, true, 3, 0), { coins: 90, gems: 25, dust: 3, ore: 5 });
});

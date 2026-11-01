// The screw puzzle's rules (dist/screws-engine.js) run in Node too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const S = createRequire(import.meta.url)("../../dist/screws-engine.js");

// two plates: a bar at the bottom, a disc on top over its left end
function small(queue, colours) {
  const plates = [
    { id: 0, kind: "bar", x1: 1, y1: 2, x2: 4, y2: 2, layer: 0, tint: 0, gone: false },
    { id: 1, kind: "disc", cx: 1.2, cy: 2.2, r: .8, layer: 1, tint: 1, gone: false },
    { id: 2, kind: "bar", x1: 1, y1: 5, x2: 3, y2: 5, layer: 2, tint: 2, gone: false }
  ];
  const at = [[0, 1, 2], [0, 4, 2], [1, 1.2, 2.2], [2, 1, 5], [2, 3, 5], [2, 2, 5]];
  const screws = at.map(([plate, x, y], i) => ({ id: i + 1, plate, x, y, colour: colours[i], out: false }));
  return S.start({ plates, screws, queue, next: 0, boxes: [], tray: [], trayCap: S.TRAY, failed: false });
}

test("screws: a screw under a plate above can't come out until that plate falls", () => {
  const s = small([0, 1], [0, 0, 1, 1, 1, 0]);
  assert.equal(S.isFree(s, s.screws[0]), false);   // under the disc
  assert.equal(S.unscrew(s, 1), null);
  const events = S.unscrew(s, 3);                   // the disc's only screw
  assert.ok(events.some(e => e.t === "fall" && e.plate === 1));
  assert.equal(S.isFree(s, s.screws[0]), true);
  // a drill takes a covered one anyway
  const d = small([0, 1], [0, 0, 1, 1, 1, 0]);
  assert.ok(S.unscrew(d, 1, true));
});

test("screws: open boxes take their colour, the rest waits on the tray; a full box opens the next, which empties the tray", () => {
  // boxes red, blue open; then yellow
  const s = small([0, 1, 2], [2, 0, 1, 0, 0, 1]);
  assert.deepEqual(s.boxes.map(b => b.colour), [0, 1]);
  S.unscrew(s, 4);                                   // red -> box 0
  S.unscrew(s, 3);                                   // blue -> box 1 (the disc falls)
  assert.deepEqual(S.unscrew(s, 1).map(e => e.t), ["tray"]); // yellow waits
  assert.deepEqual(s.tray, [2]);
  S.unscrew(s, 5);                                   // red
  const events = S.unscrew(s, 2);                    // red: box 0 full -> yellow opens, takes the tray's
  assert.deepEqual(events.map(e => e.t), ["box", "fall", "boxDone", "boxOpen", "fromTray"]);
  assert.deepEqual(s.tray, []);
  assert.deepEqual(s.boxes.map(b => [b.colour, b.count]), [[2, 1], [1, 1]]);
});

test("screws: a screw with no box and a full tray loses", () => {
  const s = small([0, 0], [1, 1, 1, 1, 1, 1]);
  s.trayCap = 2;
  S.unscrew(s, 4); S.unscrew(s, 5);
  const events = S.unscrew(s, 6);
  assert.equal(events.at(-1).t, "full");
  assert.ok(s.failed);
  assert.equal(S.unscrew(s, 3), null);
});

test("screws: every level is the same each time and its way clears it, the tray never full", () => {
  let last = 0;
  for (let n = 1; n <= S.LEVELS; n++) {
    const level = S.levelOf(n), dealt = S.deal(level), again = S.deal(level);
    assert.deepEqual(dealt.state, again.state, `level ${n}`);
    const { screws, plates, queue } = dealt.state;
    assert.ok(screws.length >= last - 6 && screws.length % S.BOX_SIZE === 0, `level ${n}`);
    last = screws.length;
    assert.equal(queue.length * S.BOX_SIZE, screws.length);
    // each colour as many screws as its boxes hold
    for (let c = 0; c < level.colours; c++) assert.equal(screws.filter(x => x.colour === c).length, queue.filter(q => q === c).length * S.BOX_SIZE, `level ${n} colour ${c}`);
    // everything on the board
    for (const x of screws) assert.ok(x.x > 0 && x.y > 0 && x.x < S.W && x.y < S.H, `level ${n}`);
    assert.ok(plates.every(p => screws.some(x => x.plate === p.id)), `level ${n}: a plate with no screws`);
    const s = S.start(dealt.state);
    let most = 0;
    for (const id of dealt.way) {
      assert.ok(S.unscrew(s, id), `level ${n} screw ${id}`);
      most = Math.max(most, s.tray.length);
    }
    assert.ok(S.cleared(s) && most < S.TRAY && s.plates.every(p => p.gone), `level ${n}`);
  }
});

test("screws: a hint is a free screw, one with a box waiting if there is one", () => {
  const s = S.start(S.deal(S.levelOf(20)).state);
  const h = S.hint(s);
  assert.ok(h && S.isFree(s, h));
  if (S.freeScrews(s).some(x => S.whereTo(s, x.colour) === "box")) assert.equal(S.whereTo(s, h.colour), "box");
});

test("screws: stars by tools used, and rewards", () => {
  assert.deepEqual([S.starsFor(0), S.starsFor(1), S.starsFor(2)], [3, 2, 1]);
  assert.deepEqual(S.rewardFor(S.levelOf(10), true, 3, 0), { coins: 90, gems: 20, dust: 3, ore: 5 });
});

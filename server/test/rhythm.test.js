// Pupa's dance beat (dist/rhythm-engine.js): the music, the charts drawn from
// it, judging taps, grades, rewards and the save.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { cleanSave, mergeSave } from "../src/merge.js";

const R = createRequire(import.meta.url)("../../dist/rhythm-engine.js");

test("rhythm: every song is the same each time, in time order, its tune in its key", () => {
  assert.equal(R.SONGS.length, 6);
  for (let n = 1; n <= R.SONGS.length; n++) {
    const a = R.compose(n), b = R.compose(n), song = R.SONGS[n - 1];
    assert.deepEqual(a.events, b.events);
    assert.ok(a.events.every((e, i) => !i || a.events[i - 1].t <= e.t));
    assert.ok(Math.abs(a.length - song.bars * 240 / song.bpm) < 1e-9);
    assert.ok(a.events.at(-1).t < a.length);
    const scale = R.SCALES[song.scale].map(x => (x + song.root) % 12);
    for (const e of a.events) if (e.k === "lead" || e.k === "bass") assert.ok(scale.includes(((e.midi % 12) + 12) % 12), `${n} ${e.k} ${e.midi}`);
    for (const k of ["kick", "snare", "hat", "bass", "chord", "lead"]) assert.ok(a.events.some(e => e.k === k), k);
  }
  assert.ok(Math.abs(R.freq(69) - 440) < 1e-9 && Math.abs(R.freq(81) - 880) < 1e-9);
});

test("rhythm: harder charts ask for more; no lane is asked twice too fast; pairs only from normal up", () => {
  for (let n = 1; n <= R.SONGS.length; n++) {
    const beat = 60 / R.SONGS[n - 1].bpm;
    const [e, nn, h] = R.LEVELS.map(L => R.chart(n, L.key));
    assert.ok(e.length < nn.length && nn.length < h.length, `song ${n}: ${e.length} ${nn.length} ${h.length}`);
    for (const [ch, gap] of [[e, beat * .9], [nn, beat * .5], [h, .12]]) {
      const last = [-9, -9, -9, -9];
      for (const x of ch) {
        assert.ok(x.lane >= 0 && x.lane < 4);
        assert.ok(x.t - last[x.lane] >= gap - 1e-3, `song ${n} lane ${x.lane} at ${x.t}`);
        last[x.lane] = x.t;
      }
      const lanes = [0, 1, 2, 3].map(l => ch.filter(x => x.lane === l).length);
      assert.ok(Math.min(...lanes) >= ch.length * .08, `song ${n} lanes ${lanes}`);
    }
    const pairs = (ch) => ch.filter((x, i) => i && Math.abs(x.t - ch[i - 1].t) < .002).length;
    assert.equal(pairs(e), 0);
    assert.ok(pairs(h) > 0);
  }
});

test("rhythm: a tap is judged by how close it lands, misses break the combo", () => {
  const s = R.create(1, "n");
  const [a, b, c, d] = s.notes;
  assert.equal(R.hit(s, a.lane, a.t + .02).grade, "perfect");
  assert.equal(R.hit(s, a.lane, a.t + .02), null, "a note is judged once");
  assert.equal(R.hit(s, b.lane, b.t - .07).grade, "great");
  assert.equal(R.hit(s, c.lane, c.t + .12).grade, "good");
  assert.equal(s.combo, 3);
  // too far off: nothing
  assert.equal(R.hit(s, d.lane, d.t - .3), null);
  assert.equal(R.hit(s, (d.lane + 1) % 4, d.t), null, "the wrong lane");
  // let it pass
  const missed = R.sweep(s, d.t + .2);
  assert.ok(missed.includes(d));
  assert.equal(s.combo, 0);
  assert.equal(s.counts.miss, missed.length);
});

test("rhythm: perfect play scores a million and an S; tapping nothing fails", () => {
  for (const L of R.LEVELS) {
    const s = R.create(4, L.key);
    for (const x of s.notes) { R.sweep(s, x.t); assert.equal(R.hit(s, x.lane, x.t).grade, "perfect"); }
    R.sweep(s, 999);
    const r = R.result(s);
    assert.deepEqual([r.score, r.grade, r.stars, r.maxCombo, r.total], [1_000_000, "S", 3, s.notes.length, s.notes.length]);
    assert.ok(s.done);
  }
  const idle = R.create(2, "e");
  R.sweep(idle, 999);
  const r = R.result(idle);
  assert.deepEqual([r.score, r.grade, r.stars, r.counts.miss], [0, "F", 0, idle.notes.length]);
  // a middling run
  const mid = R.create(2, "e");
  mid.notes.forEach((x, i) => { R.sweep(mid, x.t); if (i % 5) R.hit(mid, x.lane, x.t + .06); });
  R.sweep(mid, 999);
  const m = R.result(mid);
  assert.equal(m.grade, "C");   // 80% of notes at "great" is 64%
  assert.ok(m.accuracy > .6 && m.accuracy < .7);
});

test("rhythm: rewards and chart keys", () => {
  assert.equal(R.chartKey(3, "n"), "3n");
  assert.deepEqual(R.rewardFor(1, "e", { stars: 3, accuracy: 1 }, true, 0), { coins: 85, gems: 18, dust: 2, ore: 3 });
  assert.deepEqual(R.rewardFor(6, "h", { stars: 1, accuracy: .7 }, false, 1), { coins: 201, gems: 0, dust: 0, ore: 0 });
  assert.deepEqual(R.rewardFor(2, "n", { stars: 0, accuracy: .3 }, true, 0), { coins: 10, gems: 0, dust: 0, ore: 0 });
});

test("merge: the dance beat keeps each chart's best stars and score", () => {
  const device = (rhythm) => ({ best: 1, points: 1, coins: 0, plays: 1, wins: 0, cleared: [], shop: { owned: [], items: {}, petLevels: {}, bring: {} }, rhythm });
  const a = mergeSave(null, cleanSave(device({ stars: { "1e": 3, "2n": 1 }, best: { "1e": 990000, "2n": 700000 } })), 0);
  const b = mergeSave(a, cleanSave(device({ stars: { "2n": 2 }, best: { "2n": 650000, "3h": 500000 } })), 0);
  assert.deepEqual(b.rhythm, { stars: { "1e": 3, "2n": 2 }, best: { "1e": 990000, "2n": 700000, "3h": 500000 } });
});

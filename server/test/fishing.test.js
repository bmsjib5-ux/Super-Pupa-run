// Moon lake fishing (dist/fishing-engine.js): where and when fish come, the
// bite, reeling, what a catch is worth, the album and the save.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { cleanSave, mergeSave } from "../src/merge.js";

const F = createRequire(import.meta.url)("../../dist/fishing-engine.js");

// a careful angler: holds while the tension is under the middle of the band
function reel(fish, gear, seed, style = "smart") {
  const rand = F.rng(seed), f = F.fight(fish, gear, rand);
  let holding = false, react = 0;
  while (!f.outcome && f.t < 120) {
    react -= 1 / 60;
    if (react <= 0) { react = .12 + rand() * .1; holding = style === "smart" ? f.tension < (f.lo + f.hi) / 2 - .03 : style === "hold"; }
    F.stepFight(f, holding);
  }
  return f;
}

test("fishing: thirty fish, each spot and hour has some, every fish can be found", () => {
  assert.equal(F.FISH.length, 30);
  assert.equal(new Set(F.FISH.map(f => f.id)).size, 30);
  for (const z of F.ZONES) for (const s of F.SLOTS) assert.ok(F.FISH.some(f => f.zone === z && f.times.includes(s)), `${z} ${s}`);
  for (const r of [1, 2, 3, 4]) assert.ok(F.FISH.filter(f => f.rarity === r).length >= 4);
  // fish pulled up across many casts: every one turns up somewhere, sometime
  const seen = new Set(), rand = F.rng(1);
  for (const z of F.ZONES) for (const s of F.SLOTS) for (let i = 0; i < 600; i++) { const c = F.pickCatch(rand, z, s, 5); if (c.fish) { seen.add(c.fish.id); assert.equal(c.fish.zone, z); assert.ok(c.fish.times.includes(s)); } }
  assert.equal(seen.size, 30);
  assert.ok(F.FISH.every(f => f.look.emoji || (f.look.body && f.look.fin)));
});

test("fishing: the Bangkok clock sets the hour, the cast power the spot, a featured fish each day", () => {
  const at = (h) => new Date(Date.UTC(2026, 10, 13, (h - 7 + 24) % 24, 30));
  assert.deepEqual([5, 8, 9, 15, 16, 18, 19, 23, 2].map(h => F.slotAt(at(h))), ["dawn", "dawn", "day", "day", "dusk", "dusk", "night", "night", "night"]);
  assert.deepEqual([0, .3, .5, .71, .8, 1].map(F.zoneFor), ["near", "near", "mid", "mid", "far", "far"]);
  const a = F.featured(new Date("2026-11-13T05:00:00Z")), b = F.featured(new Date("2026-11-13T15:00:00Z"));
  assert.equal(a, b, "the same all Bangkok day");
  assert.ok(F.BY_ID[a].rarity <= 2);
  const week = new Set([13, 14, 15, 16, 17, 18, 19].map(d => F.featured(new Date(Date.UTC(2026, 10, d, 5)))));
  assert.ok(week.size >= 4);
});

test("fishing: nibbles come before the bite, rarer fish give less time to strike, bait makes it quicker", () => {
  for (let s = 1; s < 50; s++) {
    const plan = F.bitePlan(F.rng(s), F.FISH[0], 0);
    assert.ok(plan.bite >= 1.2 && plan.bite <= 6);
    assert.ok(plan.nibbles.every(t => t < plan.bite));
  }
  assert.ok(F.bitePlan(F.rng(3), F.BY_ID.moonking).window < F.bitePlan(F.rng(3), F.BY_ID.silverfin).window);
  const slow = F.bitePlan(F.rng(9), F.FISH[0], 0).bite, quick = F.bitePlan(F.rng(9), F.FISH[0], 5).bite;
  assert.ok(quick < slow);
  // better bait finds more rare fish
  const count = (bait) => { const rand = F.rng(4); let n = 0; for (let i = 0; i < 4000; i++) { const c = F.pickCatch(rand, "far", "night", bait); if (c.fish?.rarity >= 3) n++; } return n; };
  assert.ok(count(5) > count(0) * 1.2);
});

test("fishing: reeling: holding all the way snaps the line, letting go loses the fish, care lands it", () => {
  assert.equal(reel(F.BY_ID.goldbarb, {}, 5, "hold").outcome, "snap");
  assert.equal(reel(F.BY_ID.goldbarb, {}, 5, "none").outcome, "escape");
  for (const f of F.FISH.filter(x => x.rarity <= 3)) assert.equal(reel(f, {}, 11).outcome, "caught", f.id);
  // legends fight hard; good gear makes them landable
  const rate = (gear) => { let won = 0; for (const f of F.FISH.filter(x => x.rarity === 4)) for (let s = 1; s <= 20; s++) if (reel(f, gear, s * 31).outcome === "caught") won++; return won / 60; };
  const bare = rate({}), geared = rate({ rod: 5, line: 5 });
  assert.ok(bare < .7, `bare ${bare}`);
  assert.ok(geared > .85 && geared > bare + .2, `geared ${geared}, bare ${bare}`);
  // and a better rod reels faster
  const t0 = reel(F.BY_ID.tilapia, {}, 3).t, t5 = reel(F.BY_ID.tilapia, { rod: 5 }, 3).t;
  assert.ok(t5 < t0);
});

test("fishing: sizes, values, the album and records", () => {
  const rand = F.rng(8);
  for (const f of F.FISH) for (let i = 0; i < 20; i++) { const s = F.sizeOf(rand, f); assert.ok(s >= f.size[0] && s <= f.size[1]); }
  const koi = F.BY_ID.sakurakoi;
  assert.ok(F.valueOf(koi, 70) > F.valueOf(koi, 40));
  assert.equal(F.valueOf(F.BY_ID.silverfin, 4, true), F.valueOf(F.BY_ID.silverfin, 4) * 3);
  const album = {};
  assert.deepEqual(F.record(album, koi, 45.2), { first: true, record: false, gems: 25, dust: 3 });
  assert.deepEqual(F.record(album, koi, 44), { first: false, record: false, gems: 0, dust: 0 });
  assert.deepEqual(F.record(album, koi, 61.75), { first: false, record: true, gems: 0, dust: 0 });
  assert.deepEqual(album, { caught: { sakurakoi: 3 }, best: { sakurakoi: 618 }, total: 3 });
  assert.equal(F.hint(F.BY_ID.moonking), "ไกลฝั่ง · 🌙 กลางคืน");
  assert.equal(F.gearCost(0), 100);
  assert.equal(F.gearCost(5), null);
  assert.deepEqual(F.gearOf({ rod: 9, line: -2, bait: "3" }), { rod: 5, line: 0, bait: 3 });
});

test("merge: fishing keeps the most catches, the biggest fish and the higher gear", () => {
  const device = (fishing) => ({ best: 1, points: 1, coins: 0, plays: 1, wins: 0, cleared: [], shop: { owned: [], items: {}, petLevels: {}, bring: {} }, fishing });
  const a = mergeSave(null, cleanSave(device({ caught: { goldbarb: 4, sakurakoi: 1 }, best: { goldbarb: 210 }, gear: { rod: 2 }, total: 9 })), 0);
  const b = mergeSave(a, cleanSave(device({ caught: { goldbarb: 2, crab: 1 }, best: { goldbarb: 240, crab: 80 }, gear: { rod: 1, bait: 3 }, total: 6 })), 0);
  assert.deepEqual(b.fishing, { caught: { goldbarb: 4, sakurakoi: 1, crab: 1 }, best: { goldbarb: 240, crab: 80 }, gear: { rod: 2, bait: 3 }, total: 9 });
});

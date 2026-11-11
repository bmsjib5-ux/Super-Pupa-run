// Pupa the survivor (dist/survivor-engine.js): the run's rules, level-ups,
// the boss, stars and rewards.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const S = createRequire(import.meta.url)("../../dist/survivor-engine.js");

// a player who keeps away from the crowd, circles, and fetches crystals when it is calm
function steer(s) {
  const p = s.player;
  let fx = 0, fy = 0, close = 0;
  for (const e of s.enemies) {
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy);
    if (d < 260) { const w = 1 / Math.max(20, d - e.r) ** 2; fx += dx * w; fy += dy * w; if (d < 120) close++; }
  }
  for (const b of s.bullets) { const dx = p.x - b.x, dy = p.y - b.y, d = Math.hypot(dx, dy); if (d < 120) { const w = 3 / Math.max(10, d) ** 2; fx += dx * w; fy += dy * w; } }
  let n = Math.hypot(fx, fy), x = n ? fx / n : 0, y = n ? fy / n : 0;
  x += Math.cos(s.t * .35) * .55; y += Math.sin(s.t * .35) * .55;
  if (close < 5) {
    let best = null, bd = 1e9;
    for (const g of [...s.items, ...s.gems]) { const d = Math.hypot(g.x - p.x, g.y - p.y); if (d < bd && d < 450) { bd = d; best = g; } }
    if (best) { const w = close < 2 ? 1.6 : .9; x += (best.x - p.x) / bd * w; y += (best.y - p.y) / bd * w; }
  }
  n = Math.hypot(x, y) || 1;
  return { x: x / n, y: y / n };
}
// and picks: weapons first, then the stronger charms (a heart when hurt)
function pick(s) {
  const score = (o) => o.k === "weapon" ? (o.lv > 1 ? 3 + o.lv * .1 : (s.weapons.length < 3 ? 2.6 : 1.2)) : o.k === "charm" ? (o.id === "heart" && s.player.hp < s.player.maxHp * .5 ? 4 : o.lv > 1 ? 2 : ({ power: 2.2, clock: 2, heart: 1.8, shell: 1.7, boots: 1.4, lens: 1.5, magnet: 1.2 }[o.id] || 1)) : 1;
  let best = 0;
  s.offer.forEach((o, i) => { if (score(o) > score(s.offer[best])) best = i; });
  return best;
}
function run(opts, still = false) {
  const s = S.create(opts), log = [];
  while (!s.over && s.t < 420) {
    if (s.pending) { S.choose(s, pick(s)); continue; }
    S.step(s, still ? {} : steer(s));
    for (const f of S.takeFx(s)) if (f.k === "boss" || f.k === "elite" || f.k === "ring") log.push([f.k, Math.round(s.t)]);
  }
  return { s, log };
}

test("survivor: a hero brings its role's weapon, and a star too when that weapon is close-in", () => {
  assert.deepEqual(S.create({}).weapons.map(w => w.id), ["bolt"]);
  assert.deepEqual(S.create({ hero: { role: "magic" } }).weapons.map(w => w.id), ["lightning"]);
  assert.deepEqual(S.create({ hero: { role: "attack" } }).weapons.map(w => w.id), ["slash", "bolt"]);
  assert.deepEqual(S.create({ hero: { role: "defense" } }).weapons.map(w => w.id), ["orbit", "bolt"]);
  // card level, rarity, role and blessings raise the numbers
  const plain = S.create({}).player, strong = S.create({ hero: { role: "defense", level: 61, rarity: 6 }, perks: { hp: 5, atk: 5 } }).player;
  assert.equal(plain.maxHp, 105);
  assert.ok(strong.maxHp > plain.maxHp * 2 && strong.armor === 1 && strong.dmg > plain.dmg * 1.5);
  // blessings stop at five
  assert.equal(S.create({ perks: { hp: 99 } }).player.maxHp, S.create({ perks: { hp: 5 } }).player.maxHp);
  assert.equal(S.perkCost(0), 150);
  assert.equal(S.perkCost(5), null);
});

test("survivor: crystals fill the level bar and each level offers three picks within the slots", () => {
  const s = S.create({ seed: 7 });
  assert.ok(S.need(1) < S.need(2) && S.need(10) < S.need(20));
  s.gems.push({ x: 0, y: 0, v: S.need(1) + S.need(2) });
  S.step(s, {});
  assert.equal(s.level, 3);
  assert.equal(s.pending, 2);
  assert.equal(s.offer.length, 3);
  // paused while a pick waits
  const t = s.t;
  S.step(s, {});
  assert.equal(s.t, t);
  // a pick is applied, then the next one is offered
  const o = s.offer[0];
  assert.ok(S.choose(s, 0));
  const got = o.k === "weapon" ? s.weapons.find(w => w.id === o.id) : s.charms.find(c => c.id === o.id);
  assert.equal(got.lv, o.lv);
  assert.equal(s.pending, 1);
  assert.equal(s.offer.length, 3);
  // with every slot full, nothing new is offered
  s.weapons = ["bolt", "slash", "orbit", "aura"].map(id => ({ id, lv: 2, cd: 1, angle: 0, tick: 0 }));
  s.charms = ["heart", "boots", "power", "clock"].map(id => ({ id, lv: 1 }));
  for (let i = 0; i < 30; i++) for (const pick of S.offers(s)) assert.ok(pick.k === "weapon" ? ["bolt", "slash", "orbit", "aura"].includes(pick.id) : ["heart", "boots", "power", "clock"].includes(pick.id));
  // all at the top level: a heal or coins instead
  for (const w of s.weapons) w.lv = 5;
  for (const c of s.charms) c.lv = 5;
  assert.deepEqual(S.offers(s).map(o => o.k), ["heal", "gold"]);
});

test("survivor: standing still the crowd wins; a careful player meets the elite, the rings and the boss", () => {
  const still = run({ stage: 1, seed: 3 }, true);
  assert.ok(!still.s.won && still.s.over && still.s.t < S.BOSS_AT);
  assert.equal(S.starsFor(still.s), 0);
  const wins = [1, 2, 3].map(seed => run({ stage: 1, seed }));
  const won = wins.find(r => r.s.won);
  assert.ok(won, "stage 1 can be won by a fresh Pupa");
  assert.deepEqual(won.log.map(([k]) => k), ["ring", "elite", "ring", "elite", "ring", "boss"]);
  assert.equal(won.log.at(-1)[1], S.BOSS_AT);
  assert.ok(S.starsFor(won.s) >= 2);
  // the same seed and moves, the same run
  const again = run({ stage: 1, seed: wins.indexOf(won) + 1 });
  assert.equal(again.s.kills, won.s.kills);
  assert.equal(again.s.t, won.s.t);
});

test("survivor: a later stage is too much for a fresh Pupa", () => {
  const r = run({ stage: 5, seed: 1 });
  assert.ok(!r.s.won && r.s.t < S.BOSS_AT);
});

test("survivor: stars and rewards", () => {
  const s = S.create({});
  s.t = 100;
  assert.equal(S.starsFor(s), 0);
  s.t = S.BOSS_AT + 5;
  assert.equal(S.starsFor(s), 1);
  s.won = true;
  s.player.hp = s.player.maxHp * .4;
  assert.equal(S.starsFor(s), 2);
  s.player.hp = s.player.maxHp * .6;
  assert.equal(S.starsFor(s), 3);
  // coins by kills and time, more on later stages; a first clear brings gems, dust and ore
  assert.deepEqual(S.rewardFor(1, { kills: 100, time: 100 }, true, 1), { coins: 55, gems: 0, dust: 0, ore: 0 });
  assert.deepEqual(S.rewardFor(1, { kills: 100, time: 100 }, true, 2), { coins: 55, gems: 20, dust: 5, ore: 8 });
  assert.deepEqual(S.rewardFor(3, { kills: 100, time: 100, bonus: 25 }, false, 3, 2), { coins: 108, gems: 10, dust: 0, ore: 0 });
  assert.deepEqual(S.rewardFor(3, { kills: 100, time: 100 }, false, 3, 3), { coins: 83, gems: 0, dust: 0, ore: 0 });
});

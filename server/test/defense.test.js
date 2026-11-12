// Defending the cherry garden (dist/defense-engine.js): maps, posting and
// training heroes, waves, what each role does, stars, endless, the save.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { cleanSave, mergeSave } from "../src/merge.js";

const D = createRequire(import.meta.url)("../../dist/defense-engine.js");
const PUPA = { id: "pupa", role: "balance", level: 5, rarity: 2 };

// a sensible defender: heroes where they cover the most path, a mix of roles, training the best
function cover(s, c, r, range) { let n = 0; s.lay.cells.forEach(([pc, pr], i) => { if (Math.hypot(pc - c, pr - r) <= range) n += 1 + i / s.lay.cells.length * .3; }); return n; }
function bestPad(s, range) { let best = null, bs = -1; for (let c = 0; c < D.COLS; c++) for (let r = 0; r < D.ROWS; r++) if (D.canPlace(s, c, r)) { const v = cover(s, c, r, range); if (v > bs) { bs = v; best = [c, r]; } } return best; }
function think(s, roster) {
  const counts = (h) => s.towers.filter(t => t.id === h.id).length;
  const hero = roster.reduce((a, h) => (counts(h) < counts(a) ? h : a), roster[0]);
  const pad = bestPad(s, D.ROLES[hero.role].range);
  if (pad && (s.towers.length < 4 || s.towers.every(t => t.lv >= 2)) && s.petals >= D.costFor(s, hero)) return D.place(s, hero, ...pad);
  const t = s.towers.filter(x => x.lv < 3).sort((a, b) => cover(s, b.c, b.r, D.towerStats(b).range) * b.power - cover(s, a.c, a.r, D.towerStats(a).range) * a.power)[0];
  if (t && s.petals >= D.upCost(t)) return D.upgrade(s, t.uid);
  if (pad && s.petals >= D.costFor(s, hero) && s.towers.length < 14) return D.place(s, hero, ...pad);
  return null;
}
function play(opts, roster) {
  const s = D.create(opts), seen = [];
  while (think(s, roster));
  D.callWave(s);
  for (let g = 0; !s.over && g < 60 * 60 * 20; g++) {
    if (g % 30 === 0) while (think(s, roster));
    D.step(s);
    for (const f of D.takeFx(s)) if (f.k === "wave" || f.k === "cleared") seen.push(f.k + f.n);
  }
  return { s, seen };
}
const NOVICE = [PUPA, { id: "jibjib", role: "attack", level: 5, rarity: 2 }, { id: "firefly", role: "support", level: 3, rarity: 1 }];
const STRONG = [{ id: "pupav2", role: "magic", level: 60, rarity: 5 }, { id: "ratri", role: "attack", level: 60, rarity: 5 }, { id: "chantra", role: "support", level: 60, rarity: 5 }, { id: "wayu", role: "defense", level: 60, rarity: 5 }, { id: "nilakan", role: "attack", level: 61, rarity: 6 }, { id: "arunee", role: "magic", level: 61, rarity: 6 }, { ...PUPA, level: 60 }];

test("defense: every map's path runs unbroken over the field to its tree", () => {
  assert.equal(D.MAPS.length, 5);
  assert.equal(D.STAGES.length, 15);
  for (const lay of D.LAYOUTS) {
    for (let i = 1; i < lay.cells.length; i++) {
      const [a, b] = [lay.cells[i - 1], lay.cells[i]];
      assert.equal(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 1, "next to each other");
    }
    for (const [c, r] of lay.cells) assert.ok(c >= 0 && r >= 0 && c < D.COLS && r < D.ROWS);
    assert.deepEqual(lay.cells.at(-1), lay.tree);
    assert.ok(!D.isPad(lay, ...lay.tree));
    const end = D.along(lay, lay.length);
    assert.deepEqual(end, [lay.tree[0] + .5, lay.tree[1] + .5]);
  }
});

test("defense: posting costs petals (more for each copy), training twice, selling gives back 70%", () => {
  const s = D.create({ stage: 1, seed: 2 });
  assert.equal(s.petals, D.START_PETALS);
  const [c, r] = [0, 0];
  assert.ok(D.isPad(s.lay, c, r));
  assert.equal(D.place(s, PUPA, 3, 1).error, "spot");      // on the path
  const a = D.place(s, PUPA, c, r).tower;
  assert.equal(s.petals, D.START_PETALS - 60);
  assert.equal(D.place(s, PUPA, c, r).error, "spot");      // taken
  assert.equal(D.costFor(s, PUPA), 72);                     // a second Pupa: +20%
  assert.equal(D.costFor(s, { id: "x", rarity: 6 }), 92);
  s.petals = 1000;
  assert.equal(D.upgrade(s, a.uid).k, "upgrade");
  assert.equal(D.upgrade(s, a.uid).k, "upgrade");
  assert.equal(D.upgrade(s, a.uid).error, "max");
  assert.equal(a.spent, 60 + 54 + 84);
  assert.ok(D.towerStats(a).dmg > D.ROLES.balance.dmg * 2);
  assert.equal(D.sell(s, a.uid).petals, Math.floor(198 * .7));
  assert.equal(s.towers.length, 0);
  s.petals = 10;
  assert.equal(D.place(s, PUPA, 0, 0).error, "petals");
  // a card's level and rarity make it stronger
  assert.ok(D.cardPower(60, 6) > 2.5 && D.cardPower(1, 2) === 1);
});

test("defense: what each role does", () => {
  const field = (role, extra = {}) => {
    const s = D.create({ stage: 1, seed: 3 });
    s.petals = 9999;
    const t = D.place(s, { id: role, role, level: 1, rarity: 2 }, 0, 0).tower;
    Object.assign(t, extra);
    return { s, t };
  };
  const foe = (s, d) => { s.wave = 1; s.enemies.push({ id: s.nextId++, kind: 0, art: "slime", hp: 999, maxHp: 999, speed: 0, petals: 1, hurts: 1, d, x: 0, y: 0, slowFor: 0, slow: 0, flash: 0, dead: false }); return s.enemies.at(-1); };
  // the ice hero slows everything in reach
  { const { s } = field("defense"); const e = foe(s, 1); D.step(s); D.step(s); D.step(s); D.step(s); D.step(s); D.step(s); D.step(s); D.step(s); D.step(s); D.step(s); D.step(s); D.step(s); D.step(s); assert.ok(e.slow > 0 && e.hp < 999); }
  // magic hits a ring of foes at once
  { const { s } = field("magic"); const a = foe(s, 1), b = foe(s, 1.4); for (let i = 0; i < 15; i++) D.step(s); assert.ok(a.hp < 999 && b.hp < 999); }
  // a star hero aims at the one furthest along
  { const { s } = field("balance"); const a = foe(s, .6), b = foe(s, 1.8); for (let i = 0; i < 15; i++) D.step(s); assert.ok(b.hp < 999 && a.hp === 999); }
  // the bell makes a neighbour hit harder
  const plain = field("attack", { cd: 5 });
  const withBell = field("attack", { cd: 5 });
  D.place(withBell.s, { id: "bell", role: "support", level: 1, rarity: 2 }, 1, 0).tower.cd = 99;
  for (const f of [plain, withBell]) { f.t.cd = 0; foe(f.s, 1); f.s.rand = () => .99; D.step(f.s); }
  assert.ok(withBell.s.enemies[0].hp < plain.s.enemies[0].hp);
});

test("defense: waves come, a cleared wave pays and starts a break, calling early pays the seconds left", () => {
  const s = D.create({ stage: 1, seed: 4 });
  assert.equal(s.breakLeft, -1);
  D.step(s);
  assert.equal(s.wave, 0, "nothing comes until called");
  assert.equal(D.callWave(s).k, "wave");
  assert.equal(s.wave, 1);
  assert.equal(s.spawning.length, 5);
  // no heroes: the wave walks through and takes hearts
  for (let i = 0; i < 60 * 40; i++) D.step(s);
  assert.equal(s.hearts, D.HEARTS - 5);
  assert.ok(s.breakLeft > 0);
  // calling now pays for the seconds left
  const before = s.petals, left = s.breakLeft;
  assert.equal(D.callWave(s).early, Math.floor(left * 2));
  assert.equal(s.petals, before + Math.floor(left * 2));
  // the last wave of a stage brings its boss
  assert.ok(D.waveOf(8, true).some(g => g[0] === "boss"));
  assert.ok(!D.waveOf(7, false).some(g => g[0] === "boss"));
});

test("defense: a sensible defender wins the first stages; the last one needs strong cards", () => {
  const first = play({ stage: 1, seed: 1 }, NOVICE);
  assert.ok(first.s.won);
  assert.equal(D.starsFor(first.s), 3);
  assert.deepEqual(first.seen.filter(x => x.startsWith("wave")), ["wave1", "wave2", "wave3", "wave4", "wave5", "wave6", "wave7", "wave8"]);
  assert.equal(first.seen.at(-1), "cleared8");
  assert.ok(!play({ stage: 15, seed: 1 }, NOVICE).s.won);
  const top = play({ stage: 15, seed: 1 }, STRONG);
  assert.ok(top.s.won);
  // standing by does not win
  const idle = D.create({ stage: 1, seed: 1 });
  D.callWave(idle);
  for (let i = 0; i < 60 * 600 && !idle.over; i++) D.step(idle);
  assert.ok(idle.over && !idle.won && D.starsFor(idle) === 0);
});

test("defense: endless waves keep coming every 28 s at the latest, a boss each fifth, until the tree falls", () => {
  const r = play({ endless: 0, seed: 1 }, NOVICE);
  assert.ok(r.s.over && !r.s.won);
  assert.ok(r.s.wave >= 10 && r.s.wave <= 40, `wave ${r.s.wave}`);
  assert.ok(r.s.t < 60 * 30);
});

test("defense: stars and rewards", () => {
  const s = D.create({ stage: 1 });
  assert.equal(D.starsFor(s), 0);
  s.won = true;
  s.hearts = 15; assert.equal(D.starsFor(s), 3);
  s.hearts = 14; assert.equal(D.starsFor(s), 2);
  s.hearts = 3; assert.equal(D.starsFor(s), 1);
  assert.deepEqual(D.rewardFor(1, true, 3, 0), { coins: 50, gems: 25, dust: 3, ore: 5 });
  assert.deepEqual(D.rewardFor(5, false, 2, 2), { coins: 45, gems: 0, dust: 0, ore: 0 });
  assert.deepEqual(D.endlessReward(12, 7), { coins: 144, gems: 5 });
  assert.deepEqual(D.endlessReward(9, 12), { coins: 108, gems: 0 });
});

test("merge: defense keeps the best stars and the most endless waves", () => {
  const device = (defense) => ({ best: 1, points: 1, coins: 0, plays: 1, wins: 0, cleared: [], shop: { owned: [], items: {}, petLevels: {}, bring: {} }, defense });
  const a = mergeSave(null, cleanSave(device({ stars: { 1: 3, 2: 1 }, endless: 14 })), 0);
  assert.deepEqual(a.defense, { stars: { 1: 3, 2: 1 }, endless: 14 });
  const b = mergeSave(a, cleanSave(device({ stars: { 2: 3, 3: 2 }, endless: 9 })), 0);
  assert.deepEqual(b.defense, { stars: { 1: 3, 2: 3, 3: 2 }, endless: 14 });
});

// The card battle rules (dist/cards-engine.js) run in Node too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const E = createRequire(import.meta.url)("../../dist/cards-engine.js");

function play(stage, lv, seed, ids, bonus = 0) {
  const team = ids ? ids.map(id => ({ id, lv, bonus })) : E.STARTER_TEAM.map(id => (id ? { id, lv } : null));
  if (!ids) { team[3] = { id: "pangji", lv }; team[4] = { id: "baitoey", lv }; }
  const b = E.createBattle({ team, stage, seed });
  for (let n = 0; b.phase !== "done" && n < 300; n++) {
    if (b.phase === "hero") E.heroTurn(b, E.autoQueue(b));
    else E.enemyTurn(b);
  }
  return b;
}

test("cards: every stage finishes, and a strong team wins it", () => {
  for (const stage of E.STAGES) {
    // from chapter 3 on it takes a levelled team of rarer cards; a hard
    // stage may need a few tries, as in play
    const strong = ["thongkham", "phloeng", "chantra", "mekha", "pupav2"];
    // chapter 5 needs raised stars: level 50 with two stars
    const tries = [1, 2, 3, 4, 5].map(n => (stage.num > 80 ? play(stage, 80, stage.num * 31 + n, ["thongkham", "phloeng", "chantra", "asani", "pupav2"], 5 * E.AWAKE_BONUS) : stage.num > 60 ? play(stage, 80, stage.num * 31 + n, strong, 5 * E.AWAKE_BONUS) : stage.num > 50 ? play(stage, 75, stage.num * 31 + n, strong, 4 * E.AWAKE_BONUS) : stage.num > 40 ? play(stage, 50, stage.num * 31 + n, strong, 2 * E.AWAKE_BONUS) : stage.num > 20 ? play(stage, 30, stage.num * 31 + n, strong) : play(stage, 20, stage.num + n)));
    const b = tries.find(t => t.result === "won");
    assert.ok(b, `stage ${stage.num}`);
    assert.ok(tries.every(t => t.phase === "done"));
    assert.ok(E.starsFor(b, stage) >= 1);
  }
});

test("cards: the same seed gives the same battle", () => {
  const a = play(E.STAGES[9], 6, 42), b = play(E.STAGES[9], 6, 42);
  assert.equal(a.result, b.result);
  assert.equal(a.turn, b.turn);
  assert.deepEqual(a.heroes.map(u => u?.hp), b.heroes.map(u => u?.hp));
});

test("cards: skills wait out their cooldown and stunned heroes skip", () => {
  const b = E.createBattle({ team: [{ id: "pupa", lv: 30 }, null, null, null, null], stage: E.STAGES[19], seed: 3 });
  b.phase = "hero";
  E.heroTurn(b, [{ i: 0, s: 0 }]);
  assert.equal(b.heroes[0].skills[0].cool, E.CARDS.pupa.skills[0].cd - 1);
  b.phase = "hero";
  b.heroes[0].status.push({ k: "stun", turns: 1, v: 0 });
  const events = E.heroTurn(b, []);
  assert.ok(events.some(ev => ev.t === "skip" && ev.i === 0));
  assert.ok(E.describe(E.CARDS.ikuya.skills[1]).includes("ลดเกราะ"));
});

test("cards: XP raises levels, the hunt is capped, the arena fields ten", () => {
  const cards = { units: { pupa: 1 }, xp: {} };
  assert.equal(E.giveXp(cards, "pupa", E.xpNeed(1) + E.xpNeed(2) + 5), 2);
  assert.equal(cards.units.pupa, 3);
  assert.equal(cards.xp.pupa, 5);
  assert.deepEqual(E.idleReward(5, 20 * 3600000), E.idleReward(5, E.IDLE_HOURS * 3600000));
  const many = { units: Object.fromEntries(E.CARD_IDS.map(id => [id, 20])), outfit: {} };
  const team = E.arenaTeam(many);
  assert.equal(team.length, 10);
  const b = E.createBattle({ team, stage: E.arenaTier(3), seed: 9 });
  assert.equal(b.foes.length, 10);
  for (let n = 0; b.phase !== "done" && n < 300; n++) {
    if (b.phase === "hero") E.heroTurn(b, E.autoQueue(b)); else E.enemyTurn(b);
  }
  assert.equal(b.result, "won");
});

test("cards: daily dungeons can be won at the furthest stage's level", () => {
  for (const kind of ["exp", "coin"]) {
    const stage = E.dungeon(kind, 8);
    assert.equal(stage.lv, E.STAGES[7].lv);
    let wins = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const team = ["pangji", "ikuya", "pupav2", "dragon", "baitoey"].map(id => ({ id, lv: 8 }));
      const b = E.createBattle({ team, stage, seed });
      for (let n = 0; b.phase !== "done" && n < 300; n++) { if (b.phase === "hero") E.heroTurn(b, E.autoQueue(b)); else E.enemyTurn(b); }
      wins += b.result === "won";
    }
    assert.ok(wins >= 7, `${kind} won ${wins}/10`);
  }
});

test("cards: red stars raise the level cap, cost shards or star dust plus wings, and stop at five", () => {
  const cards = { units: { ikuya: 30 }, xp: {}, awake: {}, shards: { ikuya: 4 }, dust: 6, wings: 0 };
  assert.equal(E.giveXp(cards, "ikuya", 100000), 0); // capped at 30 without stars
  assert.equal(E.awaken(cards, "ikuya", 100), null); // not enough coins
  assert.equal(E.awaken(cards, "ikuya", 1000), null); // no wings
  cards.wings = 1;
  assert.equal(E.awaken(cards, "ikuya", 1000), 700); // 4 shards + 6 dust + 1 wing + 300 coins
  assert.equal(cards.awake.ikuya, 1);
  assert.equal(cards.shards.ikuya, 0);
  assert.equal(cards.dust, 0);
  assert.equal(cards.wings, 0);
  cards.wings = 1000;
  assert.ok(E.giveXp(cards, "ikuya", 100000) > 0);
  assert.ok(cards.units.ikuya <= E.capFor(1));
  assert.equal(E.awaken(cards, "ikuya", 1e9), null); // no shards left
  cards.shards.ikuya = 1000;
  for (let n = 1; n < E.MAX_AWAKE; n++) assert.notEqual(E.awaken(cards, "ikuya", 1e9), null);
  assert.equal(cards.awake.ikuya, E.MAX_AWAKE);
  assert.equal(E.awakeCost(cards, "ikuya"), null);
  assert.equal(E.cardBonus(cards, "ikuya"), E.MAX_AWAKE * E.AWAKE_BONUS);
});

test("cards: six grades from D to SSS, SSS the rarest pull", () => {
  assert.deepEqual(Object.values(E.GRADES), ["D", "C", "B", "A", "S", "SSS"]);
  assert.ok(E.CARD_IDS.every(id => E.GRADES[E.CARDS[id].rarity]));
  assert.deepEqual(E.CARD_IDS.filter(id => E.CARDS[id].rarity === 6).sort(), ["asani", "phoenix", "seraphina"]);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const state = { pity: 0 }, count = {};
  const got = E.pull(state, rnd, 20000);
  for (const id of got) count[E.CARDS[id].rarity] = (count[E.CARDS[id].rarity] || 0) + 1;
  for (let r = 1; r < 6; r++) assert.ok(count[r] > count[6], `grade ${r}`);
  // ten pulls always hold a B or better
  for (let n = 0; n < 50; n++) assert.ok(E.pull({ pity: 0 }, rnd, 10).some(id => E.CARDS[id].rarity >= 3));
  // pity: the 50th pull without an S is S or SSS
  const p = { pity: E.GACHA.pity - 1 };
  assert.ok(E.CARDS[E.pull(p, () => .99, 1)[0]].rarity >= 5);
  assert.equal(p.pity, 0);
  // the 100th pull without an SSS is SSS, and both counters start again
  const p6 = { pity: 3, pity6: E.GACHA.pity6 - 1 };
  assert.equal(E.CARDS[E.pull(p6, () => .99, 1)[0]].rarity, 6);
  assert.deepEqual([p6.pity, p6.pity6], [0, 0]);
  // 100 pulls of bad luck still hold an SSS
  assert.ok(E.pull({ pity: 0, pity6: 0 }, () => .99, 100).some(id => E.CARDS[id].rarity === 6));
});

test("cards: every five stages at full stars give the star bonus once", () => {
  const stars = {};
  for (let n = 1; n <= 5; n++) stars[n] = 3;
  for (let n = 6; n <= 10; n++) stars[n] = n === 10 ? 2 : 3;
  assert.deepEqual(E.dueStarBonus(stars, []), [1]);
  assert.deepEqual(E.dueStarBonus(stars, [1]), []);
  stars[10] = 3;
  assert.deepEqual(E.dueStarBonus(stars, [1]), [2]);
  assert.equal(E.groupStars(stars, 2), 15);
  assert.equal(E.starGroups().length, Math.ceil(E.STAGES.length / 5));
});

test("cards: wings owed for boss stages and arena floors cleared before wings", () => {
  const stars = {};
  for (let n = 1; n <= 10; n++) stars[n] = 1;
  const bosses = E.STAGES.filter(s => s.num <= 10 && s.wings).length;
  assert.ok(bosses >= 2);
  assert.equal(E.wingCompensation(stars, 1), bosses * 2);
  assert.equal(E.wingCompensation({}, 12), 4); // floors 5 and 10
  assert.equal(E.wingCompensation({}, 1), 0);
});

test("cards: daily quests renew each day, achievements read the save", () => {
  const q = E.questFor(null, "2026-10-13");
  q.counts.win = 3;
  assert.ok(E.questDone(q, E.DAILY_QUESTS.find(d => d.id === "win3")));
  assert.equal(E.questFor(q, "2026-10-13"), q);
  assert.deepEqual(E.questFor(q, "2026-10-14").counts, {});
  const c = { stars: { 1: 3, 10: 2 }, units: { pupa: 1 }, awake: {}, arena: 11 };
  const get = (id) => E.achvProgress(c, E.ACHIEVEMENTS.find(a => a.id === id));
  assert.deepEqual(get("stage10"), [10, 10, true]);
  assert.deepEqual(get("arena10"), [10, 10, true]);
  assert.equal(get("cards5")[2], false);
});

// The card battle rules (dist/cards-engine.js) run in Node too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const E = createRequire(import.meta.url)("../../dist/cards-engine.js");

function play(stage, lv, seed) {
  const team = E.STARTER_TEAM.map(id => (id ? { id, lv } : null));
  team[3] = { id: "pangji", lv }; team[4] = { id: "baitoey", lv };
  const b = E.createBattle({ team, stage, seed });
  for (let n = 0; b.phase !== "done" && n < 300; n++) {
    if (b.phase === "hero") E.heroTurn(b, E.autoQueue(b));
    else E.enemyTurn(b);
  }
  return b;
}

test("cards: every stage finishes, and a strong team wins it", () => {
  for (const stage of E.STAGES) {
    const b = play(stage, 20, stage.num);
    assert.equal(b.result, "won", `stage ${stage.num}`);
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

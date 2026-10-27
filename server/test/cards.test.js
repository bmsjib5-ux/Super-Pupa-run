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
    const tries = [1, 2, 3, 4, 5].map(n => (stage.num > 150 ? play(stage, 130, stage.num * 31 + n, ["thongkham", "phloeng", "chantra", "asani", "pupav2"], E.awakeBonus(10)) : stage.num > 140 ? play(stage, 130, stage.num * 31 + n, ["thongkham", "phloeng", "chantra", "asani", "pupav2"], E.awakeBonus(10)) : stage.num > 130 ? play(stage, 130, stage.num * 31 + n, ["thongkham", "phloeng", "chantra", "asani", "pupav2"], E.awakeBonus(10)) : stage.num > 120 ? play(stage, 120, stage.num * 31 + n, ["thongkham", "phloeng", "chantra", "asani", "pupav2"], E.awakeBonus(9)) : stage.num > 110 ? play(stage, 110, stage.num * 31 + n, ["thongkham", "phloeng", "chantra", "asani", "pupav2"], E.awakeBonus(8)) : stage.num > 80 ? play(stage, 80, stage.num * 31 + n, ["thongkham", "phloeng", "chantra", "asani", "pupav2"], 5 * E.AWAKE_BONUS) : stage.num > 60 ? play(stage, 80, stage.num * 31 + n, strong, 5 * E.AWAKE_BONUS) : stage.num > 50 ? play(stage, 75, stage.num * 31 + n, strong, 4 * E.AWAKE_BONUS) : stage.num > 40 ? play(stage, 50, stage.num * 31 + n, strong, 2 * E.AWAKE_BONUS) : stage.num > 20 ? play(stage, 30, stage.num * 31 + n, strong) : play(stage, 20, stage.num + n)));
    const b = tries.find(t => t.result === "won");
    assert.ok(b, `stage ${stage.num}`);
    assert.ok(tries.every(t => t.phase === "done"));
    assert.ok(E.starsFor(b, stage) >= 1);
  }
});

test("cards: a boss stage's third star allows ten turns", () => {
  const bosses = E.STAGES.filter(stage => stage.boss);
  assert.ok(bosses.length > 0);
  for (const stage of bosses) assert.ok(stage.par >= E.BOSS_PAR && E.BOSS_PAR === 10, `stage ${stage.num}`);
  // the turn limit only grows from chapter to chapter
  for (const stage of E.STAGES.filter(stage => !stage.boss)) {
    assert.equal(stage.par, E.parFor(stage.num, stage.waves.length, false));
    assert.ok(stage.par >= stage.waves.length * 2 + 2);
  }
  assert.ok(E.STAGES[159].par > E.STAGES[0].par + 20);
  // nine turns on a boss stage still earns the star
  const stage = bosses[0];
  assert.equal(E.starsFor({ result: "won", turn: 9, heroes: [{ alive: true }] }, stage), 3);
  assert.equal(E.starsFor({ result: "won", turn: 11, heroes: [{ alive: true }] }, stage), 2);
});

test("cards: each stage recommends three cards, and fielding them raises the team's attack", () => {
  for (const stage of [...E.STAGES, E.towerFloor(1), E.towerFloor(150)]) {
    const favs = E.favsOf(stage);
    assert.equal(new Set(favs).size, 3, `stage ${stage.num}`);
    // one of D to B, one A, one S or SSS
    assert.deepEqual(favs.map(id => E.CARDS[id].rarity).map(r => (r <= 3 ? 0 : r === 4 ? 1 : 2)), [0, 1, 2]);
    assert.deepEqual(E.favsOf(stage), favs);
  }
  assert.notDeepEqual(E.favsOf(E.STAGES[0]), E.favsOf(E.STAGES[1]));
  assert.deepEqual(E.favsOf(E.arenaTier(3)), []);
  const stage = E.STAGES[9], favs = E.favsOf(stage);
  const others = E.CARD_IDS.filter(id => !favs.includes(id)).slice(0, 5);
  const field = (ids) => E.createBattle({ team: ids.map(id => ({ id, lv: 20 })), stage, seed: 3 });
  const plain = field(others);
  assert.equal(plain.favs.atk, 0);
  // two recommended cards in: +20% attack for everyone
  const withTwo = field([favs[0], favs[1], ...others.slice(0, 3)]);
  assert.equal(withTwo.favs.atk, 2 * E.FAV_ATK);
  const lone = E.createBattle({ team: [{ id: others[0], lv: 20 }], stage, seed: 3 }).heroes[0];
  const helped = withTwo.heroes.find(u => u?.id === others[0]);
  assert.equal(helped.atk, Math.round(lone.atk * (1 + 2 * E.FAV_ATK)));
});

test("cards: story monsters have less health from chapter 2 on, the tower's do not", () => {
  const field = (stage) => E.createBattle({ team: [{ id: "pupa", lv: 30 }], stage, seed: 1 }).foes[0];
  const late = E.STAGES[40], floor = E.towerFloor(41);
  assert.equal(E.STAGES[3].ease, 1);
  assert.equal(late.ease, E.FOE_EASE);
  const foe = field(late), tower = field(floor);
  const plain = E.createBattle({ team: [{ id: "pupa", lv: 30 }], stage: { ...late, ease: 1 }, seed: 1 }).foes[0];
  assert.equal(foe.maxHp, Math.round(plain.maxHp * E.FOE_EASE));
  assert.ok(!floor.ease && tower.maxHp > 0);
});

test("cards: a team that can win a stage gets three stars most of the time", () => {
  const strong = ["thongkham", "phloeng", "chantra", "mekha", "pupav2"], top = ["thongkham", "phloeng", "chantra", "asani", "pupav2"];
  const setup = (n) => n > 130 ? [130, top, E.awakeBonus(10)] : n > 120 ? [120, top, E.awakeBonus(9)] : n > 110 ? [110, top, E.awakeBonus(8)] : n > 80 ? [80, top, 5 * E.AWAKE_BONUS] : n > 60 ? [80, strong, 5 * E.AWAKE_BONUS] : n > 50 ? [75, strong, 4 * E.AWAKE_BONUS] : n > 40 ? [50, strong, 2 * E.AWAKE_BONUS] : n > 20 ? [30, strong, 0] : [20, null, 0];
  for (let ch = 0; ch < E.STAGES.length / 10; ch++) {
    let three = 0, runs = 0;
    for (const stage of E.STAGES.slice(ch * 10, ch * 10 + 10)) {
      const [lv, ids, bonus] = setup(stage.num);
      for (let s = 1; s <= 4; s++) { runs++; if (E.starsFor(play(stage, lv, stage.num * 53 + s, ids, bonus), stage) === 3) three++; }
    }
    assert.ok(three / runs >= .6, `chapter ${ch + 1}: three stars in ${three} of ${runs}`);
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

test("cards: the dragon raid can't be won, rises stronger, and pays coins in proportion to its score", () => {
  const stage = E.raid(60);
  assert.equal(stage.lv, E.STAGES[59].lv);
  assert.ok(stage.raid && stage.time === E.RAID_TIME && stage.hp > 0 && stage.rate > 0);
  // the first stages are too few monsters: the dragon starts at stage 5's
  assert.deepEqual(E.raid(0), E.raid(5));
  const team = ["thongkham", "phloeng", "chantra", "asani", "pupav2"].map(id => ({ id, lv: 70, bonus: E.awakeBonus(4) }));
  const b = E.createBattle({ team, stage, seed: 3 });
  assert.equal(b.foes.length, 1);
  assert.equal(b.foes[0].maxHp, stage.hp);
  const atk = b.foes[0].atk;
  let dealt = 0, rose = 0;
  for (let n = 0; n < 60 && b.phase !== "done"; n++) {
    const events = b.phase === "hero" ? E.heroTurn(b, E.autoQueue(b)) : E.enemyTurn(b);
    for (const ev of events) {
      if (ev.side === "foe" && (ev.t === "hit" || ev.t === "burn")) dealt += ev.v;
      if (ev.t === "rise") { rose++; assert.equal(ev.n, rose + 1); assert.equal(ev.u.hp, ev.u.maxHp); }
    }
  }
  // past the turn limit of a stage, never won; each fall a new phase, harder
  assert.notEqual(b.result, "won");
  assert.ok(rose >= 1 && b.raid.phase === rose + 1, `rose ${rose}`);
  assert.ok(b.foes[0].atk > atk && b.foes[0].maxHp > stage.hp);
  assert.equal(b.raid.dealt, dealt);
  // coins: a share of the score
  assert.equal(E.raidCoins(stage, 0), 0);
  assert.ok(Math.abs(E.raidCoins(stage, 20000) - 2 * E.raidCoins(stage, 10000)) <= 1);
  assert.equal(E.raidCoins(stage, stage.hp), Math.floor(stage.hp * stage.rate));
});

test("cards: a team ready for its furthest stage breaks about two of the dragon's phases in a raid's turns", () => {
  // levels that just win stages 20, 60 and 130 (see the stage tests);
  // fourteen turns is about the raid's sixty seconds at its pace
  for (const [best, lv] of [[20, 5], [60, 54], [130, 108]]) {
    const stage = E.raid(best), coinVault = E.dungeon("coin", best).coins;
    let phases = 0, coins = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const team = ["thongkham", "phloeng", "chantra", "asani", "pupav2"].map(id => ({ id, lv, bonus: E.awakeBonus(Math.max(0, Math.ceil((lv - 30) / 10))) }));
      const b = E.createBattle({ team, stage, seed });
      while (b.turn < 14 && b.phase !== "done") { if (b.phase === "hero") E.heroTurn(b, E.autoQueue(b)); else E.enemyTurn(b); }
      phases += b.raid.dealt / stage.hp / 6;
      coins += E.raidCoins(stage, b.raid.dealt) / 6;
    }
    assert.ok(phases > 1.3 && phases < 3.5, `stage ${best}: ${phases.toFixed(2)} phases`);
    assert.ok(coins > coinVault * .7 && coins < coinVault * 2, `stage ${best}: ${Math.round(coins)} coins, the vault ${coinVault}`);
  }
});

test("cards: a ranked raid replays to the page's score, and never past the clock", () => {
  const cards = { team: ["thongkham", "phloeng", "", "asani", "pupav2"], units: { thongkham: 70, phloeng: 70, asani: 70, pupav2: 70, chantra: 70 }, awake: { thongkham: 4, phloeng: 4, asani: 4, pupav2: 4 } };
  const team = E.fielded(cards);
  assert.equal(team[2], null);
  assert.ok(team[0].lv === 70 && team[0].bonus > 0 && team[0].gear);
  const stage = E.raid(E.bestStageOf({ 1: 3, 2: 1, 60: 2, 61: 0 }));
  assert.equal(stage.lv, E.STAGES[59].lv);
  // play it as the page does: auto turns recorded, the clock at the raid's pace
  const play = (seed, stopAt = Infinity) => {
    const b = E.createBattle({ team, stage, seed });
    const turns = [];
    let clock = 0, shown = 0, score = 0;
    outer: while (b.phase !== "done") {
      let events;
      if (b.phase === "hero") { const q = E.autoQueue(b); turns.push({ q, f: b.focus }); events = E.heroTurn(b, q, b.focus); }
      else events = E.enemyTurn(b);
      for (const ev of events) {
        if (clock >= E.RAID_TIME * 1000 || shown >= stopAt) break outer;
        shown++;
        if (ev.side === "foe" && (ev.t === "hit" || ev.t === "burn")) score += ev.v;
        clock += E.eventTime(b, ev, E.RAID_PACE);
      }
    }
    return { turns, shown, score };
  };
  for (const seed of [5, 6]) {
    const run = play(seed);
    assert.ok(run.score > 0 && run.turns.length > 5);
    assert.equal(E.raidReplay({ team, stage, seed, turns: run.turns, shown: run.shown }).score, run.score);
    // claiming more shown than the clock allows changes nothing
    assert.equal(E.raidReplay({ team, stage, seed, turns: run.turns, shown: 1e9 }).score, run.score);
    // a page that showed less (a player choosing skills) scores less
    const part = play(seed, Math.floor(run.shown / 2));
    assert.equal(E.raidReplay({ team, stage, seed, turns: part.turns, shown: part.shown }).score, part.score);
    assert.ok(part.score < run.score);
    // another seed is another battle
    assert.notEqual(E.raidReplay({ team, stage, seed: seed + 100, turns: run.turns, shown: run.shown }).score, run.score);
  }
  // the pumpkin dragon only looks different
  const run = play(9), pumpkin = E.raid(60, { pumpkin: true });
  assert.equal(pumpkin.waves[0][0].id, "pumpkindragon");
  assert.equal(E.raidReplay({ team, stage: pumpkin, seed: 9, turns: run.turns, shown: run.shown }).score, run.score);
  // a cut-in holds the clock: a hero's second skill, a boss's skill
  const b = E.createBattle({ team, stage, seed: 1 });
  assert.ok(E.eventTime(b, { t: "act", side: "hero", i: 0, s: 1 }) > E.eventTime(b, { t: "act", side: "hero", i: 0, s: 0 }));
  assert.ok(E.eventTime(b, { t: "act", side: "foe", i: 0, s: 0 }) > E.eventTime(b, { t: "act", side: "foe", i: 0, s: -1 }));
  assert.equal(E.eventTime(b, { t: "hit", crit: true }, .5), (E.EVENT_DELAY.hit + E.CRIT_DELAY) * .5);
});

test("cards: Halloween drops candy for a while, and the shop takes it", () => {
  const H = E.HALLOWEEN;
  assert.ok(E.halloweenOn(H.from) && E.halloweenOn(H.to) && !E.halloweenOn("2026-10-26") && !E.halloweenOn("2026-11-04"));
  assert.ok(E.halloweenShopOpen(H.shop) && !E.halloweenShopOpen("2026-11-06"));
  assert.equal(E.winCandy({ boss: true }), H.boss);
  assert.equal(E.winCandy({ boss: false }), H.win);
  const stage = E.raid(40);
  assert.equal(E.raidCandy(stage, stage.hp * 2), 2 * H.raidPerPhase);
  // candy left: earned less what the shop took
  const card = E.HALLOWEEN_SHOP.find(item => item.key === "card"), ore = E.HALLOWEEN_SHOP.find(item => item.key === "ore");
  assert.equal(E.candyLeft({ earned: 1000, bought: { card: 1, ore: 2 } }), 1000 - card.price - 2 * ore.price);
  assert.equal(E.candyLeft({ earned: 10, bought: { card: 1 } }), 0);
  assert.equal(E.candyLeft(null), 0);
  // the featured card is a real one; every offer has a price and a limit
  assert.ok(E.CARDS[H.card]);
  for (const item of E.HALLOWEEN_SHOP) assert.ok(item.price > 0 && item.limit > 0 && Object.keys(item.give).length === 1, item.key);
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
  cards.units.ikuya = E.capFor(1) - 1;
  assert.equal(E.awaken(cards, "ikuya", 1e9), null); // not at the level cap yet
  assert.equal(E.awakeCost(cards, "ikuya").lvNeed, E.capFor(1));
  for (let n = 1; n < E.MAX_AWAKE; n++) { cards.units.ikuya = E.capFor(n); assert.notEqual(E.awaken(cards, "ikuya", 1e9), null); }
  assert.equal(cards.awake.ikuya, E.MAX_AWAKE);
  assert.equal(E.awakeCost(cards, "ikuya"), null); // ikuya is an A card: no second awakening
  assert.equal(E.cardBonus(cards, "ikuya"), E.MAX_AWAKE * E.AWAKE_BONUS);
});

test("cards: S and SSS cards awaken a second time, five gold stars to Lv 130", () => {
  const cards = { units: { phloeng: 80 }, xp: {}, awake: { phloeng: 5 }, shards: { phloeng: 10000 }, dust: 0, wings: 1000 };
  assert.equal(E.maxAwake("phloeng"), 10);
  assert.equal(E.maxAwake("pupa"), 5);
  assert.equal(E.awakeCost(cards, "phloeng").second, true);
  for (let n = 5; n < 10; n++) { cards.units.phloeng = E.capFor(n); assert.notEqual(E.awaken(cards, "phloeng", 1e9), null); }
  assert.equal(cards.awake.phloeng, 10);
  assert.equal(E.capFor(10), 130);
  assert.equal(E.awakeCost(cards, "phloeng"), null);
  assert.ok(Math.abs(E.cardBonus(cards, "phloeng") - (5 * E.AWAKE_BONUS + 5 * E.AWAKE2_BONUS)) < 1e-9);
  E.giveXp(cards, "phloeng", 1e9);
  assert.equal(cards.units.phloeng, 130);
});

test("cards: six grades from D to SSS, SSS the rarest pull", () => {
  assert.deepEqual(Object.values(E.GRADES), ["D", "C", "B", "A", "S", "SSS"]);
  assert.ok(E.CARD_IDS.every(id => E.GRADES[E.CARDS[id].rarity]));
  assert.deepEqual(E.CARD_IDS.filter(id => E.CARDS[id].rarity === 6).sort(), ["arunee", "asani", "naphalai", "nilakan", "phoenix", "qilin", "seraphina", "vajira"]);
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

test("cards: the arena fields the player's own ten when chosen", () => {
  const cards = { units: { pupa: 10, ikuya: 20, phloeng: 30, kitten: 5 }, awake: {}, outfit: {}, arenaPick: ["kitten", "pupa", "ghost"], arenaFront: ["kitten", "ikuya"] };
  const team = E.arenaTeam(cards);
  assert.deepEqual(team.map(t => t.id), ["kitten", "pupa"]);
  assert.deepEqual(team.map(t => t.row), ["front", "back"]);
  assert.equal(E.arenaTeam({ ...cards, arenaPick: [] }).length, 4); // automatic: every card
});

test("cards: the tower has 150 floors, a boss on each and a great one every tenth", () => {
  assert.equal(E.TOWER_FLOORS, 150);
  for (let n = 1; n <= E.TOWER_FLOORS; n++) {
    const f = E.towerFloor(n);
    assert.ok(E.FOES[f.waves[0][0].id].boss, `floor ${n}`);
    assert.ok(f.waves[0].every(u => E.FOES[u.id]), `floor ${n} foes`);
    // the upper tower: each ten floors a zone with monsters of its own,
    // painted, not recoloured, and no two of the same guard on a floor
    if (n > 100) {
      const zone = E.TOWER_ZONES[Math.ceil(n / 10) - 11];
      const own = [...Object.keys(zone.guards), zone.lord[0], zone.queen[0], zone.great];
      assert.equal(f.zone, zone.name);
      assert.ok(f.waves[0].every(u => own.includes(u.id) && !E.FOES[u.id].look), `floor ${n} zone foes`);
      assert.equal(new Set(f.waves[0].map(u => u.id)).size, f.waves[0].length, `floor ${n} repeats`);
    }
  }
  assert.equal(E.towerFloor(30).waves[0][0].id, "golemboss");
  assert.equal(E.STAGES[29].waves[2][0].id, "golemboss"); // chapter 3 ends at the lava golem
  assert.deepEqual([110, 120, 130, 140, 150].map(n => E.towerFloor(n).waves[0][0].id), ["runedragon", "phantomknight", "chimera", "clocktitan", "towersovereign"]);
  assert.ok(E.towerFloor(150).lv > E.towerFloor(101).lv);
  // no zone shares a monster with another
  const all = E.TOWER_ZONES.flatMap(z => [...Object.keys(z.guards), z.lord[0], z.queen[0], z.great]);
  assert.equal(new Set(all).size, all.length);
});

test("cards: the upper tower can be climbed by a team of its chapters' strength", () => {
  const ids = ["thongkham", "phloeng", "chantra", "asani", "pupav2"];
  for (let n = 101; n <= E.TOWER_FLOORS; n++) {
    const [lv, aw] = n > 130 ? [130, 10] : n > 120 ? [120, 9] : n > 110 ? [110, 8] : [80, 5];
    const tries = [1, 2, 3, 4, 5].map(k => play(E.towerFloor(n), lv, n * 31 + k, ids, E.awakeBonus(aw)));
    assert.ok(tries.some(t => t.result === "won"), `floor ${n}`);
  }
});

test("cards: gear is enhanced to its tier's cap, reforged, and adds to the card in battle", () => {
  const c = { units: { chantra: 40 }, ore: 1000, dust: 50, gear: {} };
  let coins = 100000;
  for (let k = 0; k < E.GEAR_STEP; k++) coins = E.enhanceGear(c, "chantra", 0, coins);
  assert.deepEqual(E.gearOf(c, "chantra", 0), { tier: 1, lv: E.GEAR_STEP, cap: E.GEAR_STEP });
  assert.equal(E.enhanceGear(c, "chantra", 0, coins), null); // at the cap: reforge first
  coins = E.reforgeGear(c, "chantra", 0, coins);
  assert.deepEqual(E.gearOf(c, "chantra", 0), { tier: 2, lv: E.GEAR_STEP, cap: 2 * E.GEAR_STEP });
  assert.equal(E.enhanceGear(c, "pangji", 0, coins), null); // a card not owned
  assert.equal(E.enhanceGear({ ...c, ore: 0 }, "chantra", 0, coins), null); // no ore
  const gear = E.gearBonus(c, "chantra");
  assert.ok(gear.atk > 0 && gear.hp === 0);
  // eight pieces; some give two stats (gloves: attack and critical)
  assert.equal(E.GEAR_SLOTS.length, 8);
  const gloves = E.GEAR_SLOTS.findIndex(slot => slot.key === "gloves");
  c.gear[E.gearKey("chantra", gloves)] = 110;
  const both = E.gearBonus(c, "chantra");
  assert.ok(both.atk > gear.atk && both.crit > gear.crit);
  const stage = E.STAGES[0];
  const plain = E.createBattle({ team: [{ id: "chantra", lv: 40 }], stage, seed: 1 });
  const geared = E.createBattle({ team: [{ id: "chantra", lv: 40, gear }], stage, seed: 1 });
  assert.equal(geared.heroes[0].atk, Math.round(plain.heroes[0].atk * (1 + gear.atk) / 1));
  assert.ok(E.cardPower(c, "chantra") > E.power("chantra", 40));
});

test("cards: items drop with random stats, are worn one a slot and broken down into ore", () => {
  let seed = 11;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 200; k++) {
    const item = E.rollItem(rnd, 1);
    assert.ok(item.s >= 0 && item.s < E.GEAR_SLOTS.length && item.r >= 1 && item.r <= 5 && item.m >= 0 && item.m <= 100);
    assert.equal(item.x.length, item.r - 1); // rarer items have more extra stats
    assert.equal(new Set(item.x.map(x => Math.floor(x / 1000))).size, item.x.length); // no stat twice
  }
  assert.ok(E.rollItem(rnd, 0, 4).r >= 4); // a floor for bosses
  // luck makes rare items more common
  const rare = (luck) => { let n = 0; for (let k = 0; k < 2000; k++) if (E.rollItem(rnd, luck).r >= 4) n++; return n; };
  assert.ok(rare(2) > rare(0) * 2);
  const c = { units: { pupa: 10, jibjib: 10 }, ore: 0, items: [
    { i: "a", s: 0, r: 5, m: 100, x: [1100], o: "" }, { i: "b", s: 0, r: 1, m: 0, x: [], o: "" }, { i: "c", s: 3, r: 2, m: 50, x: [4050], o: "" }
  ] };
  assert.ok(E.itemScore(c.items[0]) > E.itemScore(c.items[1]));
  assert.ok(E.equipItem(c, "a", "pupa"));
  assert.ok(E.gearBonus(c, "pupa").atk > 0);
  assert.ok(E.equipItem(c, "b", "pupa")); // the same slot: "a" comes off
  assert.deepEqual(c.items.map(it => it.o), ["", "pupa", ""]);
  assert.ok(E.equipItem(c, "b", "jibjib")); // worn by another card: it moves
  assert.deepEqual(c.items.map(it => it.o), ["", "jibjib", ""]);
  assert.equal(E.equipItem(c, "a", "pangji"), false); // not owned
  assert.equal(E.salvageItems(c, ["a", "b", "c"]), E.SALVAGE_ORE[4] + E.SALVAGE_ORE[1]); // the worn one stays
  assert.deepEqual(c.items.map(it => it.i), ["b"]);
  assert.equal(c.ore, E.SALVAGE_ORE[4] + E.SALVAGE_ORE[1]);
});

test("cards: item pulls follow their odds, with a legendary within the pity and a rare in ten", () => {
  let seed = 21;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const state = { pity: 0 };
  let gap = 0, longest = 0;
  for (let k = 0; k < 3000; k++) {
    const [item] = E.pullItems(state, rnd, 1);
    assert.equal(item.x.length, item.r - 1);
    gap = item.r === 5 ? 0 : gap + 1;
    longest = Math.max(longest, gap);
  }
  assert.ok(longest < E.ITEM_GACHA.pity);
  for (let k = 0; k < 200; k++) assert.ok(E.pullItems({ pity: 0 }, rnd, 10).some(item => item.r >= 3));
  const near = { pity: E.ITEM_GACHA.pity - 1 };
  assert.equal(E.pullItems(near, rnd, 1)[0].r, 5);
  assert.equal(near.pity, 0);
});

test("cards: bonds raise the attack of members fielded together", () => {
  const stage = E.STAGES[0];
  const solo = E.createBattle({ team: [{ id: "chada", lv: 10 }, { id: "pupa", lv: 10 }], stage, seed: 1 });
  const pair = E.createBattle({ team: [{ id: "chada", lv: 10 }, { id: "anchan", lv: 10 }], stage, seed: 1 });
  assert.deepEqual(solo.bonds, []);
  assert.deepEqual(pair.bonds.map(b => b.id), ["samurai"]);
  assert.equal(pair.heroes[0].atk, Math.round(solo.heroes[0].atk * 1.15));
  // a card in two active bonds gets both
  assert.ok(Math.abs(E.bondAtk(["chada", "anchan", "ikuya"], "chada") - .25) < 1e-9);
  for (const bond of E.BONDS) for (const id of bond.ids) assert.ok(E.CARDS[id], `${bond.id}: ${id}`);
});

test("cards: team power counts bond bonuses", () => {
  const pair = [{ id: "chada", lv: 10 }, { id: "anchan", lv: 10 }];
  const plain = E.power("chada", 10) + E.power("anchan", 10);
  assert.ok(E.teamPowerOf(pair) > plain);
  assert.equal(E.teamPowerOf([{ id: "chada", lv: 10 }, { id: "pupa", lv: 10 }]), E.power("chada", 10) + E.power("pupa", 10));
});

test("cards: the light and dark knights bond", () => {
  assert.deepEqual(E.activeBonds(["nilakan", "arunee"]).map(b => b.id), ["lightdark"]);
  assert.ok(Math.abs(E.bondAtk(["nilakan", "arunee"], "arunee") - .18) < 1e-9);
});

test("cards: the night and light orders bond with their leaders", () => {
  assert.deepEqual(E.activeBonds(["nilakan", "kalawit", "thamin"]).map(b => b.id), ["nightorder"]);
  assert.deepEqual(E.activeBonds(["arunee", "nilakan", "prapha"]).map(b => b.id).sort(), ["lightdark", "lightorder"]);
  for (const id of ["kalawit", "thamin", "nisa", "asura", "prapha", "suriyan", "ratsami", "thinakorn"]) assert.equal(E.CARDS[id].rarity, 5);
});

test("cards: every monster id is defined once", () => {
  const src = createRequire(import.meta.url)("node:fs").readFileSync(new URL("../../dist/cards-engine.js", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("const FOES = {"), src.indexOf("// ---- New faces ----"));
  const ids = [...body.matchAll(/^    ([a-z0-9]+): \{/gm)].map(m => m[1]);
  const seen = new Set(), dupes = ids.filter(id => seen.has(id) || !seen.add(id));
  assert.deepEqual(dupes, []);
  assert.ok(ids.length > 100);
});

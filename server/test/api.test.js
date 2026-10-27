import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { MemoryStore } from "../src/store.js";
import { FakeOmise } from "../src/omise.js";
import { devVerifier } from "../src/auth.js";
import { cleanSave, mergeSave } from "../src/merge.js";
import { E, startRun, finishRun, board, weekOf, weekEnds, dayOf, shortName, prizeFor, RUNS_A_DAY } from "../src/raid.js";

function boot() {
  const store = new MemoryStore();
  const omise = new FakeOmise("http://api.test");
  const app = createApp({ store, omise, verify: devVerifier(), origins: ["http://localhost:5173"], devMode: true, returnUrl: "http://localhost:5173/", log: {} });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { body, token = "dev:ann" } = {}) => {
    const res = await fetch(base + path, { method, headers: { "Content-Type": "application/json", ...(token && { Authorization: "Bearer " + token }) }, body: body && JSON.stringify(body) });
    return { status: res.status, json: await res.json() };
  };
  return { store, omise, call, close: () => server.close() };
}

const device = (coins, extra = {}) => ({ best: 10, points: 10, coins, plays: 1, wins: 0, cleared: [1, 2], shop: { owned: ["jibjib"], hero: "jibjib", items: { bomb: 2 }, petLevels: {}, bring: {} }, ...extra });

test("merge: first sync takes the device save, later syncs apply the coin difference", () => {
  const first = mergeSave(null, cleanSave(device(500)), 0);
  assert.equal(first.coins, 500);
  // A top-up credited 1000 meanwhile; the device spent 200 and earned 50.
  const credited = { ...first, coins: first.coins + 1000 };
  const second = mergeSave(credited, cleanSave(device(350, { shop: { owned: ["pangji"], hero: "pangji", items: { bomb: 1 }, petLevels: { dragon: 2 }, heroXp: { pangji: 900, pupa: 40 }, bring: {} }, cleared: [3] })), 500);
  assert.equal(second.coins, 1350);
  assert.deepEqual(second.shop.owned.sort(), ["jibjib", "pangji"]);
  assert.equal(second.shop.hero, "pangji");
  assert.equal(second.shop.items.bomb, 2);
  assert.equal(second.shop.petLevels.dragon, 2);
  assert.deepEqual(second.shop.heroXp, { pangji: 900, pupa: 40 });
  const third = mergeSave(second, cleanSave(device(350, { shop: { owned: [], heroXp: { pangji: 100, jibjib: 7 } } })), 350);
  assert.deepEqual(third.shop.heroXp, { pangji: 900, pupa: 40, jibjib: 7 });
  const starred = mergeSave(third, cleanSave(device(350, { stars: { 1: 3, 2: 1, 3: 9 }, worldRewards: [1] })), 350);
  const again = mergeSave(starred, cleanSave(device(350, { stars: { 1: 2, 2: 3 }, worldRewards: [2] })), 350);
  assert.deepEqual(again.stars, { 1: 3, 2: 3, 3: 3 });
  assert.deepEqual(again.worldRewards, [1, 2]);
  assert.deepEqual(second.cleared, [1, 2, 3]);
});

test("merge: garbage is cleaned and the balance never goes negative", () => {
  assert.equal(cleanSave("nope"), null);
  const clean = cleanSave({ coins: -5, points: "12", cleared: [1, 1, "x", 9999], shop: { owned: [1, "ok"], items: { bomb: 500, "bad key!": 1 } } });
  assert.equal(clean.coins, 0);
  assert.equal(clean.points, 12);
  assert.deepEqual(clean.cleared, [1]);
  assert.deepEqual(clean.shop.owned, ["ok"]);
  assert.deepEqual(clean.shop.items, { bomb: 99 });
  assert.equal(mergeSave({ ...clean, coins: 10 }, { ...clean, coins: 0 }, 50).coins, 0);
});

test("api: login, sync, pay with TrueMoney, coins land on the account", async () => {
  const { call, omise, close } = boot();
  try {
    assert.equal((await call("POST", "/api/login", { token: null })).status, 401);
    const login = await call("POST", "/api/login");
    assert.equal(login.json.user.uid, "dev-ann");
    assert.equal(login.json.save, null);

    const sync = await call("PUT", "/api/save", { body: { save: device(500), baseCoins: 0, syncId: "s1" } });
    assert.equal(sync.json.save.coins, 500);
    // The same sync again (lost reply) changes nothing.
    assert.equal((await call("PUT", "/api/save", { body: { save: device(500), baseCoins: 0, syncId: "s1" } })).json.save.coins, 500);

    assert.equal((await call("POST", "/api/topup", { body: { pack: "p39", method: "truemoney", phone: "123", terms: "2026-10-09" } })).json.error, "bad_phone");
    assert.equal((await call("POST", "/api/topup", { body: { pack: "p39", method: "promptpay" } })).json.error, "terms_not_accepted");
    const order = (await call("POST", "/api/topup", { body: { pack: "p39", method: "truemoney", phone: "081-234-5678", terms: "2026-10-09" } })).json;
    assert.equal(order.status, "pending");
    assert.equal(order.coins, 450);
    assert.match(order.authorizeUri, /\/dev\/pay\/chrg_test_/);
    assert.equal((await call("GET", `/api/orders/${order.orderId}`)).json.status, "pending");
    // Someone else cannot look at it.
    assert.equal((await call("GET", `/api/orders/${order.orderId}`, { token: "dev:bob" })).status, 404);

    omise.finish(order.chargeId ?? [...omise.charges.keys()][0], "success");
    const paid = (await call("GET", `/api/orders/${order.orderId}`)).json;
    assert.equal(paid.status, "paid");
    assert.equal(paid.balance, 950);
    // Polling again does not credit twice.
    assert.equal((await call("GET", `/api/orders/${order.orderId}`)).json.balance, 950);

    // The device syncs after spending 100 of its 500: 950 - 100.
    const after = await call("PUT", "/api/save", { body: { save: device(400), baseCoins: 500, syncId: "s2" } });
    assert.equal(after.json.save.coins, 850);
    assert.equal(after.json.topupCoins, 450);
  } finally { close(); }
});

test("api: webhook settles a PromptPay charge, even for a player who never synced", async () => {
  const { call, omise, close } = boot();
  try {
    await call("POST", "/api/login", { token: "dev:cat" });
    const order = (await call("POST", "/api/topup", { body: { pack: "p79", method: "promptpay", terms: "2026-10-09" }, token: "dev:cat" })).json;
    assert.match(order.qrImage, /\/dev\/qr\//);
    const chargeId = [...omise.charges.keys()][0];
    // A webhook for a still-pending charge credits nothing.
    await call("POST", "/api/webhooks/omise", { body: { key: "charge.complete", data: { id: chargeId } }, token: null });
    assert.equal((await call("GET", `/api/orders/${order.orderId}`, { token: "dev:cat" })).json.status, "pending");
    omise.finish(chargeId, "success");
    const hook = await call("POST", "/api/webhooks/omise", { body: { key: "charge.complete", data: { id: chargeId } }, token: null });
    assert.equal(hook.json.ok, true);
    const view = (await call("GET", `/api/orders/${order.orderId}`, { token: "dev:cat" })).json;
    assert.equal(view.status, "paid");
    assert.equal(view.balance, 1000);
    // The first sync from a device then adds its own coins on top.
    const sync = await call("PUT", "/api/save", { body: { save: device(30), baseCoins: 0, syncId: "x" }, token: "dev:cat" });
    assert.equal(sync.json.save.coins, 1030);
    // A failed charge credits nothing.
    const bad = (await call("POST", "/api/topup", { body: { pack: "p20", method: "promptpay", terms: "2026-10-09" }, token: "dev:cat" })).json;
    omise.finish([...omise.charges.keys()][1], "fail");
    assert.equal((await call("GET", `/api/orders/${bad.orderId}`, { token: "dev:cat" })).json.status, "failed");
    assert.equal((await call("GET", `/api/orders/${bad.orderId}`, { token: "dev:cat" })).json.balance, 1030);
  } finally { close(); }
});

test("merge: card battles keep the higher card levels and stars, the device's team", () => {
  const first = mergeSave(null, cleanSave(device(100, { cards: { units: { pupa: 4, kitten: 2, "BAD key": 9 }, stars: { 1: 3, 2: 1 }, team: ["pupa", "", "kitten", 5, ""], auto: true } })), 0);
  assert.deepEqual(first.cards.units, { pupa: 4, kitten: 2 });
  assert.deepEqual(first.cards.team, ["pupa", "", "kitten", "", ""]);
  assert.equal(first.cards.auto, true);
  const second = mergeSave(first, cleanSave(device(100, { cards: { units: { pupa: 2, ikuya: 1 }, stars: { 2: 3, 3: 2 }, team: ["ikuya", "pupa", "", "", ""] } })), 100);
  assert.deepEqual(second.cards.units, { pupa: 4, kitten: 2, ikuya: 1 });
  assert.deepEqual(second.cards.stars, { 1: 3, 2: 3, 3: 2 });
  assert.deepEqual(second.cards.team, ["ikuya", "pupa", "", "", ""]);
  // an old device that knows nothing of cards loses nothing
  const third = mergeSave(second, cleanSave(device(100)), 100);
  assert.deepEqual(third.cards.units, second.cards.units);
  assert.deepEqual(third.cards.team, second.cards.team);
});

test("merge: card hunting, login rewards, costumes and the arena keep the furthest along", () => {
  const a = mergeSave(null, cleanSave(device(0, { cards: { units: { pupa: 3 }, xp: { pupa: 50 }, outfit: { pupa: 2 }, arena: 4, idleAt: 1000, daily: { day: "2026-10-11", streak: 3 } } })), 0);
  const b = mergeSave(a, cleanSave(device(0, { cards: { units: { pupa: 3 }, xp: { pupa: 20 }, arena: 2, idleAt: 500, daily: { day: "2026-10-09", streak: 1 } } })), 0);
  assert.equal(b.cards.xp.pupa, 50);
  assert.equal(b.cards.outfit.pupa, 2);
  assert.equal(b.cards.arena, 4);
  assert.equal(b.cards.idleAt, 1000);
  assert.deepEqual(b.cards.daily, { day: "2026-10-11", streak: 3 });
});

test("merge: a daily dungeon cleared on either device stays cleared that day", () => {
  const a = mergeSave(null, cleanSave(device(0, { cards: { dungeon: { day: "2026-10-11", exp: true, coin: false } } })), 0);
  const b = mergeSave(a, cleanSave(device(0, { cards: { dungeon: { day: "2026-10-11", exp: false, coin: true } } })), 0);
  assert.deepEqual(b.cards.dungeon, { day: "2026-10-11", exp: true, coin: true });
  const c = mergeSave(b, cleanSave(device(0, { cards: { dungeon: { day: "2026-10-12", exp: false, coin: false } } })), 0);
  assert.deepEqual(c.cards.dungeon, { day: "2026-10-12", exp: false, coin: false });
});

test("merge: gems move like coins, only by how they changed since the last sync", () => {
  const first = mergeSave(null, cleanSave(device(0, { gems: 300 })), 0, 0);
  assert.equal(first.gems, 300);
  // another device spent 100 meanwhile
  const other = mergeSave(first, cleanSave(device(0, { gems: 200 })), 0, 300);
  assert.equal(other.gems, 200);
  // this device earned 50 since it last synced at 300
  const back = mergeSave(other, cleanSave(device(0, { gems: 350 })), 0, 300);
  assert.equal(back.gems, 250);
});

test("merge: the one-time gift mark survives a device that has not had it", () => {
  const a = mergeSave(null, cleanSave(device(0, { gift: "gacha-2026-10", gems: 600 })), 0, 0);
  const b = mergeSave(a, cleanSave(device(0, { gems: 600 })), 0, 600);
  assert.equal(b.gift, "gacha-2026-10");
  // the newer gift wins over the older one
  const c = mergeSave(b, cleanSave(device(0, { gift: "gift-2026-10-13", gems: 600 })), 0, 600);
  assert.equal(c.gift, "gift-2026-10-13");
  // and today's gift wins over the one before it
  const d = mergeSave(c, cleanSave(device(0, { gift: "gift-2026-10-16", gems: 600 })), 0, 600);
  assert.equal(d.gift, "gift-2026-10-16");
  assert.equal(mergeSave(d, cleanSave(device(0, { gift: "gift-2026-10-13", gems: 600 })), 0, 600).gift, "gift-2026-10-16");
  // the second gift of the day sorts after the first
  const e = mergeSave(d, cleanSave(device(0, { gift: "gift-2026-10-16b", gems: 600 })), 0, 600);
  assert.equal(e.gift, "gift-2026-10-16b");
  assert.equal(mergeSave(e, cleanSave(device(0, { gift: "gift-2026-10-16", gems: 600 })), 0, 600).gift, "gift-2026-10-16b");
  // and the next day's after that
  const f = mergeSave(e, cleanSave(device(0, { gift: "gift-2026-10-21", gems: 600 })), 0, 600);
  assert.equal(f.gift, "gift-2026-10-21");
  assert.equal(mergeSave(f, cleanSave(device(0, { gift: "gift-2026-10-16b", gems: 600 })), 0, 600).gift, "gift-2026-10-21");
  // a second gift that day sorts after the first
  const g = mergeSave(f, cleanSave(device(0, { gift: "gift-2026-10-21b", gems: 600 })), 0, 600);
  assert.equal(g.gift, "gift-2026-10-21b");
  assert.equal(mergeSave(g, cleanSave(device(0, { gift: "gift-2026-10-21", gems: 600 })), 0, 600).gift, "gift-2026-10-21b");
});

test("save: the server gives the gem gift once per account, however many devices", async () => {
  const { call, close } = boot();
  try {
    const old = { ...device(100, { cleared: [1, 2, 3, 4, 5] }), gems: 0 };
    const first = await call("PUT", "/api/save", { body: { save: old, baseCoins: 0, baseGems: 0, syncId: "s1" } });
    assert.equal(first.json.giftGems, 10000);
    assert.equal(first.json.save.gems, 10000);
    // a second device with the same old save and no gift mark
    const second = await call("PUT", "/api/save", { body: { save: old, baseCoins: 100, baseGems: 0, syncId: "s2" } });
    assert.equal(second.json.giftGems, 0);
    assert.equal(second.json.save.gems, 10000);
    // a brand-new player gets it too
    const fresh = await call("PUT", "/api/save", { token: "dev:newbie", body: { save: { best: 0, points: 0, coins: 0, plays: 0, wins: 0, cleared: [], shop: { owned: [], items: {}, petLevels: {}, bring: {} } }, baseCoins: 0, syncId: "s3" } });
    assert.equal(fresh.json.giftGems, 10000);
  } finally { close(); }
});

test("merge: card stars, shards and star dust keep the larger count", () => {
  const a = mergeSave(null, cleanSave(device(0, { cards: { awake: { ikuya: 2, bad: 12 }, shards: { ikuya: 12 }, dust: 30 } })), 0);
  assert.equal(a.cards.awake.ikuya, 2);
  assert.equal(a.cards.awake.bad, 10);
  const b = mergeSave(a, cleanSave(device(0, { cards: { awake: { ikuya: 1, miu: 1 }, shards: { ikuya: 3 }, dust: 50 } })), 0);
  assert.deepEqual(b.cards.awake, { ikuya: 2, bad: 10, miu: 1 });
  assert.equal(b.cards.shards.ikuya, 12);
  assert.equal(b.cards.dust, 50);
});

test("merge: star bonuses paid on either device stay paid", () => {
  const a = mergeSave(null, cleanSave(device(0, { cards: { starPaid: [1, 2] } })), 0);
  const b = mergeSave(a, cleanSave(device(0, { cards: { starPaid: [3] } })), 0);
  assert.deepEqual(b.cards.starPaid, [1, 2, 3]);
});

test("merge: star-up wings keep the higher count, and stay unset until given", () => {
  const none = mergeSave(null, cleanSave(device(0, { cards: { dust: 1 } })), 0);
  assert.equal(none.cards.wings, undefined);
  const a = mergeSave(none, cleanSave(device(0, { cards: { wings: 7 } })), 0);
  const b = mergeSave(a, cleanSave(device(0, { cards: { wings: 2 } })), 0);
  assert.equal(b.cards.wings, 7);
});

test("merge: team sets come from the device, kept when a device has none", () => {
  const sets = [{ n: "ทีมบอส", t: ["pupa", "jibjib", "", "", ""] }, null, { n: "<b>x</b>".repeat(9), t: ["baitoey", "BAD ID", "", "", "", "extra"] }];
  const a = mergeSave(null, cleanSave(device(0, { cards: { units: { pupa: 5, jibjib: 3, baitoey: 2 }, team: ["pupa", "", "", "", ""], sets, set: 2 } })), 0);
  assert.equal(a.cards.sets.length, 5);
  assert.deepEqual(a.cards.sets[0], { n: "ทีมบอส", t: ["pupa", "jibjib", "", "", ""] });
  assert.equal(a.cards.sets[1], null);
  assert.equal(a.cards.sets[2].n.length, 16);
  assert.deepEqual(a.cards.sets[2].t, ["baitoey", "", "", "", ""]);
  assert.equal(a.cards.set, 2);
  // a device that never made a set leaves the account's sets alone
  const b = mergeSave(a, cleanSave(device(0, { cards: { units: { pupa: 5 }, team: ["pupa", "", "", "", ""], set: 9 } })), 0);
  assert.deepEqual(b.cards.sets, a.cards.sets);
  assert.equal(b.cards.set, 2);
  // a device with sets replaces them
  const c = mergeSave(b, cleanSave(device(0, { cards: { units: { pupa: 5 }, team: ["pupa", "", "", "", ""], sets: [null, { n: "", t: ["pupa", "", "", "", ""] }], set: 1 } })), 0);
  assert.equal(c.cards.sets[0], null);
  assert.equal(c.cards.set, 1);
});

test("merge: the match mode keeps each level's best stars and score", () => {
  const a = mergeSave(null, cleanSave(device(0, { match: { stars: { 1: 3, 2: 1, "bad key": 9 }, best: { 1: 1500, 2: 400 } } })), 0);
  assert.deepEqual(a.match, { stars: { 1: 3, 2: 1 }, best: { 1: 1500, 2: 400 } });
  // another device: better at 2, worse at 1, and level 3
  const b = mergeSave(a, cleanSave(device(0, { match: { stars: { 1: 1, 2: 3, 3: 2 }, best: { 1: 900, 2: 1800, 3: 700 } } })), 0);
  assert.deepEqual(b.match.stars, { 1: 3, 2: 3, 3: 2 });
  assert.deepEqual(b.match.best, { 1: 1500, 2: 1800, 3: 700 });
  // a device that never played it leaves it be
  assert.deepEqual(mergeSave(b, cleanSave(device(0)), 0).match, b.match);
  // stars never above three
  assert.equal(cleanSave(device(0, { match: { stars: { 4: 7 } } })).match.stars[4], 3);
});

test("merge: the dragon raid keeps the day's best, every coin paid, and the best ever", () => {
  const raid = (day, best, paid, top) => device(0, { cards: { units: { pupa: 5 }, team: ["pupa", "", "", "", ""], raid: { day, best, paid, top } } });
  const a = mergeSave(null, cleanSave(raid("2026-10-24", 5000, 300, 9000)), 0);
  assert.deepEqual(a.cards.raid, { day: "2026-10-24", best: 5000, paid: 300, top: 9000 });
  // the same day on another device: the higher of each
  const b = mergeSave(a, cleanSave(raid("2026-10-24", 7000, 250, 7000)), 0);
  assert.deepEqual(b.cards.raid, { day: "2026-10-24", best: 7000, paid: 300, top: 9000 });
  // a later day starts over, keeping the best ever
  const c = mergeSave(b, cleanSave(raid("2026-10-25", 100, 6, 100)), 0);
  assert.deepEqual(c.cards.raid, { day: "2026-10-25", best: 100, paid: 6, top: 9000 });
  // an older day does not undo it, and a device without a raid leaves it be
  assert.deepEqual(mergeSave(c, cleanSave(raid("2026-10-24", 99999, 9999, 99999)), 0).cards.raid, { day: "2026-10-25", best: 100, paid: 6, top: 99999 });
  assert.deepEqual(mergeSave(c, cleanSave(device(0, { cards: { units: { pupa: 5 } } })), 0).cards.raid, c.cards.raid);
  // nonsense is dropped
  assert.equal(cleanSave(raid("yesterday", 1, 1, 1)).cards.raid, null);
});

test("merge: gear keeps each piece's higher tier and level, ore the higher count", () => {
  const none = mergeSave(null, cleanSave(device(0, { cards: { dust: 1 } })), 0);
  assert.equal(none.cards.ore, undefined);
  assert.deepEqual(none.cards.gear, {});
  const a = mergeSave(none, cleanSave(device(0, { cards: { ore: 40, gear: { pupag0: 112, pupag1: 205, "bad key": 300 } } })), 0);
  const b = mergeSave(a, cleanSave(device(0, { cards: { ore: 12, gear: { pupag0: 108, pupag2: 103 } } })), 0);
  assert.equal(b.cards.ore, 40);
  assert.deepEqual(b.cards.gear, { pupag0: 112, pupag1: 205, pupag2: 103 });
});

test("merge: items from both copies, none broken down on either, one worn a slot", () => {
  const a = mergeSave(null, cleanSave(device(0, { cards: { units: { pupa: 5, jibjib: 5 }, items: [
    { i: "aaa1", s: 0, r: 3, m: 50, x: [1020, 3040], o: "pupa" },
    { i: "aaa2", s: 1, r: 1, m: 10, x: [], o: "" },
    { i: "bad!", s: 0, r: 3, m: 50, x: [], o: "" },
    { i: "aaa3", s: 9, r: 3, m: 50, x: [], o: "" }
  ] } })), 0);
  assert.deepEqual(a.cards.items.map(it => it.i), ["aaa1", "aaa2"]);
  // the other device broke aaa2 down and found a weapon of its own for Pupa
  const b = mergeSave(a, cleanSave(device(0, { cards: { units: { pupa: 5, jibjib: 5 }, gone: ["aaa2"], items: [
    { i: "aaa1", s: 0, r: 3, m: 50, x: [1020, 3040], o: "" },
    { i: "bbb1", s: 0, r: 5, m: 99, x: [1, 1002, 2003, 3004, 4005], o: "pupa" }
  ] } })), 0);
  assert.deepEqual(b.cards.items.map(it => `${it.i}:${it.o}`).sort(), ["aaa1:", "bbb1:pupa"]);
  assert.deepEqual(b.cards.gone, ["aaa2"]);
  assert.equal(b.cards.items.find(it => it.i === "bbb1").x.length, 4); // rarity 5: four extras at most
});

test("merge: the wing compensation, once given, stays given", () => {
  const a = mergeSave(null, cleanSave(device(0, { cards: { wingComp: true, wings: 9 } })), 0);
  const b = mergeSave(a, cleanSave(device(0, { cards: { wings: 3 } })), 0);
  assert.equal(b.cards.wingComp, true);
  assert.equal(b.cards.wings, 9);
});

test("merge: quests keep the later day, every claim of the same day, and achievements paid anywhere", () => {
  const a = mergeSave(null, cleanSave(device(0, { cards: { quest: { day: "2026-10-13", counts: { win: 2 }, claimed: ["idle1"] }, achv: ["stage10"] } })), 0);
  const b = mergeSave(a, cleanSave(device(0, { cards: { quest: { day: "2026-10-13", counts: { win: 1, pull: 1 }, claimed: ["pull1"] }, achv: ["cards5"] } })), 0);
  assert.deepEqual(b.cards.quest.counts, { win: 2, pull: 1 });
  assert.deepEqual(b.cards.quest.claimed.sort(), ["idle1", "pull1"]);
  assert.deepEqual(b.cards.achv.sort(), ["cards5", "stage10"]);
  const c = mergeSave(b, cleanSave(device(0, { cards: { quest: { day: "2026-10-14", counts: {}, claimed: [] } } })), 0);
  assert.equal(c.cards.quest.day, "2026-10-14");
});

test("merge: card levels past 99 (second awakening) and the arena team survive a sync", () => {
  const a = mergeSave(null, cleanSave(device(0, { cards: { units: { phloeng: 125 }, arenaPick: ["phloeng"], arenaFront: ["phloeng"] } })), 0);
  assert.equal(a.cards.units.phloeng, 125);
  assert.deepEqual(a.cards.arenaPick, ["phloeng"]);
  assert.deepEqual(a.cards.arenaFront, ["phloeng"]);
});

// ---- The weekly dragon raid ranking ----

// A save whose team can fight the raid.
const raider = (lv = 60) => device(0, { cards: { units: { thongkham: lv, phloeng: lv, chantra: lv, asani: lv, pupav2: lv }, awake: { thongkham: 3, phloeng: 3, chantra: 3, asani: 3, pupav2: 3 }, team: ["thongkham", "phloeng", "chantra", "asani", "pupav2"], stars: { 1: 3, 2: 3, 40: 2 }, form: "arrow", formLv: { arrow: 12 } } });

// Plays a ranked run as the page does (auto, the clock at the raid's pace)
// and returns what the page would send.
function playRun(run) {
  const stage = E.raid(run.best, { pumpkin: run.pumpkin });
  const b = E.createBattle({ team: run.team, stage, seed: run.seed });
  const turns = [];
  let clock = 0, shown = 0, score = 0;
  outer: while (b.phase !== "done") {
    let events;
    if (b.phase === "hero") { const q = E.autoQueue(b); turns.push({ q, f: b.focus }); events = E.heroTurn(b, q, b.focus); }
    else events = E.enemyTurn(b);
    for (const ev of events) {
      if (clock >= E.RAID_TIME * 1000) break outer;
      shown++;
      if (ev.side === "foe" && (ev.t === "hit" || ev.t === "burn")) score += ev.v;
      clock += E.eventTime(b, ev, E.RAID_PACE);
    }
  }
  return { turns, shown, score };
}

test("raid: a ranked run is replayed on the server to the page's score", async () => {
  const { call, close } = boot();
  try {
    // no team synced yet
    assert.equal((await call("POST", "/api/raid/start")).json.error, "no_team");
    await call("PUT", "/api/save", { body: { save: raider(), baseCoins: 0, syncId: "s1" } });
    const start = await call("POST", "/api/raid/start");
    assert.equal(start.status, 200);
    const run = start.json;
    assert.ok(run.runId && run.seed > 0 && run.best === 40 && run.team.length === 5 && run.team[0].lv === 60 && run.rules === E.RAID_RULES);
    // the synced formation: where each stands and its bonus
    assert.deepEqual(run.team.map(t => t.row), ["front", "middle", "middle", "back", "back"]);
    assert.ok(run.team.every(t => t.gear.atk >= E.formBonus("arrow", 12).atk));
    const page = playRun(run);
    const done = await call("POST", "/api/raid/finish", { body: { runId: run.runId, turns: page.turns, shown: page.shown } });
    assert.equal(done.status, 200);
    assert.equal(done.json.score, page.score);
    assert.equal(done.json.rank, 1);
    // a run counts once
    assert.equal((await call("POST", "/api/raid/finish", { body: { runId: run.runId, turns: page.turns, shown: page.shown } })).json.error, "no_run");
    // another player, a weaker team: second; claiming more shown than the clock allows gains nothing
    await call("PUT", "/api/save", { token: "dev:bob", body: { save: raider(40), baseCoins: 0, syncId: "s2" } });
    const bobRun = (await call("POST", "/api/raid/start", { token: "dev:bob" })).json;
    const bobPage = playRun(bobRun);
    const bob = await call("POST", "/api/raid/finish", { token: "dev:bob", body: { runId: bobRun.runId, turns: bobPage.turns, shown: 1e6 } });
    assert.equal(bob.json.score, bobPage.score);
    const boardAnn = (await call("GET", "/api/raid/board")).json;
    assert.equal(boardAnn.top.length, 2);
    assert.deepEqual(boardAnn.top.map(p => p.name), page.score > bobPage.score ? ["ann", "bob"] : ["bob", "ann"]);
    assert.equal(boardAnn.me.score, page.score);
    assert.ok(boardAnn.top.find(p => p.name === "ann").me && !boardAnn.top.find(p => p.name === "bob").me);
    assert.ok(boardAnn.endsAt > Date.now() && boardAnn.prizes.length && boardAnn.runsLeft === RUNS_A_DAY - 1);
    // nonsense turns are refused
    const again = (await call("POST", "/api/raid/start")).json;
    assert.equal((await call("POST", "/api/raid/finish", { body: { runId: again.runId, turns: [{ q: [{ i: 99, s: 0 }] }], shown: 5 } })).json.error, "bad_run");
  } finally { close(); }
});

test("raid: runs expire, a day allows so many, a week ends on Monday in Bangkok and pays its places once", async () => {
  const store = new MemoryStore();
  const ann = { uid: "ann", name: "Ann Lee" }, bob = { uid: "bob", name: "บ๊อบ ใจดี" };
  for (const who of [ann, bob]) await store.updateUser(who.uid, () => ({ uid: who.uid, save: cleanSave(raider(who === ann ? 60 : 40)) }));
  // weeks: Sunday 23:59 in Bangkok is still the old week
  assert.equal(weekOf(Date.parse("2026-10-25T16:59:59Z")), "2026-10-19");
  assert.equal(weekOf(Date.parse("2026-10-25T17:00:00Z")), "2026-10-26");
  assert.equal(weekEnds("2026-10-26"), Date.parse("2026-11-01T17:00:00Z"));
  assert.equal(dayOf(Date.parse("2026-10-26T18:00:00Z")), "2026-10-27");
  const t0 = Date.parse("2026-10-28T05:00:00Z");
  // too late to finish
  const stale = await startRun(store, ann, t0);
  assert.equal((await finishRun(store, ann, { runId: stale.runId, turns: [], shown: 0 }, t0 + 16 * 60_000)).error, "run_expired");
  // two players this week
  for (const who of [ann, bob]) {
    const run = await startRun(store, who, t0);
    const page = playRun(run);
    const out = await finishRun(store, who, { runId: run.runId, ...page }, t0 + 70_000);
    assert.equal(out.score, page.score);
  }
  // a worse run later keeps the best
  const weak = await startRun(store, ann, t0);
  const best = (await store.raidScore("2026-10-26", "ann")).score;
  await finishRun(store, ann, { runId: weak.runId, turns: [], shown: 0 }, t0 + 1000);
  assert.equal((await store.raidScore("2026-10-26", "ann")).score, best);
  assert.equal((await store.raidScore("2026-10-26", "bob")).name, "บ๊อบ ใ.");
  // during the week: no prize yet; next week (after it settles) the places pay, once
  assert.equal((await board(store, ann, t0)).reward, null);
  const next = Date.parse("2026-11-02T02:00:00Z");
  const first = (await store.raidScore("2026-10-26", "ann")).score > (await store.raidScore("2026-10-26", "bob")).score ? ann : bob;
  const second = first === ann ? bob : ann;
  const gemsBefore = (await store.getUser(first.uid)).save.gems || 0;
  const paid = await board(store, first, next);
  assert.deepEqual([paid.reward.week, paid.reward.rank, paid.reward.gems], ["2026-10-26", 1, prizeFor(1)]);
  assert.equal((await store.getUser(first.uid)).save.gems, gemsBefore + prizeFor(1));
  assert.equal((await board(store, first, next)).reward, null);
  assert.equal((await board(store, second, next)).reward.rank, 2);
  assert.equal(paid.week, "2026-11-02");
  // so many runs a day
  const runner = { uid: "cat", name: "cat" };
  await store.updateUser("cat", () => ({ uid: "cat", save: cleanSave(raider()) }));
  for (let n = 0; n < RUNS_A_DAY; n++) assert.ok((await startRun(store, runner, t0)).runId);
  assert.equal((await startRun(store, runner, t0)).error, "too_many_runs");
  assert.ok((await startRun(store, runner, t0 + 86_400_000)).runId);
  // names: a word and an initial, never an e-mail address
  assert.equal(shortName("Somchai Jaidee"), "Somchai J.");
  assert.equal(shortName("someone@example.com"), "som***");
  assert.equal(shortName(""), "ผู้เล่น");
  assert.deepEqual([prizeFor(1), prizeFor(3), prizeFor(10), prizeFor(11), prizeFor(500)], [3000, 1500, 1000, 500, 100]);
});

test("merge: a worn Halloween costume is kept", () => {
  const a = mergeSave(null, cleanSave(device(0, { cards: { units: { asani: 5 }, team: ["asani", "", "", "", ""], hallo: { asani: 1, nope: 7 } } })), 0);
  assert.deepEqual(a.cards.hallo, { asani: 1, nope: 1 });
  assert.deepEqual(mergeSave(a, cleanSave(device(0, { cards: { units: { asani: 5 } } })), 0).cards.hallo, a.cards.hallo);
});

test("merge: the formation goes with the team, and formation levels only go up", () => {
  const a = mergeSave(null, cleanSave(device(0, { cards: { units: { asani: 5 }, team: ["asani", "", "", "", ""], form: "wall", formLv: { wall: 7, arrow: 3, bad: 99 }, sets: [{ n: "x", t: ["asani"], f: "arrow" }] } })), 0);
  assert.equal(a.cards.form, "wall");
  assert.deepEqual(a.cards.formLv, { wall: 7, arrow: 3, bad: 30 });
  assert.equal(a.cards.sets[0].f, "arrow");
  // a device with a team brings its formation; levels keep the highest
  const b = mergeSave(a, cleanSave(device(0, { cards: { units: { asani: 5 }, team: ["asani", "", "", "", ""], form: "twin", formLv: { wall: 2, arrow: 9 } } })), 0);
  assert.equal(b.cards.form, "twin");
  assert.deepEqual(b.cards.formLv, { wall: 7, arrow: 9, bad: 30 });
  // one without a team keeps the account's
  assert.equal(mergeSave(b, cleanSave(device(0, { cards: { units: { asani: 5 } } })), 0).cards.form, "twin");
});

test("merge: Halloween candy keeps what was earned and every buy, never more", () => {
  const ev = (earned, bought, day, battle, gift, raid) => device(0, { cards: { units: { pupa: 5 }, team: ["pupa", "", "", "", ""], event: { id: "halloween2026", earned, bought, day, battle, gift, raid } } });
  const a = mergeSave(null, cleanSave(ev(500, { card: 0, ore: 2 }, "2026-10-28", 40, true, 20)), 0);
  assert.deepEqual(a.cards.event, { id: "halloween2026", earned: 500, bought: { card: 0, ore: 2 }, day: "2026-10-28", battle: 40, gift: true, raid: 20 });
  // a device that spent elsewhere and earned less: the buys stay, the earnings stay
  const b = mergeSave(a, cleanSave(ev(450, { card: 1 }, "2026-10-28", 60, false, 10)), 0);
  assert.deepEqual(b.cards.event, { id: "halloween2026", earned: 500, bought: { ore: 2, card: 1 }, day: "2026-10-28", battle: 60, gift: true, raid: 20 });
  // a new day starts its counts over
  const c = mergeSave(b, cleanSave(ev(520, {}, "2026-10-29", 4, false, 0)), 0);
  assert.deepEqual([c.cards.event.earned, c.cards.event.day, c.cards.event.battle, c.cards.event.gift, c.cards.event.raid], [520, "2026-10-29", 4, false, 0]);
  assert.equal(c.cards.event.bought.card, 1);
  // nonsense is dropped
  assert.equal(cleanSave(device(0, { cards: { event: { id: "Bad Id!", earned: 5 } } })).cards.event, null);
});

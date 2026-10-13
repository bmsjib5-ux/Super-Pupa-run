import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { MemoryStore } from "../src/store.js";
import { FakeOmise } from "../src/omise.js";
import { devVerifier } from "../src/auth.js";
import { cleanSave, mergeSave } from "../src/merge.js";

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
});

test("save: the server gives the gem gift once per account, however many devices", async () => {
  const { call, close } = boot();
  try {
    const old = { ...device(100, { cleared: [1, 2, 3, 4, 5] }), gems: 0 };
    const first = await call("PUT", "/api/save", { body: { save: old, baseCoins: 0, baseGems: 0, syncId: "s1" } });
    assert.equal(first.json.giftGems, 500 + 4 * 5 + 20);
    assert.equal(first.json.save.gems, 540);
    // a second device with the same old save and no gift mark
    const second = await call("PUT", "/api/save", { body: { save: old, baseCoins: 100, baseGems: 0, syncId: "s2" } });
    assert.equal(second.json.giftGems, 0);
    assert.equal(second.json.save.gems, 540);
    // a brand-new player gets none
    const fresh = await call("PUT", "/api/save", { token: "dev:newbie", body: { save: { best: 0, points: 0, coins: 0, plays: 0, wins: 0, cleared: [], shop: { owned: [], items: {}, petLevels: {}, bring: {} } }, baseCoins: 0, syncId: "s3" } });
    assert.equal(fresh.json.giftGems, 0);
  } finally { close(); }
});

test("merge: card stars, shards and star dust keep the larger count", () => {
  const a = mergeSave(null, cleanSave(device(0, { cards: { awake: { ikuya: 2, bad: 9 }, shards: { ikuya: 12 }, dust: 30 } })), 0);
  assert.equal(a.cards.awake.ikuya, 2);
  assert.equal(a.cards.awake.bad, 5);
  const b = mergeSave(a, cleanSave(device(0, { cards: { awake: { ikuya: 1, miu: 1 }, shards: { ikuya: 3 }, dust: 50 } })), 0);
  assert.deepEqual(b.cards.awake, { ikuya: 2, bad: 5, miu: 1 });
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

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
  const second = mergeSave(credited, cleanSave(device(350, { shop: { owned: ["pangji"], hero: "pangji", items: { bomb: 1 }, petLevels: { dragon: 2 }, bring: {} }, cleared: [3] })), 500);
  assert.equal(second.coins, 1350);
  assert.deepEqual(second.shop.owned.sort(), ["jibjib", "pangji"]);
  assert.equal(second.shop.hero, "pangji");
  assert.equal(second.shop.items.bomb, 2);
  assert.equal(second.shop.petLevels.dragon, 2);
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

    assert.equal((await call("POST", "/api/topup", { body: { pack: "p39", method: "truemoney", phone: "123" } })).json.error, "bad_phone");
    const order = (await call("POST", "/api/topup", { body: { pack: "p39", method: "truemoney", phone: "081-234-5678" } })).json;
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
    const order = (await call("POST", "/api/topup", { body: { pack: "p79", method: "promptpay" }, token: "dev:cat" })).json;
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
    const bad = (await call("POST", "/api/topup", { body: { pack: "p19", method: "promptpay" }, token: "dev:cat" })).json;
    omise.finish([...omise.charges.keys()][1], "fail");
    assert.equal((await call("GET", `/api/orders/${bad.orderId}`, { token: "dev:cat" })).json.status, "failed");
    assert.equal((await call("GET", `/api/orders/${bad.orderId}`, { token: "dev:cat" })).json.balance, 1030);
  } finally { close(); }
});

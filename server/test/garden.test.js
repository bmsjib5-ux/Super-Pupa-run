// The merge garden (dist/garden-engine.js): making, joining, energy,
// orders, levels and keeping a garden in the cloud.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { cleanSave, mergeSave } from "../src/merge.js";

const G = createRequire(import.meta.url)("../../dist/garden-engine.js");
const T0 = Date.parse("2026-11-12T03:00:00Z");

test("garden: a new garden has the seed basket, a few seeds, full energy and three orders", () => {
  const s = G.create(T0, 5);
  assert.equal(s.board.length, G.SIZE);
  assert.equal(s.board.filter(c => c === "Gf").length, 1);
  assert.ok(s.board.filter(G.isThing).length >= 3);
  assert.equal(G.energyNow(s, T0), G.MAX_ENERGY);
  assert.equal(s.orders.length, G.ORDERS);
  // the first orders only ask for the first steps of the flower chain
  for (const o of s.orders) for (const c of o.want) assert.ok(/^f[12]$/.test(c), c);
  // and differ from one another
  assert.equal(new Set(s.orders.map(o => o.want.join())).size, G.ORDERS);
  assert.deepEqual(G.info("f5"), { icon: "🌸", name: "ดอกซากุระ", chain: "สวนดอกไม้", step: 5, steps: 8, top: false });
  assert.ok(G.info("Gf").maker);
});

test("garden: two of a kind join into the next step; others move or swap; the top step stays", () => {
  const s = G.create(T0, 5);
  s.board.fill("");
  s.board[0] = "f2"; s.board[1] = "f2"; s.board[2] = "s1"; s.board[3] = "f8"; s.board[4] = "f8";
  assert.deepEqual(G.move(s, 0, 1), { k: "join", at: 1, code: "f3", gems: 6 });   // f3 seen for the first time: 3 x 2 gems
  assert.equal(s.board[0], "");
  assert.equal(G.move(s, 1, 2).k, "swap");
  assert.deepEqual([s.board[1], s.board[2]], ["s1", "f3"]);
  assert.equal(G.move(s, 2, 10).k, "move");
  assert.equal(G.move(s, 3, 4).k, "swap");   // the top step does not join
  assert.equal(G.move(s, 20, 21).k, "none"); // nothing to move
  // seeing a step again brings nothing
  s.board[30] = "f2"; s.board[31] = "f2";
  assert.equal(G.move(s, 30, 31).gems, 0);
});

test("garden: a maker spends one energy and fills the nearest empty cell; energy comes back with time", () => {
  const s = G.create(T0, 9);
  const at = s.board.indexOf("Gf");
  const r = G.produce(s, at, T0);
  assert.equal(r.k, "spawn");
  assert.ok(/^f[12]$/.test(r.code));
  const [r0, c0] = [Math.floor(at / 7), at % 7], [r1, c1] = [Math.floor(r.at / 7), r.at % 7];
  assert.ok(Math.abs(r0 - r1) + Math.abs(c0 - c1) <= 2);
  assert.equal(s.energy, G.MAX_ENERGY - 1);
  // used up, then back one every two minutes, never past the most
  s.energy = 0;
  s.stamp = T0;
  assert.equal(G.produce(s, at, T0).error, "energy");
  assert.equal(G.energyNow(s, T0 + G.REGEN * 3 + 5000), 3);
  assert.equal(G.nextEnergyIn(s, T0 + G.REGEN * 3 + 5000), G.REGEN - 5000);
  assert.equal(G.energyNow(s, T0 + G.REGEN * 1000), G.MAX_ENERGY);
  assert.equal(G.produce(s, at, T0 + G.REGEN * 2).k, "spawn");
  assert.equal(s.energy, 1);
  // a full board makes nothing
  s.board = s.board.map((c, i) => (i === at ? c : "s1"));
  s.energy = 5;
  assert.equal(G.produce(s, at, T0 + G.REGEN * 2).error, "full");
  // and things that are not makers make nothing
  assert.equal(G.produce(s, at === 0 ? 1 : 0, T0).error, "not_maker");
});

test("garden: filling an order pays, levels open the bakery at 3 and the mine at 6", () => {
  const s = G.create(T0, 3);
  s.board.fill("");
  s.board[59] = "Gf";
  s.orders[0] = { who: "pupa", want: ["f2", "f3"], coins: 20, xp: 10, energy: 3 };
  assert.equal(G.fill(s, 0, T0).error, "missing");
  s.board[0] = "f2"; s.board[1] = "f3";
  s.energy = 10;
  const r = G.fill(s, 0, T0);
  assert.deepEqual([r.coins, r.xp, r.energy], [20, 10, 3]);
  assert.deepEqual([s.board[0], s.board[1]], ["", ""]);
  assert.equal(s.energy, 13);
  assert.equal(s.xp, 10);
  assert.notEqual(s.orders[0].who + s.orders[0].want, "pupaf2,f3");
  // enough points for two levels at once: the second brings the bakery
  s.orders[1] = { who: "miu", want: ["f1"], coins: 3, xp: G.need(1) - 10 + G.need(2), energy: 0 };
  s.board[5] = "f1";
  const up = G.fill(s, 1, T0);
  assert.deepEqual(up.levels, [2, 3]);
  assert.deepEqual(up.opened, ["s"]);
  assert.equal(up.gems, G.levelReward(2).gems + G.levelReward(3).gems);
  assert.equal(up.energy, 40);
  assert.equal(s.board[57], "Gs");
  // later orders may ask for sweets too, but only their first steps
  for (let i = 0; i < 40; i++) for (const c of G.makeOrder(s).want) assert.ok(/^f[1-3]$|^s[12]$/.test(c), c);
  // the mine waits for room when the board is full
  s.board = s.board.map(c => c || "f1");
  s.level = 5; s.xp = 0;
  s.orders[2] = { who: "ikuya", want: ["f1"], coins: 3, xp: G.need(5), energy: 0 };
  const six = G.fill(s, 2, T0);
  assert.deepEqual(six.opened, ["g"]);
  assert.ok(s.board.includes("Gg"), "the filled order's cell made room");
});

test("garden: changing an order costs one energy", () => {
  const s = G.create(T0, 8);
  assert.equal(G.swapOrder(s, 1, T0).k, "swap_order");
  assert.equal(s.energy, G.MAX_ENERGY - 1);
  assert.equal(s.orders.length, 3);
  s.energy = 0; s.stamp = T0;
  assert.equal(G.swapOrder(s, 1, T0).error, "energy");
  assert.equal(G.swapOrder(s, 7, T0).error, "no_order");
});

test("garden: selling, harvesting the top step, and a hint", () => {
  const s = G.create(T0, 4);
  s.board.fill("");
  s.board[0] = "f4"; s.board[1] = "f8"; s.board[2] = "Gf";
  assert.deepEqual(G.sell(s, 0), { k: "sell", coins: 8 });
  assert.equal(G.sell(s, 1).error, "cannot");
  assert.equal(G.sell(s, 2).error, "cannot");
  assert.deepEqual(G.harvest(s, 1), { k: "harvest", ...G.HARVEST });
  assert.equal(G.hintPair(s), null);
  s.board[10] = "s2"; s.board[40] = "s2";
  assert.deepEqual(G.hintPair(s), [10, 40]);
});

test("garden: a greedy gardener keeps going: levels rise and the board never jams", () => {
  const s = G.create(T0, 1);
  let spent = 0;
  const wanted = () => { const w = new Map(); for (const o of s.orders) for (const c of o.want) w.set(c, (w.get(c) || 0) + 1); return w; };
  for (let guard = 0; guard < 50000 && spent < 300; guard++) {
    const i = s.orders.findIndex(o => G.cellsFor(s, o));
    if (i >= 0) { G.fill(s, i, T0); continue; }
    const w = wanted(), count = (c) => s.board.filter(x => x === c).length;
    const seen = new Map();
    let pair = null;
    s.board.forEach((c, j) => { if (pair || !G.canJoin(c, c) || (w.has(c) && count(c) <= w.get(c))) return; if (seen.has(c)) pair = [seen.get(c), j]; else seen.set(c, j); });
    if (pair) { G.move(s, ...pair); continue; }
    const score = {};
    for (const o of s.orders) { const used = new Set(); for (const c of o.want) { const j = s.board.findIndex((x, k) => x === c && !used.has(k)); if (j >= 0) used.add(j); else score[c[0]] = (score[c[0]] || 0) + 1 + Number(c[1]); } }
    const makers = s.board.map((c, j) => [c, j]).filter(([c]) => G.isMaker(c)).sort((a, b) => (score[b[0][1]] || 0) - (score[a[0][1]] || 0));
    s.energy = 1;
    const r = G.produce(s, makers[0][1], T0);
    if (r.error === "full") { const j = s.board.findIndex(c => G.isThing(c) && !G.isTop(c) && !w.has(c)); G.sell(s, j); continue; }
    assert.equal(r.k, "spawn");
    spent++;
  }
  assert.equal(spent, 300);
  assert.ok(s.level >= 9, `level ${s.level}`);
  assert.ok(s.board.includes("Gs") && s.board.includes("Gg"));
});

test("garden: a save is cleaned, and of two copies the one further along is kept", () => {
  const s = G.create(T0, 2);
  // junk is dropped, numbers are held in range, missing orders are made
  const raw = { ...s, board: s.board.map((c, i) => (i === 0 ? "x9" : i === 1 ? "<b>" : c)), energy: 1e9, level: 500, orders: [{ who: "nobody", want: ["f2", "zz"], coins: 5, xp: 2 }] };
  const c = G.clean(raw, T0);
  assert.equal(c.board[0], "");
  assert.equal(c.board[1], "");
  assert.equal(c.energy, 999);
  assert.equal(c.level, 99);
  assert.deepEqual(c.orders[0], { who: "pupa", want: ["f2"], coins: 5, xp: 2, energy: 0 });
  assert.equal(c.orders.length, 3);
  // level 99 opens every maker
  assert.ok(c.board.includes("Gs") && c.board.includes("Gg"));
  // a broken board starts a new garden
  assert.equal(G.clean({ board: [1, 2] }, T0).board.length, G.SIZE);
  const a = { level: 4, xp: 2, rev: 50 }, b = { level: 4, xp: 9, rev: 10 }, d = { level: 3, xp: 50, rev: 900 };
  assert.equal(G.newer(a, b), b);
  assert.equal(G.newer(a, d), a);
  assert.equal(G.newer(null, d), d);
});

test("merge: the cloud keeps the garden further along, whole", () => {
  const device = (garden) => ({ best: 1, points: 1, coins: 0, plays: 1, wins: 0, cleared: [], shop: { owned: [], items: {}, petLevels: {}, bring: {} }, garden });
  assert.equal(cleanSave(device(undefined)).garden, null);
  assert.equal(cleanSave(device({ board: "nope" })).garden, null);
  const g1 = G.create(T0, 1), g2 = G.create(T0, 2);
  g1.level = 3; g2.level = 5; g2.board[0] = "f6";
  const a = mergeSave(null, cleanSave(device(g1)), 0);
  assert.equal(a.garden.level, 3);
  const b = mergeSave(a, cleanSave(device(g2)), 0);
  assert.equal(b.garden.level, 5);
  assert.equal(b.garden.board[0], "f6");
  // an older device's garden does not replace it
  assert.equal(mergeSave(b, cleanSave(device(g1)), 0).garden.level, 5);
  // a device without a garden keeps the account's
  assert.equal(mergeSave(b, cleanSave(device(undefined)), 0).garden.level, 5);
});

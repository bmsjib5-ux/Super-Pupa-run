// สวนรวมร่างของ Pupa (the merge garden): the rules, with no page in them,
// so Node can test them too. A 7 x 9 board holds things and the makers that
// make them. Tap a maker (one energy) for a first-step thing; put two of
// the same thing together and they become the next step. Friends come with
// orders for things; filling one pays coins and garden points, and garden
// levels open new makers and bring gems.
//
// A thing is written as its chain's letter and its step, "f3"; a maker as
// "G" and its chain's letter, "Gf". The board is 63 such strings, "" for an
// empty cell, row by row from the top left.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaGardenEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const COLS = 7, ROWS = 9, SIZE = COLS * ROWS;
  const MAX_ENERGY = 60, REGEN = 120_000;      // one energy each two minutes, up to 60
  const ORDERS = 3;

  // ---- What grows ----
  const CHAINS = {
    f: { name: "สวนดอกไม้", unlock: 1, maker: { icon: "🧺", name: "ตะกร้าเมล็ดพันธุ์" }, color: "#ffd6e6",
      steps: [["🌰", "เมล็ดพันธุ์"], ["🌱", "ต้นกล้า"], ["🌿", "กิ่งใบอ่อน"], ["🌷", "ดอกตูม"], ["🌸", "ดอกซากุระ"], ["💐", "ช่อซากุระ"], ["🪴", "กระถางซากุระ"], ["🌳", "ต้นซากุระยักษ์"]] },
    s: { name: "ร้านขนม", unlock: 3, maker: { icon: "🥣", name: "ชามผสมแป้ง" }, color: "#ffe7c2",
      steps: [["🌾", "ข้าวสาลี"], ["🍪", "คุกกี้"], ["🧁", "คัพเค้ก"], ["🍩", "โดนัท"], ["🥧", "พายเชอร์รี่"], ["🍰", "เค้กสตรอว์เบอร์รี่"], ["🎂", "เค้กฉลอง"]] },
    g: { name: "เหมืองผลึก", unlock: 6, maker: { icon: "⛏️", name: "เหมืองผลึก" }, color: "#d6ecff",
      steps: [["🪨", "ก้อนหิน"], ["🔹", "เศษผลึก"], ["🔷", "ผลึกฟ้า"], ["💠", "ผลึกดาว"], ["💎", "เพชรเม็ดงาม"], ["💍", "แหวนเพชร"], ["👑", "มงกุฎจันทร์"]] }
  };
  const FRIENDS = ["pupa", "jibjib", "baitoey", "ikuya", "pangji", "chantra", "sakura", "miu", "thongkham", "mekha", "fasai", "pupav2"];
  // where each maker goes when it opens: near the bottom middle
  const MAKER_SPOT = { f: 59, s: 57, g: 61 };

  // ---- Small helpers ----
  const isMaker = (code) => typeof code === "string" && code[0] === "G";
  const isThing = (code) => typeof code === "string" && /^[a-z][1-9]$/.test(code) && Boolean(CHAINS[code[0]]);
  const chainOf = (code) => CHAINS[isMaker(code) ? code[1] : code[0]];
  const stepOf = (code) => Number(code[1]);
  const isTop = (code) => isThing(code) && stepOf(code) >= chainOf(code).steps.length;
  const info = (code) => {
    if (isMaker(code)) { const c = chainOf(code); return { icon: c.maker.icon, name: c.maker.name, chain: c.name, maker: true }; }
    const c = chainOf(code), n = stepOf(code), [icon, name] = c.steps[n - 1];
    return { icon, name, chain: c.name, step: n, steps: c.steps.length, top: n >= c.steps.length };
  };
  const rowCol = (i) => [Math.floor(i / COLS), i % COLS];

  // ---- Numbers ----
  const need = (level) => 10 + level * 8;                 // garden points to the next level
  const pointsFor = (code) => stepOf(code) * 2;            // an order's points per thing
  const coinsFor = (code) => 3 * 2 ** (stepOf(code) - 1);  // an order's coins per thing
  const sellFor = (code) => (isThing(code) ? 2 ** (stepOf(code) - 1) : 0);
  const HARVEST = { coins: 250, gems: 5 };
  // reaching a step for the first time (from the third on): gems
  const foundGems = (n) => (n >= 3 ? n * 2 : 0);
  function levelReward(level) {
    return { gems: 8 + level, coins: 20 * level, energy: 20, dust: 2, ore: 3 };
  }

  // ---- Random numbers kept in the save ----
  function rand(s) {
    s.seed = (s.seed + 0x6d2b79f5) >>> 0;
    let t = s.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const pick = (s, list) => list[Math.floor(rand(s) * list.length)];

  // ---- A new garden ----
  function create(now = Date.now(), seed = 1) {
    const board = new Array(SIZE).fill("");
    board[MAKER_SPOT.f] = "Gf";
    for (const [i, code] of [[52, "f1"], [53, "f1"], [45, "f1"], [51, "f2"]]) board[i] = code;
    const s = { v: 1, board, energy: MAX_ENERGY, stamp: now, level: 1, xp: 0, orders: [], seen: { f: 2 }, seed: seed >>> 0 || 1, rev: 0, made: 0, waiting: [] };
    while (s.orders.length < ORDERS) s.orders.push(makeOrder(s));
    return s;
  }
  const unlocked = (s) => Object.keys(CHAINS).filter(k => CHAINS[k].unlock <= s.level);

  // ---- Energy ----
  // stored as a count and the time it was last brought up to date
  function energyNow(s, now = Date.now()) {
    if (s.energy >= MAX_ENERGY) return s.energy;
    return Math.min(MAX_ENERGY, s.energy + Math.floor(Math.max(0, now - s.stamp) / REGEN));
  }
  function syncEnergy(s, now = Date.now()) {
    if (s.energy >= MAX_ENERGY) { s.stamp = now; return; }
    const gained = Math.floor(Math.max(0, now - s.stamp) / REGEN);
    if (s.energy + gained >= MAX_ENERGY) { s.energy = MAX_ENERGY; s.stamp = now; }
    else { s.energy += gained; s.stamp += gained * REGEN; }
  }
  // milliseconds to the next energy, or 0 when full
  function nextEnergyIn(s, now = Date.now()) {
    if (energyNow(s, now) >= MAX_ENERGY) return 0;
    return REGEN - (Math.max(0, now - s.stamp) % REGEN);
  }
  function addEnergy(s, n, now = Date.now()) {
    syncEnergy(s, now);
    s.energy += n;
  }

  // ---- Seen steps (the album) ----
  function see(s, code) {
    const k = code[0], n = stepOf(code);
    if ((s.seen[k] || 0) >= n) return 0;
    let gems = 0;
    for (let m = (s.seen[k] || 0) + 1; m <= n; m++) gems += foundGems(m);
    s.seen[k] = n;
    return gems;
  }

  // ---- Making ----
  // the empty cell nearest a cell, ties broken at random
  function nearestEmpty(s, from) {
    const [r0, c0] = rowCol(from);
    let best = [], bd = Infinity;
    s.board.forEach((code, i) => {
      if (code) return;
      const [r, c] = rowCol(i), d = Math.abs(r - r0) + Math.abs(c - c0) + Math.abs(r - r0) * Math.abs(c - c0) * .01;
      if (d < bd - 1e-9) { bd = d; best = [i]; } else if (Math.abs(d - bd) < 1e-9) best.push(i);
    });
    return best.length ? pick(s, best) : -1;
  }
  function produce(s, at, now = Date.now()) {
    const code = s.board[at];
    if (!isMaker(code)) return { error: "not_maker" };
    syncEnergy(s, now);
    if (s.energy < 1) return { error: "energy" };
    const to = nearestEmpty(s, at);
    if (to < 0) return { error: "full" };
    s.energy -= 1;
    const made = code[1] + (rand(s) < .15 ? 2 : 1);
    s.board[to] = made;
    s.rev++;
    return { k: "spawn", at: to, from: at, code: made, gems: see(s, made) };
  }

  // ---- Moving and joining ----
  function canJoin(a, b) { return isThing(a) && a === b && !isTop(a); }
  function move(s, from, to) {
    if (from === to || from < 0 || to < 0 || from >= SIZE || to >= SIZE) return { k: "none" };
    const a = s.board[from], b = s.board[to];
    if (!a) return { k: "none" };
    s.rev++;
    if (canJoin(a, b)) {
      const next = a[0] + (stepOf(a) + 1);
      s.board[from] = "";
      s.board[to] = next;
      s.made++;
      const gems = see(s, next);
      placeWaiting(s);
      return { k: "join", at: to, code: next, gems };
    }
    s.board[to] = a;
    s.board[from] = b || "";
    return { k: b ? "swap" : "move", at: to };
  }

  // ---- Orders ----
  // a new order unlike those already waiting, when one can be found
  function makeOrder(s) {
    let o = oneOrder(s);
    for (let tries = 0; tries < 6 && s.orders.some(x => x && x.want.join() === o.want.join()); tries++) o = oneOrder(s);
    return o;
  }
  function oneOrder(s) {
    const open = unlocked(s);
    const two = rand(s) < Math.min(.65, .15 + s.level * .06);
    const want = [];
    for (let k = 0; k < (two ? 2 : 1); k++) {
      const chain = open.length > 1 && want.length ? pick(s, open.filter(c => c !== want[0][0]).concat(open)) : pick(s, open.concat(open.slice(-1)));
      const len = CHAINS[chain].steps.length;
      // newer chains ask for less at first; the top step is for harvesting, never asked for
      const age = s.level - CHAINS[chain].unlock;
      const hi = Math.min(len - 1, 2 + Math.floor(age * .5)), lo = Math.max(1, hi - 3);
      want.push(chain + (lo + Math.floor(rand(s) * (hi - lo + 1))));
    }
    want.sort();
    const boost = 1 + s.level * .04;
    return {
      who: pick(s, FRIENDS), want,
      coins: Math.round(want.reduce((a, c) => a + coinsFor(c), 0) * boost),
      xp: want.reduce((a, c) => a + pointsFor(c), 0),
      energy: rand(s) < .2 ? 3 : 0
    };
  }
  // the cells that could fill an order, or null
  function cellsFor(s, order) {
    const used = new Set(), out = [];
    for (const code of order.want) {
      const i = s.board.findIndex((c, j) => c === code && !used.has(j));
      if (i < 0) return null;
      used.add(i);
      out.push(i);
    }
    return out;
  }
  function fill(s, n, now = Date.now()) {
    const order = s.orders[n];
    if (!order) return { error: "no_order" };
    const cells = cellsFor(s, order);
    if (!cells) return { error: "missing" };
    for (const i of cells) s.board[i] = "";
    s.rev++;
    const reward = { coins: order.coins, gems: 0, dust: 0, ore: 0, energy: order.energy, xp: order.xp, levels: [], opened: [] };
    if (order.energy) addEnergy(s, order.energy, now);
    s.xp += order.xp;
    while (s.xp >= need(s.level)) {
      s.xp -= need(s.level);
      s.level++;
      const r = levelReward(s.level);
      reward.levels.push(s.level);
      reward.gems += r.gems; reward.coins += r.coins; reward.dust += r.dust; reward.ore += r.ore; reward.energy += r.energy;
      addEnergy(s, r.energy, now);
      for (const [k, c] of Object.entries(CHAINS)) if (c.unlock === s.level) { reward.opened.push(k); s.waiting.push(k); }
    }
    placeWaiting(s);
    s.orders[n] = makeOrder(s);
    return { k: "fill", cells, ...reward };
  }
  // a friend with an order you'd rather not do goes, and another comes: one energy
  function swapOrder(s, n, now = Date.now()) {
    if (!s.orders[n]) return { error: "no_order" };
    syncEnergy(s, now);
    if (s.energy < 1) return { error: "energy" };
    s.energy -= 1;
    s.rev++;
    s.orders[n] = makeOrder(s);
    return { k: "swap_order" };
  }
  // a newly opened maker takes its spot, or the nearest free cell
  function placeWaiting(s) {
    s.waiting = (s.waiting || []).filter(k => {
      if (s.board.includes("G" + k)) return false;
      let at = MAKER_SPOT[k];
      if (s.board[at]) at = nearestEmpty(s, at);
      if (at < 0) return true;
      s.board[at] = "G" + k;
      s.seen[k] = Math.max(s.seen[k] || 0, 0);
      return false;
    });
  }

  // ---- Selling and harvesting ----
  function sell(s, at) {
    const code = s.board[at];
    if (!isThing(code) || isTop(code)) return { error: "cannot" };
    s.board[at] = "";
    s.rev++;
    placeWaiting(s);
    return { k: "sell", coins: sellFor(code) };
  }
  function harvest(s, at) {
    const code = s.board[at];
    if (!isTop(code)) return { error: "cannot" };
    s.board[at] = "";
    s.rev++;
    placeWaiting(s);
    return { k: "harvest", ...HARVEST };
  }

  // a pair that could join, for a hint
  function hintPair(s) {
    const seen = new Map();
    for (let i = 0; i < SIZE; i++) {
      const c = s.board[i];
      if (!canJoin(c, c)) continue;
      if (seen.has(c)) return [seen.get(c), i];
      seen.set(c, i);
    }
    return null;
  }

  // ---- Keeping it ----
  // a save from storage or the cloud, made safe; anything broken starts over
  function clean(raw, now = Date.now()) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.board) || raw.board.length !== SIZE) return create(now, (now % 100000) + 7);
    const board = raw.board.map(c => (isThing(c) || (isMaker(c) && CHAINS[c[1]]) ? c : ""));
    const int = (v, max, min = 0) => Math.max(min, Math.min(max, Math.floor(Number(v) || 0)));
    const s = {
      v: 1, board,
      energy: int(raw.energy, 999), stamp: Math.min(now, Number(raw.stamp) || now),
      level: int(raw.level, 99, 1), xp: int(raw.xp, 100_000),
      orders: [], seen: {}, seed: int(raw.seed, 4294967295) || 1, rev: int(raw.rev, 1e9), made: int(raw.made, 1e9),
      waiting: Array.isArray(raw.waiting) ? raw.waiting.filter(k => CHAINS[k]).slice(0, 3) : []
    };
    for (const k of Object.keys(CHAINS)) if (raw.seen?.[k]) s.seen[k] = int(raw.seen[k], CHAINS[k].steps.length);
    for (const o of Array.isArray(raw.orders) ? raw.orders.slice(0, ORDERS) : []) {
      const want = Array.isArray(o?.want) ? o.want.filter(isThing).slice(0, 3) : [];
      if (want.length) s.orders.push({ who: FRIENDS.includes(o.who) ? o.who : "pupa", want, coins: int(o.coins, 100_000), xp: int(o.xp, 1000), energy: int(o.energy, 10) });
    }
    while (s.orders.length < ORDERS) s.orders.push(makeOrder(s));
    // every opened maker is on the board (or waiting for room)
    for (const k of unlocked(s)) if (!board.includes("G" + k) && !s.waiting.includes(k)) s.waiting.push(k);
    placeWaiting(s);
    return s;
  }
  // of two copies, the one further along
  function newer(a, b) {
    if (!a) return b;
    if (!b) return a;
    const key = (x) => [x.level || 0, x.xp || 0, x.rev || 0];
    const ka = key(a), kb = key(b);
    for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return ka[i] > kb[i] ? a : b;
    return a;
  }

  return {
    COLS, ROWS, SIZE, MAX_ENERGY, REGEN, ORDERS, CHAINS, FRIENDS, HARVEST,
    isMaker, isThing, isTop, info, need, pointsFor, coinsFor, sellFor, foundGems, levelReward,
    create, unlocked, energyNow, syncEnergy, nextEnergyIn, addEnergy, produce, canJoin, move, makeOrder, cellsFor, fill, swapOrder, sell, harvest, hintPair, clean, newer
  };
});

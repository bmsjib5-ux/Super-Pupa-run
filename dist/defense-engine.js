// ปกป้องสวนเชอร์รี่ (defend the cherry garden): the rules, with no page in
// them, so Node can test them too. Monsters walk a path to the cherry tree;
// card heroes posted beside the path stop them. Each kill and each wave
// cleared brings petals, which post more heroes or train those already
// posted. A monster that reaches the tree takes some of its hearts.
//
// The field is a grid of cells 12 across and 7 down; a position is in cells,
// (0.5, 0.5) being the middle of the top-left cell. Everything steps in
// fixed 1/60 s from a seeded random source, so a game plays out the same
// way for the same moves.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaDefenseEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STEP = 1 / 60;
  const COLS = 12, ROWS = 7;
  const HEARTS = 20, START_PETALS = 150, BREAK = 12;   // seconds between waves, unless called early

  // ---- Maps ----
  // a path is its corners in cells, from where monsters come in to the tree
  const MAPS = [
    { name: "สวนหน้าบ้าน", path: [[-1, 1], [3, 1], [3, 5], [7, 5], [7, 1], [10, 1], [10, 4], [11, 4]], look: { grass: "#7cc36a", grass2: "#6fb75e", path: "#e3c48f", path2: "#d4b07a" }, foes: ["slime", "bat", "hopper", "jelly"], boss: "golem" },
    { name: "สะพานเห็ด", path: [[-1, 3], [2, 3], [2, 0], [5, 0], [5, 6], [8, 6], [8, 3], [11, 3]], look: { grass: "#5aa874", grass2: "#4f9a68", path: "#c9a37a", path2: "#b88f66" }, foes: ["spider", "roller", "rockling", "spitter"], boss: "serpent" },
    { name: "ทางเดินริมทะเลสาบ", path: [[-1, 0], [10, 0], [10, 6], [1, 6], [1, 3], [7, 3]], look: { grass: "#6cbfa0", grass2: "#5fb093", path: "#efd9a8", path2: "#e0c690" }, foes: ["crab", "urchin", "shelltortoise", "swooper"], boss: "kraken" },
    { name: "ลานหิมะ", path: [[5, -1], [5, 2], [1, 2], [1, 5], [9, 5], [9, 1], [11, 1]], look: { grass: "#dfeaf5", grass2: "#d2e0ee", path: "#a9bdd6", path2: "#98aecb" }, foes: ["wisp", "ghost", "gargoyle", "wraithhound"], boss: "icedragon" },
    { name: "ประตูหอคอย", path: [[-1, 5], [2, 5], [2, 1], [5, 1], [5, 5], [8, 5], [8, 1], [11, 1], [11, 6]], look: { grass: "#6a5a8e", grass2: "#5f5083", path: "#b9a6d8", path2: "#a893c9" }, foes: ["skullarcher", "banshee", "phantomknight", "voidassassin"], boss: "reaper" }
  ];
  // the cells a path covers, the tree's cell, and how long it is
  function layout(map) {
    const cells = [], seen = new Set();
    for (let k = 0; k + 1 < map.path.length; k++) {
      const [c0, r0] = map.path[k], [c1, r1] = map.path[k + 1];
      const n = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
      for (let i = 0; i <= n; i++) {
        const c = c0 + Math.sign(c1 - c0) * i, r = r0 + Math.sign(r1 - r0) * i;
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS || seen.has(c + "," + r)) continue;
        seen.add(c + "," + r);
        cells.push([c, r]);
      }
    }
    const pts = map.path.map(([c, r]) => [c + .5, r + .5]);
    let length = 0;
    for (let k = 0; k + 1 < pts.length; k++) length += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
    const tree = map.path[map.path.length - 1];
    return { cells, onPath: seen, pts, length, tree };
  }
  const LAYOUTS = MAPS.map(layout);
  // where a monster stands, this far along its path
  function along(lay, d) {
    const p = lay.pts;
    for (let k = 0; k + 1 < p.length; k++) {
      const seg = Math.hypot(p[k + 1][0] - p[k][0], p[k + 1][1] - p[k][1]);
      if (d <= seg || k + 2 === p.length) { const f = Math.min(1, d / seg); return [p[k][0] + (p[k + 1][0] - p[k][0]) * f, p[k][1] + (p[k + 1][1] - p[k][1]) * f]; }
      d -= seg;
    }
    return p[p.length - 1];
  }
  // a cell a hero may stand on: on the field, off the path, not the tree's
  const isPad = (lay, c, r) => c >= 0 && r >= 0 && c < COLS && r < ROWS && !lay.onPath.has(c + "," + r);

  // ---- Stages ----
  // fifteen: each map three times, harder each time
  const STAGES = [];
  for (let i = 0; i < 15; i++) STAGES.push({ map: Math.floor(i / 3), power: 1 + i * .5 + i * i * .02, waves: 8 + Math.floor(i / 3) });
  const ENDLESS_POWER = 1.6, ENDLESS_EVERY = 28;   // endless: a wave each 28 s at the latest

  // ---- Monsters ----
  const KINDS = [
    { hp: 30, speed: .9, petals: 4, from: 1 },      // plain
    { hp: 17, speed: 1.6, petals: 4, from: 3 },     // quick
    { hp: 95, speed: .58, petals: 9, from: 4 },     // heavy
    { hp: 55, speed: 1.05, petals: 6, from: 6 }     // tough
  ];
  const BOSS = { hp: 1100, speed: .42, petals: 60, hurts: 5 };
  // a wave: groups of [kind, how many, seconds apart, when it starts]
  function waveOf(w, last) {
    const groups = [[0, 4 + w, .85, 0]];
    if (w >= KINDS[1].from) groups.push([1, 2 + Math.floor(w * .8), .5, 3]);
    if (w >= KINDS[2].from) groups.push([2, 1 + Math.floor((w - 3) / 2), 1.6, 6]);
    if (w >= KINDS[3].from) groups.push([3, 2 + Math.floor((w - 5) * .8), .9, 9]);
    if (last) groups.push(["boss", 1, 0, 12]);
    return groups;
  }

  // ---- Heroes on the field ----
  // what each role does; levels 2 and 3 are bought with petals in the game
  const ROLES = {
    balance: { name: "ดาวนำทาง", icon: "⭐", text: "ยิงไกล ยิงถี่", dmg: 12, rate: .75, range: 2.7 },
    attack: { name: "ฟันประชิด", icon: "⚔️", text: "ดาเมจแรง ติดคริติคอล", dmg: 26, rate: .9, range: 1.75, crit: .2 },
    magic: { name: "ระเบิดเวท", icon: "🔮", text: "ระเบิดโดนศัตรูเป็นวง", dmg: 15, rate: 1.4, range: 2.3, splash: .95 },
    defense: { name: "วงน้ำแข็ง", icon: "❄️", text: "ทำให้ศัตรูรอบตัวช้าลง", dmg: 6, rate: 1, range: 1.7, slow: .4 },
    support: { name: "ระฆังกำลังใจ", icon: "🔔", text: "เพื่อนรอบตัวตีแรงขึ้น", dmg: 7, rate: 1, range: 2, buff: .3 }
  };
  const LEVEL_DMG = [1, 1.6, 2.4], LEVEL_RANGE = [0, .3, .6];
  // a card's strength: 2.5% a card level (at most 150%), 6% a rarity step past two
  const cardPower = (level = 1, rarity = 2) => 1 + Math.min(1.5, .025 * Math.max(0, level - 1)) + .06 * Math.max(0, rarity - 2);
  const placeCost = (rarity = 2, copies = 0) => Math.round((60 + 8 * Math.max(0, rarity - 2)) * (1 + .2 * copies));
  const upCost = (t) => Math.round(t.base * (t.lv === 1 ? .9 : 1.4));
  const towerStats = (t) => {
    const r = ROLES[t.role], lv = t.lv - 1;
    return {
      dmg: r.dmg * LEVEL_DMG[lv] * t.power, rate: r.rate * (t.lv === 3 && t.role === "balance" ? .7 : 1), range: r.range + LEVEL_RANGE[lv],
      crit: r.crit ? r.crit + (t.lv === 3 ? .15 : 0) : 0, splash: r.splash ? r.splash + (t.lv === 3 ? .3 : 0) : 0,
      slow: r.slow ? r.slow + (t.lv === 3 ? .15 : 0) : 0, buff: r.buff ? r.buff + (t.lv === 3 ? .15 : 0) : 0
    };
  };

  // ---- Random numbers ----
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---- A game ----
  // opts: { stage (1..15) or endless: map number, seed }
  function create(opts = {}) {
    const endless = opts.endless != null;
    const stage = endless ? 0 : Math.max(1, Math.min(STAGES.length, Math.floor(opts.stage) || 1));
    const def = endless ? { map: Math.max(0, Math.min(MAPS.length - 1, Math.floor(opts.endless) || 0)), power: ENDLESS_POWER, waves: Infinity } : STAGES[stage - 1];
    return {
      stage, endless, def, map: MAPS[def.map], lay: LAYOUTS[def.map], t: 0, rand: rng((opts.seed >>> 0) || 1),
      hearts: HEARTS, petals: START_PETALS + 10 * Math.max(0, stage - 1), wave: 0, calledAt: 0, waves: def.waves, spawning: [], breakLeft: -1, // -1: waiting for the first call
      enemies: [], towers: [], fx: [], kills: 0, leaks: 0, nextId: 1, over: false, won: false
    };
  }

  // ---- Posting heroes ----
  // hero: { id, role, level, rarity }
  function canPlace(s, c, r) {
    return isPad(s.lay, c, r) && !s.towers.some(t => t.c === c && t.r === r);
  }
  function costFor(s, hero) { return placeCost(hero.rarity, s.towers.filter(t => t.id === hero.id).length); }
  function place(s, hero, c, r) {
    if (s.over) return { error: "over" };
    if (!canPlace(s, c, r)) return { error: "spot" };
    const cost = costFor(s, hero);
    if (s.petals < cost) return { error: "petals" };
    s.petals -= cost;
    const t = { uid: s.nextId++, id: hero.id, art: hero.art || hero.id, role: ROLES[hero.role] ? hero.role : "balance", c, r, x: c + .5, y: r + .5, lv: 1, base: cost, spent: cost, power: cardPower(hero.level, hero.rarity), cd: .2, aim: 0, shots: 0 };
    s.towers.push(t);
    return { k: "place", tower: t };
  }
  function upgrade(s, uid) {
    const t = s.towers.find(x => x.uid === uid);
    if (!t || t.lv >= 3) return { error: "max" };
    const cost = upCost(t);
    if (s.petals < cost) return { error: "petals" };
    s.petals -= cost;
    t.spent += cost;
    t.lv++;
    return { k: "upgrade", tower: t };
  }
  const refund = (t) => Math.floor(t.spent * .7);
  function sell(s, uid) {
    const i = s.towers.findIndex(x => x.uid === uid);
    if (i < 0) return { error: "none" };
    const t = s.towers[i];
    s.petals += refund(t);
    s.towers.splice(i, 1);
    return { k: "sell", petals: refund(t) };
  }

  // ---- Waves ----
  // the next wave now: early calls pay the seconds left as petals
  function callWave(s) {
    if (s.over || s.wave >= s.waves) return { error: "none" };
    const early = s.breakLeft > 0 ? Math.floor(s.breakLeft * 2) : 0;
    s.petals += early;
    s.wave++;
    s.breakLeft = 0;
    s.calledAt = s.t;
    const last = s.wave === s.waves;
    for (const [kind, n, gap, at] of waveOf(s.wave, last)) for (let i = 0; i < n; i++) s.spawning.push({ kind, at: s.t + at + i * gap });
    // endless: a boss every fifth wave
    if (s.endless && s.wave % 5 === 0) s.spawning.push({ kind: "boss", at: s.t + 12 });
    s.spawning.sort((a, b) => a.at - b.at);
    s.fx.push({ k: "wave", n: s.wave, last });
    return { k: "wave", early };
  }
  function addEnemy(s, kind) {
    const boss = kind === "boss", k = boss ? BOSS : KINDS[kind];
    // tougher with the stage, and a little with each wave
    const hp = k.hp * s.def.power * (s.endless ? Math.pow(1.17, s.wave - 1) : 1 + (s.wave - 1) * .1);
    // and worth a little more as they grow
    const petals = Math.round(k.petals * (1 + (s.def.power - 1) * .12));
    s.enemies.push({ id: s.nextId++, kind, art: boss ? s.map.boss : s.map.foes[kind], boss, hp, maxHp: hp, speed: k.speed, petals, hurts: boss ? BOSS.hurts : 1, d: 0, x: 0, y: 0, slowFor: 0, slow: 0, flash: 0, dead: false });
  }

  // ---- One step ----
  function step(s, dt = STEP) {
    if (s.over) return s;
    s.t += dt;
    // monsters come in on time
    while (s.spawning.length && s.spawning[0].at <= s.t) addEnemy(s, s.spawning.shift().kind);
    // they walk
    for (const e of s.enemies) {
      e.flash = Math.max(0, e.flash - dt);
      if (e.slowFor > 0) e.slowFor -= dt; else e.slow = 0;
      e.d += e.speed * (1 - e.slow) * dt;
      [e.x, e.y] = along(s.lay, e.d);
      if (e.d >= s.lay.length) {
        e.dead = true;
        s.hearts = Math.max(0, s.hearts - e.hurts);
        s.leaks += e.hurts;
        s.fx.push({ k: "leak", n: e.hurts });
      }
    }
    // heroes work
    const buffOf = (t) => 1 + s.towers.reduce((a, o) => (o !== t && o.role === "support" && Math.hypot(o.x - t.x, o.y - t.y) <= towerStats(o).range ? a + towerStats(o).buff : a), 0);
    for (const t of s.towers) {
      t.cd -= dt;
      if (t.cd > 0) continue;
      const st = towerStats(t);
      const inReach = s.enemies.filter(e => !e.dead && Math.hypot(e.x - t.x, e.y - t.y) <= st.range);
      if (!inReach.length) { t.cd = .1; continue; }
      t.cd = st.rate;
      const dmg = st.dmg * buffOf(t);
      if (t.role === "defense") {
        for (const e of inReach) { hurt(s, e, dmg); e.slow = Math.max(e.slow, e.boss ? st.slow * .5 : st.slow); e.slowFor = 1.2; }
        s.fx.push({ k: "frost", uid: t.uid, x: t.x, y: t.y, R: st.range });
        continue;
      }
      // the one furthest along the path
      const target = inReach.reduce((a, b) => (b.d > a.d ? b : a));
      t.aim = Math.atan2(target.y - t.y, target.x - t.x);
      t.shots++;
      if (t.role === "magic") {
        for (const e of s.enemies) if (!e.dead && Math.hypot(e.x - target.x, e.y - target.y) <= st.splash) hurt(s, e, dmg);
        s.fx.push({ k: "shot", role: t.role, uid: t.uid, from: [t.x, t.y], to: [target.x, target.y], R: st.splash });
      } else {
        const crit = st.crit && s.rand() < st.crit;
        hurt(s, target, dmg * (crit ? 2 : 1));
        s.fx.push({ k: "shot", role: t.role, uid: t.uid, from: [t.x, t.y], to: [target.x, target.y], crit });
        // a top-level star hero throws a second star at the next one along
        if (t.role === "balance" && t.lv === 3) {
          const next = inReach.filter(e => e !== target && !e.dead).sort((a, b) => b.d - a.d)[0];
          if (next) { hurt(s, next, dmg); s.fx.push({ k: "shot", role: t.role, uid: t.uid, from: [t.x, t.y], to: [next.x, next.y] }); }
        }
      }
    }
    s.enemies = s.enemies.filter(e => !e.dead);
    // between waves
    if (!s.spawning.length && !s.enemies.length && s.wave > 0 && s.breakLeft === 0) {
      const bonus = 15 + s.wave * 3;
      s.petals += bonus;
      s.fx.push({ k: "cleared", n: s.wave, bonus });
      if (s.wave >= s.waves) { s.over = true; s.won = true; s.fx.push({ k: "win" }); return s; }
      s.breakLeft = BREAK;
    }
    if (s.breakLeft > 0) {
      s.breakLeft -= dt;
      if (s.breakLeft <= 0) { s.breakLeft = 0; callWave(s); }
    }
    // endless: the waves keep coming, cleared or not
    if (s.endless && s.wave > 0 && s.t - s.calledAt >= ENDLESS_EVERY) callWave(s);
    if (s.hearts <= 0) { s.over = true; s.won = false; s.fx.push({ k: "lose" }); }
    return s;
  }
  function hurt(s, e, dmg) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = .1;
    if (e.hp <= 0) {
      e.dead = true;
      s.kills++;
      s.petals += e.petals;
      s.fx.push({ k: "kill", x: e.x, y: e.y, petals: e.petals, boss: e.boss });
    }
  }
  function takeFx(s) { const out = s.fx; s.fx = []; return out; }

  // ---- Results ----
  // ★★★ the tree keeps 15 hearts or more, ★★ 10 or more, ★ any
  function starsFor(s) {
    if (!s.won) return 0;
    return s.hearts >= 15 ? 3 : s.hearts >= 10 ? 2 : 1;
  }
  function rewardFor(stage, first, stars, before = 0) {
    return { coins: Math.round((40 + 10 * stage) * (first ? 1 : .5)), gems: (first ? 15 : 0) + (stars === 3 && before < 3 ? 10 : 0), dust: first ? 3 : 0, ore: first ? 5 : 0 };
  }
  // endless: coins by the waves held; gems for each five waves past the best
  function endlessReward(waves, best = 0) {
    return { coins: waves * 12, gems: Math.max(0, Math.floor(waves / 5) - Math.floor(best / 5)) * 5 };
  }

  return {
    STEP, COLS, ROWS, HEARTS, START_PETALS, BREAK, MAPS, LAYOUTS, STAGES, KINDS, BOSS, ROLES,
    along, isPad, waveOf, cardPower, placeCost, upCost, towerStats, refund,
    create, canPlace, costFor, place, upgrade, sell, callWave, step, takeFx, starsFor, rewardFor, endlessReward
  };
});

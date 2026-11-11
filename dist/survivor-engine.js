// Pupa ผู้รอดชีวิต (survivor): the rules, with no page in them, so Node can
// test them too. Pupa (or a card hero) walks an open field while monsters
// close in from every side; her weapons fire on their own. Fallen monsters
// leave crystals, crystals fill the level bar, and each level brings a pick
// of three: a new weapon, a stronger one, or a charm. The stage's boss comes
// at 4:00; beat it to clear the stage.
//
// Everything runs in fixed steps of 1/60 s from a seeded random source, so a
// run plays out the same way for the same inputs. World units are about a
// screen pixel at zoom 1.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaSurvivorEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const STEP = 1 / 60;
  const BOSS_AT = 240;          // seconds into a run
  const WEAPON_SLOTS = 4, CHARM_SLOTS = 4, MAX_LEVEL = 5;

  // ---- Stages ----
  // foes: the four kinds in the order they join (see KINDS); elite comes
  // twice a run and drops a chest; boss ends it.
  const STAGES = [
    { name: "สวนเชอร์รี่ยามค่ำ", foes: ["slime", "bat", "hopper", "jelly"], elite: "mimic", boss: "golem", power: 1, look: { ground: "#2a2350", dots: "#3d3270", petal: "#ffb3d1" } },
    { name: "ป่าเห็ดเรืองแสง", foes: ["spider", "roller", "rockling", "spitter"], elite: "gearspider", boss: "serpent", power: 1.7, look: { ground: "#1d3328", dots: "#2b4a3a", petal: "#9dffb5" } },
    { name: "ทะเลสาบจันทร์", foes: ["crab", "urchin", "shelltortoise", "swooper"], elite: "medusa", boss: "kraken", power: 2.6, look: { ground: "#16304a", dots: "#22476a", petal: "#9fe4ff" } },
    { name: "ยอดเขาหิมะ", foes: ["wisp", "ghost", "gargoyle", "wraithhound"], elite: "griffin", boss: "icedragon", power: 3.8, look: { ground: "#33405a", dots: "#4a5878", petal: "#ffffff" } },
    { name: "หอคอยราตรี", foes: ["skullarcher", "banshee", "phantomknight", "voidassassin"], elite: "lichking", boss: "reaper", power: 5.4, look: { ground: "#24142e", dots: "#3a2148", petal: "#d59bff" } }
  ];
  // the four kinds of a stage: when each joins, and its build
  const KINDS = [
    { from: 0, hp: 10, speed: 60, r: 17, dmg: 5, xp: 1 },     // plain
    { from: 40, hp: 7, speed: 100, r: 15, dmg: 4, xp: 1 },   // quick
    { from: 80, hp: 38, speed: 48, r: 24, dmg: 11, xp: 3 },  // heavy
    { from: 130, hp: 20, speed: 78, r: 19, dmg: 9, xp: 2 }   // tough
  ];
  const ELITE = { hp: 420, speed: 70, r: 36, dmg: 16 };
  const BOSS = { hp: 3200, speed: 56, r: 58, dmg: 22 };
  const ELITE_AT = [110, 200];
  // a ring of monsters closes in at these times: [when, kind, how many]
  const RINGS = [[70, 0, 16], [150, 1, 26], [215, 3, 32]];

  // ---- Weapons ----
  // Each has five levels. dmg is per hit; cd seconds between uses.
  const WEAPONS = {
    bolt: { name: "ดาวนำทาง", icon: "⭐", text: "ยิงดาวพุ่งใส่ศัตรูที่อยู่ใกล้ที่สุด",
      levels: [{ dmg: 14, cd: .8, count: 1, pierce: 1 }, { dmg: 15, cd: .8, count: 2, pierce: 1 }, { dmg: 17, cd: .8, count: 2, pierce: 2 }, { dmg: 20, cd: .7, count: 3, pierce: 2 }, { dmg: 25, cd: .6, count: 4, pierce: 3 }] },
    slash: { name: "ดาบจันทร์เสี้ยว", icon: "🗡️", text: "ฟันเป็นวงโค้งไปทางที่หันหน้า",
      levels: [{ dmg: 20, cd: 1.15, range: 100, arc: 2.1, both: false }, { dmg: 25, cd: 1.1, range: 108, arc: 2.2, both: false }, { dmg: 28, cd: 1.05, range: 112, arc: 2.3, both: true }, { dmg: 34, cd: .95, range: 120, arc: 2.4, both: true }, { dmg: 42, cd: .85, range: 132, arc: 2.6, both: true }] },
    orbit: { name: "จันทร์บริวาร", icon: "🌙", text: "ดวงจันทร์หมุนรอบตัว ชนศัตรูที่เข้าใกล้",
      levels: [{ dmg: 10, count: 2, radius: 78, spin: 3.2 }, { dmg: 12, count: 3, radius: 82, spin: 3.4 }, { dmg: 15, count: 3, radius: 90, spin: 3.6 }, { dmg: 18, count: 4, radius: 96, spin: 3.8 }, { dmg: 22, count: 5, radius: 104, spin: 4.2 }] },
    lightning: { name: "สายฟ้าฟาด", icon: "⚡", text: "ฟ้าผ่าลงศัตรูรอบตัวแบบสุ่ม",
      levels: [{ dmg: 26, cd: 1.5, count: 2, area: 42 }, { dmg: 30, cd: 1.4, count: 3, area: 46 }, { dmg: 36, cd: 1.3, count: 3, area: 52 }, { dmg: 42, cd: 1.2, count: 4, area: 56 }, { dmg: 52, cd: 1.05, count: 5, area: 62 }] },
    aura: { name: "ออร่าซากุระ", icon: "🌸", text: "กลีบซากุระรอบตัวทำร้ายศัตรูต่อเนื่อง",
      levels: [{ dmg: 7, tick: .5, radius: 72 }, { dmg: 9, tick: .48, radius: 80 }, { dmg: 11, tick: .45, radius: 90 }, { dmg: 13, tick: .42, radius: 100 }, { dmg: 16, tick: .38, radius: 114 }] },
    leaf: { name: "ใบไม้บูมเมอแรง", icon: "🍃", text: "ขว้างใบไม้ทะลุศัตรู แล้วบินวนกลับมา",
      levels: [{ dmg: 16, cd: 1.4, count: 1, range: 230 }, { dmg: 19, cd: 1.35, count: 2, range: 240 }, { dmg: 23, cd: 1.3, count: 2, range: 260 }, { dmg: 27, cd: 1.2, count: 3, range: 270 }, { dmg: 33, cd: 1.1, count: 4, range: 290 }] },
    bomb: { name: "ระเบิดเชอร์รี่", icon: "🍒", text: "โยนระเบิดลงกลางฝูงศัตรู",
      levels: [{ dmg: 32, cd: 2.2, count: 1, area: 72 }, { dmg: 38, cd: 2.1, count: 2, area: 76 }, { dmg: 46, cd: 2, count: 2, area: 84 }, { dmg: 54, cd: 1.85, count: 3, area: 90 }, { dmg: 66, cd: 1.7, count: 3, area: 100 }] }
  };
  // ---- Charms ----
  const CHARMS = {
    heart: { name: "หัวใจไหมชมพู", icon: "❤️", text: "พลังชีวิตสูงสุด +20% และฟื้นพลังทันที" },
    boots: { name: "รองเท้าลม", icon: "👟", text: "เดินเร็วขึ้น +10%" },
    power: { name: "พลังดาว", icon: "💪", text: "พลังโจมตี +10%" },
    clock: { name: "นาฬิกาทราย", icon: "⏳", text: "ใช้สกิลถี่ขึ้น (คูลดาวน์ -8%)" },
    magnet: { name: "แม่เหล็กผลึก", icon: "🧲", text: "ดูดผลึกได้ไกลขึ้น +35%" },
    lens: { name: "เลนส์จันทร์", icon: "🔮", text: "สกิลใหญ่ขึ้น +12%" },
    shell: { name: "เกราะเปลือกหอย", icon: "🛡️", text: "ลดดาเมจที่ได้รับ -1 และฟื้นพลัง 0.3/วินาที" }
  };
  // ---- Blessings ----
  // Bought with coins between runs; each of five levels.
  const PERKS = {
    hp: { name: "พรแห่งชีวิต", icon: "❤️", text: "พลังชีวิต +8% ต่อระดับ", per: .08 },
    atk: { name: "พรแห่งพลัง", icon: "⚔️", text: "พลังโจมตี +6% ต่อระดับ", per: .06 },
    speed: { name: "พรแห่งสายลม", icon: "👟", text: "เดินเร็ว +4% ต่อระดับ", per: .04 },
    magnet: { name: "พรแห่งผลึก", icon: "🧲", text: "ระยะดูดผลึก +15% ต่อระดับ", per: .15 },
    xp: { name: "พรแห่งปัญญา", icon: "✨", text: "ค่าประสบการณ์ +6% ต่อระดับ", per: .06 }
  };
  const PERK_COST = [150, 300, 500, 800, 1200];
  const perkCost = (lv) => (lv >= PERK_COST.length ? null : PERK_COST[lv]);

  // ---- Heroes ----
  // A card hero brings the weapon of its role, a touch of that role's
  // strength, and its card level (1% a level, at most 60%).
  const CLOSE_IN = new Set(["slash", "orbit", "aura"]);
  const ROLE_WEAPON = { balance: "bolt", attack: "slash", defense: "orbit", magic: "lightning", support: "aura" };
  const ROLE_TEXT = { balance: "สมดุล · พลังชีวิตและโจมตี +5%", attack: "บุก · โจมตี +15%", defense: "ป้องกัน · พลังชีวิต +30% ลดดาเมจ -1", magic: "เวท · สกิลใหญ่ +10% ถี่ขึ้น 5%", support: "สนับสนุน · ฟื้นพลัง 0.5/วินาที ดูดผลึกไกล +20%" };
  function heroStats(role = "balance", level = 1, rarity = 2) {
    const lv = 1 + Math.min(.6, .01 * Math.max(0, level - 1)) + .03 * Math.max(0, rarity - 2);
    const s = { weapon: ROLE_WEAPON[role] || "bolt", hp: lv, dmg: lv, speed: 1, area: 1, cd: 1, armor: 0, regen: 0, magnet: 1 };
    if (role === "balance") { s.hp *= 1.05; s.dmg *= 1.05; }
    if (role === "attack") s.dmg *= 1.15;
    if (role === "defense") { s.hp *= 1.3; s.armor = 1; }
    if (role === "magic") { s.area = 1.1; s.cd = .95; }
    if (role === "support") { s.regen = .5; s.magnet = 1.2; }
    return s;
  }

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

  // the crystals needed to go from level L to L + 1
  const need = (L) => Math.round(4 + 3 * L + .3 * L * L);

  // ---- A run ----
  // opts: { stage (1..5), hero: { role, level, rarity, art }, perks: { hp, atk, ... }, seed }
  function create(opts = {}) {
    const stage = Math.max(1, Math.min(STAGES.length, Math.floor(opts.stage) || 1));
    const def = STAGES[stage - 1];
    const hero = opts.hero || {};
    const h = heroStats(hero.role, hero.level, hero.rarity);
    const perk = (k) => Math.max(0, Math.min(5, Math.floor(Number(opts.perks?.[k]) || 0))) * PERKS[k].per;
    const maxHp = Math.round(100 * h.hp * (1 + perk("hp")));
    const s = {
      stage, def, t: 0, seed: (opts.seed >>> 0) || 1, rand: rng((opts.seed >>> 0) || 1),
      view: { w: 1000, h: 640 },
      player: {
        x: 0, y: 0, r: 18, hp: maxHp, maxHp, fx: 1, fy: 0, moving: false,
        base: { hp: maxHp, dmg: h.dmg * (1 + perk("atk")), speed: 150 * (1 + perk("speed")), area: h.area, cd: h.cd, armor: h.armor, regen: h.regen, magnet: 100 * h.magnet * (1 + perk("magnet")), xp: 1 + perk("xp") },
        dmg: 1, speed: 150, area: 1, cd: 1, armor: 0, regen: 0, magnet: 100, xpMul: 1, hurt: 0, grace: 0
      },
      // a hero whose own weapon is close-in also brings a star to throw
      weapons: [{ id: h.weapon, lv: 1, cd: .3, angle: 0, tick: 0 }, ...(CLOSE_IN.has(h.weapon) ? [{ id: "bolt", lv: 1, cd: .5, angle: 0, tick: 0 }] : [])],
      charms: [],
      level: 1, xp: 0, pending: 0, offer: null,
      enemies: [], shots: [], bullets: [], gems: [], items: [], fx: [],
      spawnClock: 0, ringsDone: 0, elitesDone: 0, boss: null, bossDown: false,
      kills: 0, dealt: 0, taken: 0, nextId: 1,
      over: false, won: false
    };
    refresh(s);
    return s;
  }
  function setView(s, w, h) { s.view = { w: Math.max(200, w), h: Math.max(200, h) }; }
  const spawnRadius = (s) => Math.hypot(s.view.w, s.view.h) / 2 + 60;

  // the player's numbers from the hero, blessings and charms
  function refresh(s) {
    const p = s.player, b = p.base;
    const lv = (id) => s.charms.find(c => c.id === id)?.lv || 0;
    const before = p.maxHp;
    p.maxHp = Math.round(b.hp * (1 + .2 * lv("heart")));
    if (p.maxHp > before) p.hp += p.maxHp - before;
    p.hp = Math.min(p.hp, p.maxHp);
    p.speed = b.speed * (1 + .1 * lv("boots"));
    p.dmg = b.dmg * (1 + .1 * lv("power"));
    p.cd = b.cd * Math.pow(.92, lv("clock"));
    p.magnet = b.magnet * (1 + .35 * lv("magnet"));
    p.area = b.area * (1 + .12 * lv("lens"));
    p.armor = b.armor + lv("shell");
    p.regen = b.regen + .3 * lv("shell");
    p.xpMul = b.xp;
  }

  // ---- Monsters ----
  function addEnemy(s, kind, x, y) {
    const def = s.def, grow = 1 + s.t / 100;
    let e;
    if (kind === "elite") e = { kind, art: def.elite, hp: ELITE.hp * def.power * grow, speed: ELITE.speed, r: ELITE.r, dmg: ELITE.dmg * Math.sqrt(def.power), xp: 0 };
    else if (kind === "boss") e = { kind, art: def.boss, hp: BOSS.hp * def.power, speed: BOSS.speed, r: BOSS.r, dmg: BOSS.dmg * Math.sqrt(def.power), xp: 0, burst: 3.5, dash: 6, dashing: 0 };
    else {
      const k = KINDS[kind];
      e = { kind, art: def.foes[kind], hp: k.hp * def.power * grow, speed: k.speed * (1 + Math.min(.25, s.t / 960)), r: k.r, dmg: k.dmg * Math.sqrt(def.power), xp: k.xp };
    }
    e.id = s.nextId++;
    e.x = x; e.y = y; e.maxHp = e.hp; e.hitCd = 0; e.flash = 0; e.kx = 0; e.ky = 0; e.orbitCd = 0; e.dead = false;
    s.enemies.push(e);
    return e;
  }
  function edgeSpot(s) {
    const a = s.rand() * Math.PI * 2, d = spawnRadius(s) + s.rand() * 80;
    return [s.player.x + Math.cos(a) * d, s.player.y + Math.sin(a) * d];
  }
  function spawn(s, dt) {
    const t = s.t, p = s.player;
    // rings
    while (s.ringsDone < RINGS.length && t >= RINGS[s.ringsDone][0]) {
      const [, kind, n] = RINGS[s.ringsDone++], d = spawnRadius(s) - 20;
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; addEnemy(s, kind, p.x + Math.cos(a) * d, p.y + Math.sin(a) * d); }
      s.fx.push({ k: "ring" });
    }
    // elites
    while (s.elitesDone < ELITE_AT.length && t >= ELITE_AT[s.elitesDone]) {
      s.elitesDone++;
      addEnemy(s, "elite", ...edgeSpot(s));
      s.fx.push({ k: "elite" });
    }
    // the boss
    if (!s.boss && t >= BOSS_AT) {
      s.boss = addEnemy(s, "boss", ...edgeSpot(s));
      s.fx.push({ k: "boss" });
    }
    // the crowd: keep about this many about
    const want = Math.min(230, 10 + t * .75) * (s.boss ? .55 : 1);
    s.spawnClock -= dt;
    if (s.spawnClock > 0) return;
    s.spawnClock = .2;
    const plain = s.enemies.length - (s.boss ? 1 : 0);
    let room = Math.min(3 + Math.floor(t / 60), Math.ceil(want - plain));
    const kinds = KINDS.map((k, i) => (t >= k.from ? i : -1)).filter(i => i >= 0);
    while (room-- > 0) {
      // newer kinds come a little more often as the run goes on
      const pick = kinds[Math.min(kinds.length - 1, Math.floor(Math.pow(s.rand(), .8) * kinds.length))];
      addEnemy(s, pick, ...edgeSpot(s));
    }
  }

  // a grid of the monsters, so hits only check those nearby
  const CELL = 64;
  function grid(s) {
    const g = new Map();
    for (const e of s.enemies) {
      if (e.dead) continue;
      const k = ((Math.floor(e.x / CELL) & 0xffff) << 16) | (Math.floor(e.y / CELL) & 0xffff);
      let list = g.get(k);
      if (!list) g.set(k, list = []);
      list.push(e);
    }
    s.grid = g;
  }
  function near(s, x, y, r, each) {
    const x0 = Math.floor((x - r - 60) / CELL), x1 = Math.floor((x + r + 60) / CELL), y0 = Math.floor((y - r - 60) / CELL), y1 = Math.floor((y + r + 60) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const list = s.grid.get(((cx & 0xffff) << 16) | (cy & 0xffff));
      if (!list) continue;
      for (const e of list) if (!e.dead && Math.hypot(e.x - x, e.y - y) <= r + e.r) each(e);
    }
  }
  function nearest(s, x, y, skip) {
    let best = null, bd = Infinity;
    for (const e of s.enemies) {
      if (e.dead || (skip && skip.has(e))) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function hurtEnemy(s, e, dmg, push = 0, fromX = 0, fromY = 0) {
    if (e.dead) return;
    e.hp -= dmg;
    s.dealt += dmg;
    e.flash = .12;
    if (push && e.kind !== "boss") {
      const d = Math.hypot(e.x - fromX, e.y - fromY) || 1;
      e.kx += (e.x - fromX) / d * push * (e.kind === "elite" ? .3 : 1);
      e.ky += (e.y - fromY) / d * push * (e.kind === "elite" ? .3 : 1);
    }
    s.fx.push({ k: "hit", x: e.x, y: e.y - e.r, n: Math.round(dmg) });
    if (e.hp <= 0) kill(s, e);
  }
  function kill(s, e) {
    e.dead = true;
    s.kills++;
    s.fx.push({ k: "kill", x: e.x, y: e.y, art: e.art, r: e.r });
    if (e.kind === "boss") { s.bossDown = true; return; }
    if (e.kind === "elite") { s.items.push({ k: "chest", x: e.x, y: e.y }); return; }
    // a crystal, now and then a heart or a magnet
    const roll = s.rand();
    if (roll < .006) s.items.push({ k: "heal", x: e.x, y: e.y });
    else if (roll < .009) s.items.push({ k: "magnet", x: e.x, y: e.y });
    if (s.gems.length > 320) {
      const g = s.gems[Math.floor(s.rand() * s.gems.length)];
      g.v += e.xp;
    } else s.gems.push({ x: e.x, y: e.y, v: e.xp, pull: false });
  }

  // ---- Weapons at work ----
  const stats = (w) => WEAPONS[w.id].levels[w.lv - 1];
  function useWeapons(s, dt) {
    const p = s.player;
    for (const w of s.weapons) {
      const st = stats(w), dmg = st.dmg * p.dmg;
      if (w.id === "orbit") {
        w.angle += st.spin * dt;
        const R = st.radius * p.area;
        for (let i = 0; i < st.count; i++) {
          const a = w.angle + i / st.count * Math.PI * 2, ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R;
          near(s, ox, oy, 15 * p.area, (e) => { if (e.orbitCd <= 0) { e.orbitCd = .45; hurtEnemy(s, e, dmg, 10, p.x, p.y); } });
        }
        continue;
      }
      if (w.id === "aura") {
        w.tick -= dt;
        if (w.tick > 0) continue;
        w.tick = st.tick * p.cd;
        near(s, p.x, p.y, st.radius * p.area, (e) => hurtEnemy(s, e, dmg, 0));
        continue;
      }
      w.cd -= dt;
      if (w.cd > 0) continue;
      w.cd = st.cd * p.cd;
      if (w.id === "bolt") {
        const used = new Set();
        let fired = 0;
        for (let i = 0; i < st.count; i++) {
          const e = nearest(s, p.x, p.y, used) || nearest(s, p.x, p.y);
          if (!e) break;
          used.add(e);
          const ax = Math.atan2(e.y - p.y, e.x - p.x) + (i - (st.count - 1) / 2) * .08;
          s.shots.push({ k: "bolt", x: p.x, y: p.y, vx: Math.cos(ax) * 470, vy: Math.sin(ax) * 470, r: 9 * p.area, dmg, pierce: st.pierce, life: 1.4, hit: new Set() });
          fired++;
        }
        if (fired) s.fx.push({ k: "shoot" });
      } else if (w.id === "slash") {
        // swung at the nearest monster in reach (else the way Pupa faces)
        const R = st.range * p.area, dirs = st.both ? [0, Math.PI] : [0];
        const target = nearest(s, p.x, p.y);
        const face = target && Math.hypot(target.x - p.x, target.y - p.y) < R * 1.6 ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(p.fy, p.fx);
        for (const off of dirs) {
          const a = face + off;
          s.shots.push({ k: "slash", x: p.x, y: p.y, a, R, arc: st.arc, life: .2, max: .2 });
          near(s, p.x, p.y, R, (e) => {
            let da = Math.atan2(e.y - p.y, e.x - p.x) - a;
            da = Math.atan2(Math.sin(da), Math.cos(da));
            if (Math.abs(da) <= st.arc / 2 + .15) hurtEnemy(s, e, dmg, 22, p.x, p.y);
          });
        }
        s.fx.push({ k: "swing" });
      } else if (w.id === "lightning") {
        const reach = Math.min(s.view.w, s.view.h) * .62 + 80;
        const pool = s.enemies.filter(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < reach);
        let struck = 0;
        for (let i = 0; i < st.count && pool.length; i++, struck++) {
          const e = pool.splice(Math.floor(s.rand() * pool.length), 1)[0];
          const x = e.x, y = e.y;
          near(s, x, y, st.area * p.area, (o) => hurtEnemy(s, o, dmg, 0));
          s.shots.push({ k: "zap", x, y, R: st.area * p.area, life: .25, max: .25 });
        }
        if (struck) s.fx.push({ k: "zap" });
      } else if (w.id === "leaf") {
        const target = nearest(s, p.x, p.y);
        const face = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.atan2(p.fy, p.fx);
        for (let i = 0; i < st.count; i++) {
          const a = face + (i - (st.count - 1) / 2) * .5;
          s.shots.push({ k: "leaf", x: p.x, y: p.y, a, vx: Math.cos(a) * 420, vy: Math.sin(a) * 420, r: 16 * p.area, dmg, out: st.range, gone: 0, back: false, life: 3, hit: new Set(), spin: 0 });
        }
        s.fx.push({ k: "swing" });
      } else if (w.id === "bomb") {
        const reach = Math.min(s.view.w, s.view.h) * .55 + 60;
        const pool = s.enemies.filter(e => !e.dead && Math.hypot(e.x - p.x, e.y - p.y) < reach);
        for (let i = 0; i < st.count; i++) {
          const e = pool.length ? pool[Math.floor(s.rand() * pool.length)] : null;
          const tx = e ? e.x : p.x + (s.rand() - .5) * 300, ty = e ? e.y : p.y + (s.rand() - .5) * 300;
          s.shots.push({ k: "bomb", x: p.x, y: p.y, sx: p.x, sy: p.y, tx, ty, R: st.area * p.area, dmg, life: .55, max: .55 });
        }
      }
    }
  }
  function moveShots(s, dt) {
    const p = s.player;
    for (const sh of s.shots) {
      sh.life -= dt;
      if (sh.k === "bolt") {
        sh.x += sh.vx * dt; sh.y += sh.vy * dt;
        near(s, sh.x, sh.y, sh.r, (e) => {
          if (sh.pierce <= 0 || sh.hit.has(e)) return;
          sh.hit.add(e);
          sh.pierce--;
          hurtEnemy(s, e, sh.dmg, 12, sh.x - sh.vx * .02, sh.y - sh.vy * .02);
        });
        if (sh.pierce <= 0) sh.life = 0;
      } else if (sh.k === "slash") {
        sh.x = p.x; sh.y = p.y;
      } else if (sh.k === "leaf") {
        sh.spin += dt * 14;
        if (!sh.back) {
          sh.x += sh.vx * dt; sh.y += sh.vy * dt;
          sh.gone += Math.hypot(sh.vx, sh.vy) * dt;
          if (sh.gone >= sh.out) { sh.back = true; sh.hit.clear(); }
        } else {
          const d = Math.hypot(p.x - sh.x, p.y - sh.y) || 1;
          sh.x += (p.x - sh.x) / d * 480 * dt; sh.y += (p.y - sh.y) / d * 480 * dt;
          if (d < 20) sh.life = 0;
        }
        near(s, sh.x, sh.y, sh.r, (e) => { if (!sh.hit.has(e)) { sh.hit.add(e); hurtEnemy(s, e, sh.dmg, 14, sh.x, sh.y); } });
      } else if (sh.k === "bomb") {
        const f = 1 - Math.max(0, sh.life) / sh.max;
        sh.x = sh.sx + (sh.tx - sh.sx) * f; sh.y = sh.sy + (sh.ty - sh.sy) * f;
        if (sh.life <= 0) {
          near(s, sh.tx, sh.ty, sh.R, (e) => hurtEnemy(s, e, sh.dmg, 26, sh.tx, sh.ty));
          s.shots.push({ k: "boom", x: sh.tx, y: sh.ty, R: sh.R, life: .3, max: .3 });
          s.fx.push({ k: "boom" });
        }
      }
    }
    s.shots = s.shots.filter(sh => sh.life > 0);
  }

  // ---- The monsters move ----
  function moveEnemies(s, dt) {
    const p = s.player, far = spawnRadius(s) * 1.6;
    for (const e of s.enemies) {
      if (e.dead) continue;
      e.flash = Math.max(0, e.flash - dt);
      e.hitCd = Math.max(0, e.hitCd - dt);
      e.orbitCd = Math.max(0, e.orbitCd - dt);
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      // stragglers left far behind come round again ahead
      if (d > far && e.kind !== "boss" && e.kind !== "elite") {
        const [x, y] = edgeSpot(s);
        e.x = x; e.y = y;
        continue;
      }
      let speed = e.speed;
      if (e.kind === "boss") {
        e.burst -= dt; e.dash -= dt;
        if (e.burst <= 0) {
          e.burst = 4.2;
          const n = 14, off = s.rand() * Math.PI;
          for (let i = 0; i < n; i++) { const a = off + i / n * Math.PI * 2; s.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 9, dmg: e.dmg * .55, life: 5 }); }
          s.fx.push({ k: "burst" });
        }
        if (e.dash <= 0) { e.dash = 7; e.dashing = .7; e.dx = dx / d; e.dy = dy / d; s.fx.push({ k: "dash" }); }
        if (e.dashing > 0) { e.dashing -= dt; e.x += e.dx * 300 * dt; e.y += e.dy * 300 * dt; speed = 0; }
      }
      e.x += (dx / d * speed + e.kx) * dt;
      e.y += (dy / d * speed + e.ky) * dt;
      e.kx *= Math.pow(.0015, dt); e.ky *= Math.pow(.0015, dt);
      // touching Pupa (a moment's grace after each hit, so a crowd can't melt her at once)
      if (d < e.r + p.r && e.hitCd <= 0 && p.grace <= 0) {
        e.hitCd = .5; p.grace = .12;
        const dmg = Math.max(1, e.dmg - p.armor);
        p.hp -= dmg; s.taken += dmg; p.hurt = .25;
        s.fx.push({ k: "hurt", n: Math.round(dmg) });
      }
    }
    // a light push apart, so the crowd spreads instead of stacking
    grid(s);
    for (const e of s.enemies) {
      if (e.dead || e.kind === "boss") continue;
      near(s, e.x, e.y, e.r, (o) => {
        if (o === e || o.kind === "boss") return;
        const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || .01, gap = e.r + o.r - d;
        if (gap > 0) { e.x += dx / d * gap * .25; e.y += dy / d * gap * .25; }
      });
    }
    s.enemies = s.enemies.filter(e => !e.dead);
  }
  function moveBullets(s, dt) {
    const p = s.player;
    for (const b of s.bullets) {
      b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
      if (Math.hypot(b.x - p.x, b.y - p.y) < b.r + p.r * .8) {
        b.life = 0;
        const dmg = Math.max(1, b.dmg - p.armor);
        p.hp -= dmg; s.taken += dmg; p.hurt = .25;
        s.fx.push({ k: "hurt", n: Math.round(dmg) });
      }
    }
    s.bullets = s.bullets.filter(b => b.life > 0);
  }

  // ---- Crystals and finds ----
  function collect(s, dt) {
    const p = s.player;
    for (const g of s.gems) {
      const d = Math.hypot(p.x - g.x, p.y - g.y);
      if (d < p.magnet) g.pull = true;
      if (g.pull) {
        const sp = Math.max(260, 620 - d) * dt;
        g.x += (p.x - g.x) / (d || 1) * Math.min(sp, d); g.y += (p.y - g.y) / (d || 1) * Math.min(sp, d);
        if (d < p.r + 6) { g.v = -g.v; gainXp(s, -g.v); }
      }
    }
    s.gems = s.gems.filter(g => g.v > 0);
    for (const it of s.items) {
      if (Math.hypot(p.x - it.x, p.y - it.y) > p.r + 22) continue;
      it.taken = true;
      if (it.k === "heal") { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .3); s.fx.push({ k: "heal" }); }
      if (it.k === "magnet") { for (const g of s.gems) g.pull = true; s.fx.push({ k: "magnet" }); }
      if (it.k === "chest") { s.pending++; s.fx.push({ k: "chest" }); if (!s.offer) s.offer = offers(s); }
    }
    s.items = s.items.filter(it => !it.taken);
  }
  function gainXp(s, v) {
    s.xp += v * s.player.xpMul;
    while (s.xp >= need(s.level)) {
      s.xp -= need(s.level);
      s.level++;
      s.pending++;
      s.fx.push({ k: "level" });
    }
    if (s.pending && !s.offer) s.offer = offers(s);
  }

  // ---- Level-ups ----
  // Three picks: what is held, stronger, or something new while there is room.
  function offers(s) {
    const pool = [];
    for (const w of s.weapons) if (w.lv < MAX_LEVEL) pool.push({ k: "weapon", id: w.id, lv: w.lv + 1, weight: 1.3 });
    if (s.weapons.length < WEAPON_SLOTS) for (const id of Object.keys(WEAPONS)) if (!s.weapons.some(w => w.id === id)) pool.push({ k: "weapon", id, lv: 1, weight: 1 });
    for (const c of s.charms) if (c.lv < MAX_LEVEL) pool.push({ k: "charm", id: c.id, lv: c.lv + 1, weight: 1.1 });
    if (s.charms.length < CHARM_SLOTS) for (const id of Object.keys(CHARMS)) if (!s.charms.some(c => c.id === id)) pool.push({ k: "charm", id, lv: 1, weight: .9 });
    const out = [];
    while (out.length < 3 && pool.length) {
      const total = pool.reduce((a, o) => a + o.weight, 0);
      let r = s.rand() * total, i = 0;
      while (i < pool.length - 1 && (r -= pool[i].weight) > 0) i++;
      const o = pool.splice(i, 1)[0];
      delete o.weight;
      out.push(o);
    }
    if (!out.length) out.push({ k: "heal" }, { k: "gold" });
    return out;
  }
  function choose(s, n) {
    if (!s.pending || !s.offer) return false;
    const o = s.offer[n];
    if (!o) return false;
    if (o.k === "weapon") {
      const w = s.weapons.find(x => x.id === o.id);
      if (w) w.lv = o.lv;
      else s.weapons.push({ id: o.id, lv: 1, cd: .2, angle: 0, tick: 0 });
    } else if (o.k === "charm") {
      const c = s.charms.find(x => x.id === o.id);
      if (c) c.lv = o.lv;
      else s.charms.push({ id: o.id, lv: 1 });
      if (o.id === "heart") s.player.hp = Math.min(s.player.maxHp * 1.2, s.player.hp + s.player.maxHp * .2);
    } else if (o.k === "heal") s.player.hp = s.player.maxHp;
    else if (o.k === "gold") s.bonusCoins = (s.bonusCoins || 0) + 25;
    refresh(s);
    s.pending--;
    s.offer = s.pending ? offers(s) : null;
    return true;
  }

  // ---- One step ----
  // input: { x, y }, a direction no longer than 1.
  function step(s, input = {}, dt = STEP) {
    if (s.over || s.pending) return s;
    const p = s.player;
    s.t += dt;
    let ix = Number(input.x) || 0, iy = Number(input.y) || 0;
    const len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    p.moving = len > .05;
    if (p.moving) { p.fx = ix / (len > 1 ? 1 : len || 1); p.fy = iy / (len > 1 ? 1 : len || 1); const n = Math.hypot(p.fx, p.fy) || 1; p.fx /= n; p.fy /= n; }
    p.x += ix * p.speed * dt; p.y += iy * p.speed * dt;
    p.hurt = Math.max(0, p.hurt - dt);
    p.grace = Math.max(0, p.grace - dt);
    if (p.regen) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
    spawn(s, dt);
    grid(s);
    useWeapons(s, dt);
    moveShots(s, dt);
    moveEnemies(s, dt);
    moveBullets(s, dt);
    collect(s, dt);
    if (p.hp <= 0) { p.hp = 0; s.over = true; s.won = false; s.fx.push({ k: "lose" }); }
    else if (s.bossDown) { s.over = true; s.won = true; s.fx.push({ k: "win" }); }
    return s;
  }
  // a step's sounds and sparkles, taken once by whoever draws
  function takeFx(s) { const out = s.fx; s.fx = []; return out; }

  // ---- Results ----
  // ★ reach the boss, ★★ beat it, ★★★ beat it with half the hearts left
  function starsFor(s) {
    if (s.won) return s.player.hp >= s.player.maxHp * .5 ? 3 : 2;
    return s.t >= BOSS_AT ? 1 : 0;
  }
  function rewardFor(stage, run, first, stars, before = 0) {
    const coins = Math.round(((run.kills || 0) * .06 + (run.time || 0) * .3) * (1 + .25 * (stage - 1)) + (run.bonus || 0));
    const won = stars >= 2;
    const gems = (won && first ? 20 : 0) + (stars === 3 && before < 3 ? 10 : 0);
    return { coins, gems, dust: won && first ? 5 : 0, ore: won && first ? 8 : 0 };
  }
  const summary = (s) => ({ time: Math.floor(s.t), kills: s.kills, level: s.level, bonus: s.bonusCoins || 0 });

  return {
    STEP, BOSS_AT, STAGES, KINDS, WEAPONS, CHARMS, PERKS, PERK_COST, ROLE_WEAPON, ROLE_TEXT, WEAPON_SLOTS, CHARM_SLOTS, MAX_LEVEL,
    heroStats, need, create, setView, step, choose, offers, takeFx, starsFor, rewardFor, summary, perkCost, spawnRadius
  };
});

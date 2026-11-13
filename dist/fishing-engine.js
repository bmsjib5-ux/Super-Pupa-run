// ตกปลาทะเลสาบจันทร์ (moon lake fishing): the rules, with no page in them,
// so Node can test them too. Cast near, mid or far; which fish come depends
// on how far, on the time of day (Bangkok clock) and on luck; wait for the
// real bite (not a nibble) and hook it; then reel, keeping the line's
// tension in the green: too tight snaps it, too slack lets the fish go.
//
// Random numbers come from a seeded source the caller passes in, so tests
// can play the same catch again.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaFishingEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const ZONES = ["near", "mid", "far"];
  const ZONE_NAME = { near: "ริมฝั่ง", mid: "กลางทะเลสาบ", far: "ไกลฝั่ง" };
  const SLOTS = ["dawn", "day", "dusk", "night"];
  const SLOT_NAME = { dawn: "🌅 เช้า", day: "☀️ กลางวัน", dusk: "🌇 เย็น", night: "🌙 กลางคืน" };
  const RARITY = [null, { name: "ธรรมดา", weight: 55, gems: 2 }, { name: "หายาก", weight: 28, gems: 5 }, { name: "หายากมาก", weight: 13, gems: 10 }, { name: "ตำนาน", weight: 4, gems: 25 }];

  // ---- The fish ----
  // look: a body drawn with two colours and a pattern, or an emoji;
  // fight: how hard (0..1) and how often it pulls
  const F = (id, name, zone, times, rarity, size, look, fight) => ({ id, name, zone, times, rarity, size, look, fight });
  const ANY = SLOTS;
  const FISH = [
    F("silverfin", "ปลาซิวเงิน", "near", ANY, 1, [4, 8], { body: "#dfe8f2", fin: "#9fb4c8", pattern: "plain", shape: "slim" }, [.15, .6]),
    F("guppy", "ปลาหางนกยูง", "near", ["dawn", "day"], 1, [3, 6], { body: "#ffb36b", fin: "#ff5fa8", pattern: "plain", shape: "fan" }, [.12, .8]),
    F("goldbarb", "ปลาตะเพียนทอง", "near", ANY, 1, [12, 25], { body: "#ffd23a", fin: "#e8a21a", pattern: "scales", shape: "round" }, [.25, .5]),
    F("shrimp", "กุ้งฝอยใส", "near", ["dusk", "night"], 1, [3, 6], { emoji: "🦐" }, [.1, .9]),
    F("crab", "ปูนา", "near", ["dusk", "night"], 2, [6, 12], { emoji: "🦀" }, [.35, .4]),
    F("bettanight", "ปลากัดราตรี", "near", ["night"], 2, [5, 8], { body: "#3a4cff", fin: "#b06aff", pattern: "plain", shape: "fan" }, [.3, .9]),
    F("pinkcichlid", "ปลาหมอสีชมพู", "near", ["day"], 2, [10, 18], { body: "#ff9ec4", fin: "#ff6fa8", pattern: "spots", shape: "round" }, [.35, .6]),
    F("lotusturtle", "เต่าน้อยดอกบัว", "near", ["dawn"], 3, [15, 30], { emoji: "🐢" }, [.5, .3]),
    F("starfish", "ปลาดาวกระพริบ", "near", ["night"], 3, [8, 14], { body: "#2a2f7a", fin: "#ffe08a", pattern: "stars", shape: "round" }, [.45, .8]),
    F("sakurakoi", "ปลาคาร์ปซากุระ", "near", ["dawn"], 4, [40, 70], { body: "#ffffff", fin: "#ff8ab8", pattern: "koi", shape: "long" }, [.7, .6]),
    F("tilapia", "ปลานิล", "mid", ANY, 1, [20, 35], { body: "#8a9aa8", fin: "#5f6f7d", pattern: "stripes", shape: "round" }, [.3, .5]),
    F("snakehead", "ปลาช่อน", "mid", ["day", "dusk"], 1, [30, 60], { body: "#5c6b4a", fin: "#3d4a30", pattern: "spots", shape: "long" }, [.4, .6]),
    F("gourami", "ปลาสลิด", "mid", ["dawn", "day"], 1, [10, 18], { body: "#b8c58a", fin: "#8e9b62", pattern: "stripes", shape: "round" }, [.25, .5]),
    F("puffer", "ปลาปักเป้าลม", "mid", ANY, 2, [10, 20], { emoji: "🐡" }, [.35, .7]),
    F("shadoweel", "ปลาไหลเงา", "mid", ["night"], 2, [40, 80], { body: "#3b2f4f", fin: "#6a4f8a", pattern: "plain", shape: "eel" }, [.45, .9]),
    F("moonjelly", "แมงกะพรุนจันทร์", "mid", ["night"], 2, [10, 25], { emoji: "🪼" }, [.2, .4]),
    F("rainbowshark", "ปลาสวายสีรุ้ง", "mid", ["dusk"], 3, [50, 90], { body: "#7fd8ff", fin: "#ff7ab8", pattern: "rainbow", shape: "long" }, [.6, .6]),
    F("snowangel", "ปลาเทวดาหิมะ", "mid", ["dawn"], 3, [12, 20], { body: "#f6f9ff", fin: "#bcd6ff", pattern: "stripes", shape: "angel" }, [.45, .8]),
    F("purplesquid", "หมึกน้อยสีม่วง", "mid", ["night"], 3, [15, 30], { emoji: "🦑" }, [.55, .7]),
    F("goldarowana", "ปลามังกรทอง", "mid", ["day"], 4, [60, 100], { body: "#ffcc29", fin: "#ff8a3d", pattern: "scales", shape: "long" }, [.8, .7]),
    F("giantcatfish", "ปลาบึกน้อย", "far", ANY, 1, [60, 120], { body: "#7c7f86", fin: "#5a5c62", pattern: "plain", shape: "cat" }, [.45, .4]),
    F("redsnapper", "ปลากะพงแดง", "far", ["day", "dusk"], 1, [30, 50], { body: "#ff6b5e", fin: "#d14a3f", pattern: "scales", shape: "round" }, [.4, .5]),
    F("moonmackerel", "ปลาทูเงินจันทร์", "far", ["night", "dawn"], 1, [20, 30], { body: "#c7d3ff", fin: "#7f8fd6", pattern: "stripes", shape: "slim" }, [.35, .7]),
    F("lakeshark", "ฉลามทะเลสาบ", "far", ANY, 2, [50, 100], { emoji: "🦈" }, [.6, .6]),
    F("nightray", "ปลากระเบนราตรี", "far", ["night"], 2, [40, 80], { body: "#2d2b48", fin: "#5a56a0", pattern: "spots", shape: "ray" }, [.55, .5]),
    F("babywhale", "วาฬจิ๋ว", "far", ["dawn"], 3, [80, 150], { emoji: "🐳" }, [.7, .4]),
    F("pinkdolphin", "โลมาสีชมพู", "far", ["dusk"], 3, [100, 180], { emoji: "🐬" }, [.65, .7]),
    F("deepoctopus", "หมึกยักษ์ใต้ทะเลสาบ", "far", ["night"], 3, [40, 90], { emoji: "🐙" }, [.7, .6]),
    F("moonking", "ราชาจันทรา", "far", ["night"], 4, [90, 150], { body: "#d6e4ff", fin: "#8fb0ff", pattern: "moon", shape: "long" }, [.85, .8]),
    F("sakuradragon", "มังกรน้ำซากุระ", "far", ["dawn", "dusk"], 4, [120, 200], { body: "#ffb3d1", fin: "#ff6fa8", pattern: "koi", shape: "eel" }, [.9, .7])
  ];
  const BY_ID = Object.fromEntries(FISH.map(f => [f.id, f]));
  const JUNK = [
    { id: "boot", name: "รองเท้าบู๊ตเก่า", emoji: "👢", coins: 2 },
    { id: "can", name: "กระป๋องเปล่า", emoji: "🥫", coins: 1 },
    { id: "leaf", name: "ใบไม้แห้ง", emoji: "🍂", coins: 1 }
  ];

  // ---- Gear ----
  // bought with coins, five levels each
  const GEAR = {
    rod: { name: "คันเบ็ด", icon: "🎣", text: "ม้วนสายได้เร็วขึ้น" },
    line: { name: "สายเบ็ด", icon: "🧵", text: "สายเหนียวขึ้น ช่องสีเขียวกว้างขึ้น" },
    bait: { name: "เหยื่อหอม", icon: "🪱", text: "ปลากินเร็วขึ้น เจอปลาหายากบ่อยขึ้น" }
  };
  const GEAR_COST = [100, 250, 500, 900, 1500];
  const gearCost = (lv) => (lv >= GEAR_COST.length ? null : GEAR_COST[lv]);
  const gearOf = (g = {}) => Object.fromEntries(Object.keys(GEAR).map(k => [k, Math.max(0, Math.min(5, Math.floor(Number(g[k]) || 0)))]));

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

  // ---- Time of day (Bangkok) ----
  function slotAt(date = new Date()) {
    const h = (date.getUTCHours() + 7) % 24;
    return h >= 5 && h < 9 ? "dawn" : h >= 9 && h < 16 ? "day" : h >= 16 && h < 19 ? "dusk" : "night";
  }
  const dayOf = (date = new Date()) => new Date(date.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
  // the day's featured fish: a common or uncommon one, the same for everyone
  function featured(date = new Date()) {
    const day = dayOf(date), pool = FISH.filter(f => f.rarity <= 2);
    let h = 2166136261;
    for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return pool[h % pool.length].id;
  }

  // ---- Casting ----
  // power 0..1 from the cast meter: where the float lands
  const zoneFor = (power) => (power < .34 ? "near" : power < .72 ? "mid" : "far");
  // who bites: a fish that lives there at this hour, by rarity; now and then junk
  function pickCatch(rand, zone, slot, bait = 0) {
    if (rand() < Math.max(.03, .1 - bait * .014)) return { junk: JUNK[Math.floor(rand() * JUNK.length)] };
    const here = FISH.filter(f => f.zone === zone && f.times.includes(slot));
    // better bait lifts the rarer ones
    const weight = (f) => RARITY[f.rarity].weight * (f.rarity >= 3 ? 1 + bait * .15 : 1);
    const total = here.reduce((a, f) => a + weight(f), 0);
    let r = rand() * total;
    for (const f of here) if ((r -= weight(f)) <= 0) return { fish: f };
    return { fish: here[here.length - 1] };
  }
  // how the bite plays out: nibbles first (don't strike!), then the bite
  function bitePlan(rand, fish, bait = 0) {
    const wait = Math.max(1.2, 2 + rand() * 4 - bait * .3);
    const nibbles = [];
    const n = Math.floor(rand() * 4);
    for (let i = 0; i < n; i++) nibbles.push(wait * (.2 + .6 * rand()));
    nibbles.sort((a, b) => a - b);
    // the time to strike shrinks for rarer fish
    const window = fish ? .95 - fish.rarity * .1 : 1;
    return { bite: wait, nibbles, window };
  }

  // ---- Reeling ----
  // tension (0..1) rises while holding and in the fish's pulls; progress fills
  // while tension sits in the green band; 1 snaps the line, a long slack loses it
  function fight(fish, gear = {}, rand = Math.random) {
    const g = gearOf(gear), [power, agility] = fish ? fish.fight : [.1, .3];
    return {
      fish, g, rand, power, agility, tension: .35, progress: .25, t: 0, slack: 0, pull: 0, pullFor: 0, nextPull: .8 + rand(),
      lo: .3, hi: Math.min(.86, .72 + g.line * .028), outcome: null
    };
  }
  function stepFight(f, holding, dt = 1 / 60) {
    if (f.outcome) return f.outcome;
    f.t += dt;
    // the fish pulls in bursts
    f.nextPull -= dt;
    if (f.nextPull <= 0 && f.pullFor <= 0) {
      f.pullFor = .35 + f.rand() * .55;
      f.pull = f.power * (.6 + f.rand() * .6);
      f.nextPull = (1.6 - f.agility) * (.6 + f.rand() * .8);
    }
    let pulling = 0;
    if (f.pullFor > 0) { f.pullFor -= dt; pulling = f.pull; }
    // strong fish yank harder; a better line takes some of it
    f.tension += (holding ? .62 : -.7) * dt + pulling * (.7 + f.power * .5) * (1 - f.g.line * .06) * dt;
    f.tension = Math.max(0, f.tension);
    if (f.tension >= 1) { f.outcome = "snap"; return f.outcome; }
    if (f.tension >= f.lo && f.tension <= f.hi) {
      // the middle of the band reels best
      const mid = (f.lo + f.hi) / 2, near = 1 - Math.abs(f.tension - mid) / ((f.hi - f.lo) / 2) * .4;
      f.progress += (.14 + f.g.rod * .016) / (1 + f.power * .9) * near * dt;
    } else if (f.tension < f.lo) f.progress -= .05 * dt;
    // a pulling fish runs with the line
    if (pulling && !holding) f.progress -= f.power * .06 * dt;
    f.slack = f.tension < .1 ? f.slack + dt : 0;
    if (f.slack > 2) { f.outcome = "escape"; return f.outcome; }
    f.progress = Math.min(1, Math.max(0, f.progress));
    if (f.progress >= 1) f.outcome = "caught";
    else if (f.progress <= 0) f.outcome = "escape";
    return f.outcome;
  }

  // ---- What a catch is worth ----
  // size: smaller ones are more common
  function sizeOf(rand, fish) {
    const [lo, hi] = fish.size;
    return Math.round((lo + (hi - lo) * Math.pow(rand(), 1.6)) * 10) / 10;
  }
  function valueOf(fish, size, isFeatured = false) {
    const base = [0, 6, 15, 40, 120][fish.rarity];
    const [lo, hi] = fish.size;
    return Math.round(base * (1 + (size - lo) / Math.max(1, hi - lo) * .6) * (isFeatured ? 3 : 1));
  }
  // into the album: { first, record, gems, dust }
  function record(album, fish, size) {
    const caught = album.caught || (album.caught = {}), best = album.best || (album.best = {});
    const first = !caught[fish.id];
    caught[fish.id] = (caught[fish.id] || 0) + 1;
    const tenths = Math.round(size * 10), rec = tenths > (best[fish.id] || 0);
    if (rec) best[fish.id] = tenths;
    album.total = (album.total || 0) + 1;
    return { first, record: rec && !first, gems: first ? RARITY[fish.rarity].gems : 0, dust: first && fish.rarity >= 3 ? fish.rarity - 1 : 0 };
  }
  // where to look for a fish not yet caught
  const hint = (fish) => `${ZONE_NAME[fish.zone]} · ${fish.times.length === 4 ? "ทุกเวลา" : fish.times.map(s => SLOT_NAME[s]).join(" ")}`;

  return {
    ZONES, ZONE_NAME, SLOTS, SLOT_NAME, RARITY, FISH, BY_ID, JUNK, GEAR, GEAR_COST,
    gearCost, gearOf, rng, slotAt, dayOf, featured, zoneFor, pickCatch, bitePlan, fight, stepFight, sizeOf, valueOf, record, hint
  };
});

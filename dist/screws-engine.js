// Screw puzzle (คลายน็อตกลไก): the rules, with no page in them, so Node
// can test them too. Plates (bars and discs) lie stacked on a board, each
// held by coloured screws. A screw can be taken out once no plate above
// its own covers it; a plate whose screws are all out falls away. Each
// screw goes into an open toolbox of its colour (two are open at a time,
// three holes each; a full box leaves and the next in the line opens,
// taking any screws of its colour waiting on the tray), or else onto the
// tray, which holds TRAY. A screw with nowhere to go loses the level.
//
// Levels are dealt from their own seed: the plates first, then a way to
// take the screws out (each when nothing covers it), and only then the
// colours, given along that way so its boxes fill in turn and its tray
// never fills. So every level can be cleared, the same on every device.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaScrewsEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LEVELS = 40;
  const W = 7, H = 9;           // the board, in units
  const SCREW_R = .28;          // a screw head's radius
  const BAR_HALF = .42;         // half a bar's width
  const BOX_SIZE = 3, OPEN_BOXES = 2, TRAY = 5;
  // per level: take back a screw, one more tray hole, a drill (any screw)
  const UNDOS = 3, SLOTS = 1, DRILLS = 1;
  const COLOURS = [
    { name: "แดง", hex: "#ff4d5e" },
    { name: "ฟ้า", hex: "#3d8bff" },
    { name: "เหลือง", hex: "#ffcc29" },
    { name: "เขียว", hex: "#3fcf5a" },
    { name: "ม่วง", hex: "#a35cff" },
    { name: "ส้ม", hex: "#ff8a2a" }
  ];

  function levelOf(n) {
    const num = Math.max(1, Math.min(LEVELS, Math.floor(n) || 1));
    const plates = Math.min(19, 4 + Math.floor(num * .4));
    const colours = Math.min(COLOURS.length, 2 + Math.floor(num / 8));
    // how often the dealt way sends a screw to the tray, and how full it lets it get
    const squeeze = Math.min(.45, .12 + num * .009);
    const trayUse = num < 6 ? 2 : num < 20 ? 3 : 4;
    return { num, plates, colours, squeeze, trayUse };
  }

  function random(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---- Geometry ----
  function segmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
    const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  // Does the plate cover the point (with a margin)?
  function covers(plate, x, y, margin = SCREW_R * .6) {
    if (plate.kind === "disc") return Math.hypot(x - plate.cx, y - plate.cy) <= plate.r + margin;
    return segmentDistance(x, y, plate.x1, plate.y1, plate.x2, plate.y2) <= BAR_HALF + margin;
  }
  const inside = (x, y, pad) => x >= pad && y >= pad && x <= W - pad && y <= H - pad;

  // ---- A board ----
  // { plates: [{ id, kind: "bar" | "disc", x1, y1, x2, y2 | cx, cy, r, layer,
  // tint, gone }], screws: [{ id, plate, x, y, colour, out }], queue:
  // [colour, ...] (every box in order), next: the queue's next index,
  // boxes: [{ colour, count } | null] (the open ones), tray: [colour],
  // trayCap, failed }
  const clone = (s) => ({ ...s, plates: s.plates.map(p => ({ ...p })), screws: s.screws.map(x => ({ ...x })), queue: s.queue.slice(), boxes: s.boxes.map(b => (b ? { ...b } : null)), tray: s.tray.slice() });
  // the plates above a screw's own that cover it and are still there
  const coveredBy = (s, screw) => {
    const own = s.plates[screw.plate];
    return s.plates.filter(p => !p.gone && p.layer > own.layer && covers(p, screw.x, screw.y));
  };
  const isFree = (s, screw) => !screw.out && !coveredBy(s, screw).length;
  // Where a screw of this colour would go now: "box", "tray" or "full".
  function whereTo(s, colour) {
    if (s.boxes.some(b => b && b.colour === colour && b.count < BOX_SIZE)) return "box";
    return s.tray.length < s.trayCap ? "tray" : "full";
  }
  // Open the next box in place of a full one, and take in the tray's
  // screws of its colour; again while boxes fill that way.
  function settle(s, events) {
    for (let again = true; again;) {
      again = false;
      s.boxes.forEach((b, i) => {
        if (!b || b.count < BOX_SIZE) return;
        events.push({ t: "boxDone", i, colour: b.colour });
        const colour = s.next < s.queue.length ? s.queue[s.next++] : null;
        s.boxes[i] = colour == null ? null : { colour, count: 0 };
        if (colour == null) return;
        events.push({ t: "boxOpen", i, colour });
        let moved = 0;
        for (let k = s.tray.length - 1; k >= 0 && s.boxes[i].count < BOX_SIZE; k--) {
          if (s.tray[k] !== colour) continue;
          s.tray.splice(k, 1);
          s.boxes[i].count++;
          moved++;
        }
        if (moved) events.push({ t: "fromTray", i, colour, n: moved });
        if (s.boxes[i].count >= BOX_SIZE) again = true;
      });
    }
  }
  // Take a screw out (a drill may take a covered one). Returns what
  // happened, in order, or null if it can't come out.
  function unscrew(s, id, drill = false) {
    const screw = s.screws.find(x => x.id === id);
    if (!screw || screw.out || s.failed || (!drill && !isFree(s, screw))) return null;
    const events = [];
    screw.out = true;
    const to = whereTo(s, screw.colour);
    if (to === "box") {
      const i = s.boxes.findIndex(b => b && b.colour === screw.colour && b.count < BOX_SIZE);
      s.boxes[i].count++;
      events.push({ t: "box", i, id, colour: screw.colour });
    } else if (to === "tray") {
      s.tray.push(screw.colour);
      events.push({ t: "tray", at: s.tray.length - 1, id, colour: screw.colour });
    } else {
      s.failed = true;
      events.push({ t: "full", id, colour: screw.colour });
      return events;
    }
    const plate = s.plates[screw.plate];
    if (s.screws.every(x => x.plate !== plate.id || x.out)) { plate.gone = true; events.push({ t: "fall", plate: plate.id }); }
    settle(s, events);
    return events;
  }
  const cleared = (s) => !s.failed && s.screws.every(x => x.out);
  const freeScrews = (s) => s.screws.filter(x => isFree(s, x));

  // ---- Dealing a level ----
  function deal(level) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const rnd = random(level.num * 6151 + attempt * 50331 + 7);
      const plates = [], screws = [];
      const spaced = (x, y) => screws.every(o => Math.hypot(o.x - x, o.y - y) >= .74);
      // plates, bottom to top; most laid over screws already there
      for (let tries = 0; plates.length < level.plates && tries < 600; tries++) {
        const target = screws.length && rnd() < .72 ? screws[Math.floor(rnd() * screws.length)] : null;
        const cx = target ? target.x + (rnd() - .5) * 1.4 : .9 + rnd() * (W - 1.8);
        const cy = target ? target.y + (rnd() - .5) * 1.4 : .9 + rnd() * (H - 1.8);
        let plate, holes;
        if (rnd() < .82) {
          const len = 2 + rnd() * 2.6, angle = Math.round(rnd() * 12) * Math.PI / 12;
          const dx = Math.cos(angle) * len / 2, dy = Math.sin(angle) * len / 2;
          plate = { kind: "bar", x1: cx - dx, y1: cy - dy, x2: cx + dx, y2: cy + dy };
          holes = [[plate.x1, plate.y1], [plate.x2, plate.y2]];
          if (len > 3.4 && rnd() < .6) holes.push([cx, cy]);
          if (holes.some(([x, y]) => !inside(x, y, BAR_HALF + .1))) continue;
        } else {
          const r = .75 + rnd() * .55;
          plate = { kind: "disc", cx, cy, r };
          holes = r > 1.05 ? [[cx - r * .45, cy], [cx + r * .45, cy]] : [[cx, cy]];
          if (!inside(cx, cy, r + .1)) continue;
        }
        if (!holes.every(([x, y]) => spaced(x, y))) continue;
        const id = plates.length;
        plates.push({ id, ...plate, layer: id, tint: Math.floor(rnd() * 4), gone: false });
        for (const [x, y] of holes) screws.push({ id: screws.length + 1, plate: id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, colour: -1, out: false });
      }
      if (plates.length < level.plates) continue;
      // a multiple of the box size: take middle screws (or ends) off plates with more than one
      while (screws.length % BOX_SIZE) {
        const spare = screws.filter(sc => screws.filter(o => o.plate === sc.plate).length > 1);
        if (!spare.length) break;
        const drop = spare[Math.floor(rnd() * spare.length)];
        screws.splice(screws.indexOf(drop), 1);
      }
      if (screws.length % BOX_SIZE) continue;
      screws.forEach((sc, i) => { sc.id = i + 1; });
      const s = { plates, screws, queue: [], next: 0, boxes: [], tray: [], trayCap: TRAY, failed: false };
      // enough to think about: a good share covered at the start
      const covered = screws.filter(sc => !isFree(s, sc)).length;
      if (level.num > 2 && covered < screws.length * .3) continue;
      // a way out: any free screw, again and again
      const way = [], walk = clone(s);
      while (walk.screws.some(x => !x.out)) {
        const free = freeScrews(walk);
        const pick = free[Math.floor(rnd() * free.length)];
        pick.out = true;
        way.push(pick.id);
        const plate = walk.plates[pick.plate];
        if (walk.screws.every(x => x.plate !== plate.id || x.out)) plate.gone = true;
      }
      if (!paint(s, way, level, rnd)) continue;
      return { state: s, way };
    }
    throw new Error(`level ${level.num}: no board`);
  }
  // The colours and the line of boxes, given along the way and played by
  // the real rules as they go: each screw takes the colour of an open box
  // with room, or now and then (squeeze) of a box still to come, so it
  // waits on the tray, never more than trayUse there at once.
  function paint(s, way, level, rnd) {
    const boxes = way.length / BOX_SIZE;
    const queue = [];
    for (let k = 0; k < boxes; k++) {
      let c;
      do c = Math.floor(rnd() * level.colours); while (k >= 2 && queue[k - 1] === c && queue[k - 2] === c);
      queue.push(c);
    }
    s.queue = queue;
    const t = start(s);
    for (const id of way) {
      const roomy = [...new Set(t.boxes.filter(b => b && b.count < BOX_SIZE).map(b => b.colour))];
      // room still to come for each colour, less what already waits on the tray
      const later = [];
      for (let c = 0; c < level.colours; c++) {
        const room = t.queue.slice(t.next).filter(q => q === c).length * BOX_SIZE - t.tray.filter(q => q === c).length;
        if (room > 0 && !roomy.includes(c)) later.push(c);
      }
      let colour;
      if (later.length && t.tray.length < level.trayUse && (rnd() < level.squeeze || !roomy.length)) colour = later[Math.floor(rnd() * later.length)];
      else if (roomy.length) colour = roomy[Math.floor(rnd() * roomy.length)];
      else return false;
      s.screws.find(x => x.id === id).colour = colour;
      t.screws.find(x => x.id === id).colour = colour;
      if (!unscrew(t, id) || t.failed) return false;
    }
    return cleared(t);
  }
  // The board as play starts: the first boxes open, the rest in line.
  function start(s) {
    const t = clone(s);
    t.next = Math.min(OPEN_BOXES, t.queue.length);
    t.boxes = t.queue.slice(0, OPEN_BOXES).map(colour => ({ colour, count: 0 }));
    while (t.boxes.length < OPEN_BOXES) t.boxes.push(null);
    t.tray = [];
    t.failed = false;
    t.trayCap = TRAY;
    for (const p of t.plates) p.gone = false;
    for (const x of t.screws) x.out = false;
    return t;
  }
  // A good next screw: free and with an open box waiting for it, else
  // free and of the colour next in line, else any free one.
  function hint(s) {
    const free = freeScrews(s);
    return free.find(x => whereTo(s, x.colour) === "box")
      || free.find(x => s.queue.slice(s.next, s.next + 2).includes(x.colour))
      || free[0] || null;
  }

  // ---- Stars and rewards ----
  // Three stars with no tools, two with one, else one.
  const starsFor = (toolsUsed) => (toolsUsed <= 0 ? 3 : toolsUsed === 1 ? 2 : 1);
  function rewardFor(level, first, stars, before = 0) {
    const coins = Math.round((30 + 6 * level.num) * (first ? 1 : .5));
    const gems = (first ? 10 : 0) + (stars >= 3 && before < 3 ? 10 : 0);
    return { coins, gems, dust: first ? 3 : 0, ore: first ? 5 : 0 };
  }

  return {
    LEVELS, W, H, SCREW_R, BAR_HALF, BOX_SIZE, OPEN_BOXES, TRAY, UNDOS, SLOTS, DRILLS, COLOURS,
    levelOf, random, covers, clone, coveredBy, isFree, whereTo, unscrew, cleared, freeScrews, deal, start, hint, starsFor, rewardFor
  };
});

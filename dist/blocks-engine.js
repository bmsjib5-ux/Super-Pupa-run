// Mushroom block jam (ปลดล็อกบล็อกเห็ด): the rules, with no page in them,
// so Node can test them too. Jelly blocks of a few cells lie on a board
// with coloured gates in its edge. A block slides a cell at a time through
// empty cells; once it touches the edge at a gate of its colour, with all
// of it inside the gate's span and nothing in its way out, it leaves the
// board. Clear every block. Some blocks are frozen until enough others
// have left, some slide one way only (across or up and down), and later
// boards have rocks.
//
// Levels are built backwards from an empty board: each new block comes in
// through its gate and slides to a spot it can reach past the blocks
// already there. Taking them out in the reverse order always works, so
// every level can be cleared, and each is the same on every device.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaBlocksEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LEVELS = 40;
  // per level: a hammer (smash one block), a freeze (stop the clock), hints
  const HAMMERS = 1, FREEZES = 1, FREEZE_SECONDS = 15, HINTS = 2;
  // Stars: one for clearing, two with STAR_TIME[0] of the time left, three
  // with STAR_TIME[1].
  const STAR_TIME = [.15, .35];
  const COLOURS = [
    { name: "แดง", hex: "#ff4d5e" },
    { name: "ฟ้า", hex: "#3d8bff" },
    { name: "เหลือง", hex: "#ffcc29" },
    { name: "เขียว", hex: "#3fcf5a" },
    { name: "ม่วง", hex: "#a35cff" },
    { name: "ส้ม", hex: "#ff8a2a" },
    { name: "ชมพู", hex: "#ff6fc4" }
  ];
  // The shapes, as cells [x, y]; each can be turned.
  const SHAPES = [
    [[0, 0]],
    [[0, 0], [1, 0]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [0, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]],
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [3, 0]]
  ];
  const turn = (cells) => cells.map(([x, y]) => [-y, x]);
  const settle = (cells) => {
    const minX = Math.min(...cells.map(c => c[0])), minY = Math.min(...cells.map(c => c[1]));
    return cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  };
  // how often each shape comes up: the bigger ones more
  const SHAPE_WEIGHT = [1, 3, 3, 4, 3, 4, 4, 3, 2];
  // every distinct turn of each shape
  const FORMS = SHAPES.map(shape => {
    const out = [], seen = new Set();
    let cells = shape;
    for (let k = 0; k < 4; k++) {
      const s = settle(cells), key = JSON.stringify(s);
      if (!seen.has(key)) { seen.add(key); out.push(s); }
      cells = turn(cells);
    }
    return out;
  });

  // A level: the board's size, how many blocks and colours, and its twists.
  function levelOf(n) {
    const num = Math.max(1, Math.min(LEVELS, Math.floor(n) || 1));
    const w = Math.min(8, 5 + Math.floor((num - 1) / 9));
    const h = Math.min(9, 5 + Math.floor((num + 2) / 8));
    const colours = Math.min(COLOURS.length, 2 + Math.ceil(num / 7));
    const blocks = Math.min(18, 4 + Math.floor(num * .42));
    const rocks = num >= 6 ? Math.min(5, 1 + Math.floor((num - 6) / 7)) : 0;
    const ice = num >= 8 ? Math.min(3, 1 + Math.floor((num - 8) / 10)) : 0;
    const arrows = num >= 14 ? Math.min(3, 1 + Math.floor((num - 14) / 9)) : 0;
    const time = 40 + 11 * blocks;
    return { num, w, h, colours, blocks, rocks, ice, arrows, time };
  }

  function random(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];

  // ---- A board ----
  // { w, h, rocks: ["x,y"], gates: [{ side, from, len, colour }], blocks:
  // [{ id, colour, cells, x, y, axis: "" | "h" | "v", ice }], gone: count }
  // side: "top" | "bottom" | "left" | "right"; a gate covers cells from..
  // from+len-1 along its side.
  const SIDES = {
    top: { dx: 0, dy: -1, axis: "v" }, bottom: { dx: 0, dy: 1, axis: "v" },
    left: { dx: -1, dy: 0, axis: "h" }, right: { dx: 1, dy: 0, axis: "h" }
  };
  const clone = (s) => ({ ...s, rocks: s.rocks.slice(), gates: s.gates.map(g => ({ ...g })), blocks: s.blocks.map(b => ({ ...b })) });
  const cellsAt = (b, x = b.x, y = b.y) => b.cells.map(([cx, cy]) => [x + cx, y + cy]);
  // which block (or rock) fills each cell
  function fill(s, skip = -1) {
    const taken = new Map();
    for (const r of s.rocks) taken.set(r, "rock");
    for (const b of s.blocks) if (b.id !== skip) for (const [x, y] of cellsAt(b)) taken.set(`${x},${y}`, b.id);
    return taken;
  }
  const fits = (s, b, x, y, taken) => cellsAt(b, x, y).every(([cx, cy]) => cx >= 0 && cy >= 0 && cx < s.w && cy < s.h && !taken.has(`${cx},${cy}`));
  const mayMove = (b, dx, dy) => !b.ice && (!b.axis || (b.axis === "h" ? dy === 0 : dx === 0));
  // The gate block b can leave by from where it is, or null: it touches
  // the gate's side, all of it lies in the gate's span, and sliding out
  // crosses no other block or rock.
  function exitOf(s, b, taken = fill(s, b.id), x = b.x, y = b.y) {
    if (b.ice) return null;
    for (const g of s.gates) {
      if (g.colour !== b.colour) continue;
      const side = SIDES[g.side];
      if (!mayMove(b, side.dx, side.dy)) continue;
      const cells = cellsAt(b, x, y);
      const along = (c) => (side.axis === "v" ? c[0] : c[1]);
      if (!cells.every(c => along(c) >= g.from && along(c) < g.from + g.len)) continue;
      const touches = cells.some(([cx, cy]) => (g.side === "top" ? cy === 0 : g.side === "bottom" ? cy === s.h - 1 : g.side === "left" ? cx === 0 : cx === s.w - 1));
      if (!touches) continue;
      // the way out: every cell each part passes on the board is free
      const clear = cells.every(([cx, cy]) => {
        for (let k = 1; ; k++) {
          const nx = cx + side.dx * k, ny = cy + side.dy * k;
          if (nx < 0 || ny < 0 || nx >= s.w || ny >= s.h) return true;
          const t = taken.get(`${nx},${ny}`);
          if (t != null && t !== b.id) return false;
        }
      });
      if (clear) return g;
    }
    return null;
  }
  // Move block id one cell; true if it moved.
  function step(s, id, dx, dy) {
    const b = s.blocks.find(x => x.id === id);
    if (!b || !mayMove(b, dx, dy)) return false;
    if (!fits(s, b, b.x + dx, b.y + dy, fill(s, id))) return false;
    b.x += dx; b.y += dy;
    return true;
  }
  // Take a block off (it left, or was smashed): frozen blocks count down.
  function remove(s, id) {
    const at = s.blocks.findIndex(b => b.id === id);
    if (at < 0) return false;
    s.blocks.splice(at, 1);
    s.gone = (s.gone || 0) + 1;
    for (const b of s.blocks) if (b.ice) b.ice--;
    return true;
  }
  // Every spot block b can slide to (others staying put), with the first
  // step toward it: Map "x,y" -> { x, y, from }.
  function reach(s, b, taken = fill(s, b.id)) {
    const out = new Map([[`${b.x},${b.y}`, { x: b.x, y: b.y, from: null }]]);
    const queue = [[b.x, b.y]];
    while (queue.length) {
      const [x, y] = queue.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!mayMove(b, dx, dy)) continue;
        const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
        if (out.has(key) || !fits(s, b, nx, ny, taken)) continue;
        out.set(key, { x: nx, y: ny, from: `${x},${y}` });
        queue.push([nx, ny]);
      }
    }
    return out;
  }
  // A block that can get out now, and the way: [{ id, path: [[x, y], ...] }]
  // (the path from where it is to where it leaves), or [].
  function ways(s) {
    const out = [];
    for (const b of s.blocks) {
      if (b.ice) continue;
      const taken = fill(s, b.id), spots = reach(s, b, taken);
      for (const [key, spot] of spots) {
        if (!exitOf(s, b, taken, spot.x, spot.y)) continue;
        const path = [];
        for (let k = key; k; k = spots.get(k).from) path.unshift(k.split(",").map(Number));
        out.push({ id: b.id, path });
        break;
      }
    }
    return out;
  }
  const cleared = (s) => !s.blocks.length;

  // ---- Building a level ----
  // Gates first, one per colour, spread round the edge; then blocks, one
  // at a time, each in through a gate of its colour and on to a spot it
  // can reach that isn't already a way out. Built again (next seed) until
  // all the blocks fit and not too many can leave straight away.
  function deal(level) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const rnd = random(level.num * 7349 + attempt * 92821 + 3);
      const s = { w: level.w, h: level.h, rocks: [], gates: [], blocks: [], gone: 0 };
      // gates: a side each, in turn round the board, not touching each other
      const used = { top: [], bottom: [], left: [], right: [] };
      const sides = ["top", "right", "bottom", "left"];
      const start = Math.floor(rnd() * 4);
      let ok = true;
      for (let c = 0; c < level.colours && ok; c++) {
        let placed = false;
        for (let tries = 0; tries < 12 && !placed; tries++) {
          const side = sides[(start + c + tries) % 4];
          const span = SIDES[side].axis === "v" ? s.w : s.h;
          const len = Math.min(span - 1, 2 + Math.floor(rnd() * 2));
          const from = Math.floor(rnd() * (span - len + 1));
          // a cell between gates on the same side
          if (used[side].some(([a, b]) => from <= b + 1 && from + len - 1 >= a - 1)) continue;
          used[side].push([from, from + len - 1]);
          s.gates.push({ side, from, len, colour: c });
          placed = true;
        }
        if (!placed) ok = false;
      }
      if (!ok) continue;
      // rocks, away from the edge rows so gates stay usable
      for (let k = 0; k < level.rocks; k++) {
        const x = 1 + Math.floor(rnd() * (s.w - 2)), y = 1 + Math.floor(rnd() * (s.h - 2)), key = `${x},${y}`;
        if (!s.rocks.includes(key)) s.rocks.push(key);
      }
      // blocks; the first ones in (the last to leave) get the twists:
      // frozen ones first, then ones that slide one way only
      let id = 0, fails = 0;
      while (s.blocks.length < level.blocks && fails < 150) {
        const g = s.gates[(s.blocks.length + Math.floor(rnd() * 2)) % s.gates.length];
        const side = SIDES[g.side];
        let roll = rnd() * SHAPE_WEIGHT.reduce((a, b) => a + b, 0), shape = 0;
        while ((roll -= SHAPE_WEIGHT[shape]) > 0) shape++;
        const cells = pick(FORMS[shape], rnd);
        const across = Math.max(...cells.map(c => (side.axis === "v" ? c[0] : c[1]))) + 1;
        if (across > g.len) { fails++; continue; }
        const deep = Math.max(...cells.map(c => (side.axis === "v" ? c[1] : c[0]))) + 1;
        const along = g.from + Math.floor(rnd() * (g.len - across + 1));
        const x = side.axis === "v" ? along : g.side === "left" ? 0 : s.w - deep;
        const y = side.axis === "h" ? along : g.side === "top" ? 0 : s.h - deep;
        const n = s.blocks.length;
        const b = { id: id + 1, colour: g.colour, cells, x, y, axis: n >= level.ice && n < level.ice + level.arrows ? side.axis : "", ice: 0 };
        const taken = fill(s);
        if (!fits(s, b, x, y, taken) || !exitOf(s, b, taken)) { fails++; continue; }
        // from the gate, where it can go; not a spot it would leave from
        const spots = [...reach(s, b, taken).values()].filter(p => !s.gates.some(gate => gate.colour === b.colour && exitOf({ ...s, gates: [gate] }, b, taken, p.x, p.y)));
        if (!spots.length) { fails++; continue; }
        // the farther from the gate, the better
        spots.sort((p, q) => (Math.abs(q.x - x) + Math.abs(q.y - y)) - (Math.abs(p.x - x) + Math.abs(p.y - y)));
        const spot = spots[Math.floor(rnd() * Math.min(3, spots.length))];
        b.x = spot.x; b.y = spot.y;
        id++;
        s.blocks.push(b);
      }
      if (s.blocks.length < level.blocks) continue;
      // frozen: thawed by as many others leaving, never more than leave
      // before it does
      const order = s.blocks.map(b => b.id).reverse();
      for (let k = 0; k < level.ice; k++) {
        const b = s.blocks[k], before = order.indexOf(b.id);
        if (before > 0) b.ice = Math.min(before, 2 + k);
      }
      if (!solvable(s, order)) continue;
      // not too many free to leave at the start
      const free = ways(s).length;
      if (level.num > 2 && free > Math.max(1, Math.ceil(level.blocks * .45))) continue;
      return { state: s, order };
    }
    throw new Error(`level ${level.num}: no board`);
  }
  // Clears the board in this order, each block straight out by its way?
  function solvable(start, order) {
    const s = clone(start);
    for (const id of order) {
      const way = ways(s).find(w => w.id === id);
      if (!way) return false;
      remove(s, id);
    }
    return cleared(s);
  }

  // ---- Stars and rewards ----
  function starsFor(level, secondsLeft) {
    const share = Math.max(0, secondsLeft) / level.time;
    return share >= STAR_TIME[1] ? 3 : share >= STAR_TIME[0] ? 2 : 1;
  }
  // Coins each clear (half on a replay); the first clear gems, star dust
  // and ore for the card battles; three stars the first time more gems.
  function rewardFor(level, first, stars, before = 0) {
    const coins = Math.round((30 + 6 * level.num) * (first ? 1 : .5));
    const gems = (first ? 10 : 0) + (stars >= 3 && before < 3 ? 10 : 0);
    return { coins, gems, dust: first ? 3 : 0, ore: first ? 5 : 0 };
  }

  return {
    LEVELS, HAMMERS, FREEZES, FREEZE_SECONDS, HINTS, STAR_TIME, COLOURS, SHAPES, FORMS, SIDES,
    levelOf, random, clone, cellsAt, fill, fits, mayMove, exitOf, step, remove, reach, ways, cleared, deal, solvable, starsFor, rewardFor
  };
});

// The perspective maze (เขาวงกตมุมมอง): the rules, with no page in them,
// so Node can test them too. Blocks stand in an isometric world; Pupa walks
// on their tops. What counts is what the eye sees: two tops that meet on the
// screen are joined, however far apart they are in depth, so a low path can
// run straight on into a high tower. Turn the cranks and slide the
// platforms until a way to the glowing portal shows, then tap where to go.
//
// The projection: a point (x, y, z) shows at ((x - y) * A, (x + y) * A / 2 -
// z * A), so (x + 1, y + 1, z + 1) shows where (x, y, z) does. A top's place
// on the screen is u = x - z, v = y - z; tops whose (u, v) differ by one
// step meet, and where tops share a place the nearest (highest) hides the rest.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaMazeEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---- Levels ----
  // blocks: [x, y, z] that stay put; groups: moving parts, each blocks it
  // carries and how it moves: { turn: [px, py] } turns a quarter round the
  // column at (px, py) per crank, starting `at` quarter turns in; { slide:
  // "x" | "y" | "z", from, to, at } moves along an axis a cell per push.
  // start and goal: blocks (any kind) Pupa starts on and must reach.
  const run = (x0, x1, y, z) => Array.from({ length: x1 - x0 + 1 }, (_, k) => [x0 + k, y, z]);
  const col = (x, y0, y1, z) => Array.from({ length: y1 - y0 + 1 }, (_, k) => [x, y0 + k, z]);
  const pillar = (x, y, z0, z1) => Array.from({ length: z1 - z0 + 1 }, (_, k) => [x, y, z0 + k]);
  const LEVELS = [
    {
      name: "ทางเดินแรก", tip: "แตะช่องที่อยากไป Pupa จะเดินไปเอง ไปให้ถึงประตูมิติที่เรืองแสง",
      blocks: [...run(0, 3, 0, 0), ...col(3, 1, 3, 0)], groups: [],
      start: [0, 0, 0], goal: [3, 3, 0]
    },
    {
      name: "สะพานหมุน", tip: "หมุนกลไกสีชมพูเพื่อหันสะพานให้ต่อกับทางเดิน",
      blocks: [...run(0, 1, 0, 0), ...run(5, 6, 0, 0), ...col(6, 1, 2, 0)],
      groups: [{ turn: [3, 0], at: 1, blocks: [[2, 0, 0], [3, 0, 0], [4, 0, 0]] }],
      start: [0, 0, 0], goal: [6, 2, 0]
    },
    {
      name: "แท่นเลื่อน", tip: "แตะลูกศรเพื่อเลื่อนแท่นสีฟ้าไปเติมช่องว่าง",
      blocks: [...run(0, 2, 0, 0), ...run(4, 6, 0, 0)],
      groups: [{ slide: "y", from: 0, to: 3, at: 3, blocks: [[3, 0, 0]] }],
      start: [0, 0, 0], goal: [6, 0, 0]
    },
    {
      name: "ทางลวงตา", tip: "ทางที่ดูต่อกันบนจอ เดินข้ามได้จริง! หมุนยอดหอคอยให้ดูต่อกับทางเดินด้านล่าง",
      blocks: [...run(0, 2, 2, 0), ...pillar(6, 4, 0, 1)],
      groups: [{ turn: [6, 4], at: 1, blocks: [[6, 4, 2], [7, 4, 2], [7, 5, 2]] }],
      start: [0, 2, 0], goal: [7, 5, 2]
    },
    {
      name: "ลิฟต์ลอยฟ้า", tip: "แท่นที่เลื่อนขึ้นลงได้ พาขึ้นที่สูง หรือทำให้ทางดูต่อกันก็ได้",
      blocks: [...run(0, 2, 0, 0), ...run(4, 6, 0, 2), ...col(6, -2, -1, 2), ...pillar(4, 0, 0, 1), ...pillar(6, -2, 0, 1)],
      groups: [{ slide: "z", from: 0, to: 2, at: 0, blocks: [[3, 0, 0]] }],
      start: [0, 0, 0], goal: [6, -2, 2]
    },
    {
      name: "แผ่นลอยในอากาศ", tip: "ช่องว่างกลางทาง ลองยกลิฟต์ด้านหลังขึ้นมาเติมในมุมมอง",
      blocks: [...run(0, 2, 0, 0), ...run(4, 6, 0, 0), ...col(6, 1, 2, 0)],
      groups: [{ slide: "z", from: 0, to: 3, at: 0, blocks: [[5, 2, 0]] }],
      start: [0, 0, 0], goal: [6, 2, 0]
    },
    {
      name: "สะพานคู่", tip: "สองสะพาน สองกลไก หมุนให้ครบทั้งคู่",
      blocks: [...run(0, 1, 0, 0), ...col(6, 1, 2, 1), ...pillar(6, 1, 0, 0), ...pillar(6, 2, 0, 0), ...col(6, 6, 7, 1), ...pillar(6, 7, 0, 0)],
      groups: [
        { turn: [3, 0], at: 1, blocks: [[2, 0, 0], [3, 0, 0], [4, 0, 0]] },
        { turn: [6, 4], at: 1, blocks: [[6, 3, 1], [6, 4, 1], [6, 5, 1]] }
      ],
      start: [0, 0, 0], goal: [6, 7, 1]
    },
    {
      name: "ยืนบนลานหมุน", tip: "เดินขึ้นไปยืนบนลานหมุนก่อน แล้วค่อยหมุน Pupa จะหมุนไปด้วย",
      blocks: [...run(0, 2, 0, 0), ...run(6, 7, 2, 0), ...col(7, 3, 4, 0)],
      groups: [{ turn: [3, 2], at: 0, blocks: [[3, 2, 0], [3, 1, 0], [3, 0, 0]] }],
      start: [0, 0, 0], goal: [7, 4, 0]
    },
    {
      name: "ขึ้นลิฟต์ไปหมุนสะพาน", tip: "ยืนบนลิฟต์แล้วเลื่อนขึ้น Pupa จะขึ้นไปด้วย",
      blocks: [...run(0, 2, 0, 0), [4, 0, 3], ...pillar(4, 0, 0, 2), ...run(8, 9, 0, 3), ...pillar(9, 0, 0, 2)],
      groups: [
        { slide: "z", from: 0, to: 3, at: 0, blocks: [[3, 0, 0]] },
        { turn: [6, 0], at: 1, blocks: [[5, 0, 3], [6, 0, 3], [7, 0, 3]] }
      ],
      start: [0, 0, 0], goal: [9, 0, 3]
    },
    {
      name: "ลานหมุนกับเสาขวาง", tip: "เสาขวางทางหมุนอยู่ ลองเลื่อนเสาออกก่อน",
      blocks: [[3, 0, 0], [2, 0, 0], [1, 0, 0]],
      groups: [
        { turn: [3, 3], at: 0, blocks: [[3, 3, 0], [4, 3, 0], [5, 3, 0]] },
        { slide: "y", from: 0, to: 2, at: 0, blocks: [[2, 3, 0], [2, 3, 1]] }
      ],
      start: [5, 3, 0], goal: [1, 0, 0]
    },
    {
      name: "บันไดลวงตา", tip: "ทางที่ดูราบเรียบอาจสูงขึ้นเรื่อย ๆ ดูเสาข้างล่างสิ",
      blocks: [[0, 0, 0], [1, 0, 0], [3, 1, 1], ...pillar(3, 1, 0, 0), [5, 2, 2], ...pillar(5, 2, 0, 1), [7, 3, 3], ...pillar(7, 3, 0, 2), ...col(7, 4, 5, 3), ...pillar(7, 5, 0, 2), ...pillar(7, 7, 0, 2)],
      groups: [{ turn: [7, 7], at: 1, blocks: [[7, 6, 3], [7, 7, 3], [7, 8, 3], [8, 8, 3]] }],
      start: [0, 0, 0], goal: [8, 8, 3]
    },
    {
      name: "สามกลไก", tip: "สะพาน ลิฟต์ และลานหมุน ใช้ลิฟต์ทั้งเติมทางในมุมมองและพาขึ้นที่สูง",
      blocks: [...run(0, 1, 0, 0), [5, 0, 0], ...run(7, 8, 0, 3), ...pillar(7, 0, 0, 2), ...pillar(8, -2, 0, 2), ...col(8, -5, -4, 3), ...pillar(8, -5, 0, 2)],
      groups: [
        { turn: [3, 0], at: 1, blocks: [[2, 0, 0], [3, 0, 0], [4, 0, 0]] },
        { slide: "z", from: 0, to: 3, at: 3, blocks: [[6, 0, 0]] },
        { turn: [8, -2], at: 1, blocks: [[8, -1, 3], [8, -2, 3], [8, -3, 3]] }
      ],
      start: [0, 0, 0], goal: [8, -5, 3]
    }
  ];

  // ---- A world ----
  // { blocks: [{ id, x, y, z, home: [x, y, z], group }], groups: [{ ...def,
  // step }], at: the block Pupa stands on, goal, moves }
  function build(n) {
    const def = LEVELS[n - 1];
    const blocks = [];
    const add = (pos, group) => { blocks.push({ id: blocks.length + 1, x: pos[0], y: pos[1], z: pos[2], home: pos.slice(), group }); };
    for (const pos of def.blocks) add(pos, -1);
    const groups = def.groups.map((g, i) => { for (const pos of g.blocks) add(pos, i); return { ...g, step: g.at || 0 }; });
    const s = { level: n, blocks, groups, at: 0, goal: 0, moves: 0 };
    groups.forEach((_, i) => place(s, i));
    const find = (p) => blocks.find(b => b.home[0] === p[0] && b.home[1] === p[1] && b.home[2] === p[2]).id;
    s.at = find(def.start);
    s.goal = find(def.goal);
    return s;
  }
  const clone = (s) => ({ ...s, blocks: s.blocks.map(b => ({ ...b })), groups: s.groups.map(g => ({ ...g })) });
  // where a group's block is at a step
  function spot(g, home, step) {
    if (g.turn) {
      let dx = home[0] - g.turn[0], dy = home[1] - g.turn[1];
      for (let k = 0; k < ((step % 4) + 4) % 4; k++) [dx, dy] = [-dy, dx];
      return [g.turn[0] + dx, g.turn[1] + dy, home[2]];
    }
    const out = home.slice();
    out["xyz".indexOf(g.slide)] += step;
    return out;
  }
  function place(s, i) {
    const g = s.groups[i];
    for (const b of s.blocks) if (b.group === i) [b.x, b.y, b.z] = spot(g, b.home, g.step);
  }
  const key = (x, y, z) => `${x},${y},${z}`;
  const taken = (s) => new Set(s.blocks.map(b => key(b.x, b.y, b.z)));
  // the tops one can stand on and see: nothing on them, the nearest of
  // those sharing a place on the screen
  function tops(s) {
    const full = taken(s), seen = new Map();
    for (const b of s.blocks) {
      if (full.has(key(b.x, b.y, b.z + 1))) continue;
      const k = `${b.x - b.z},${b.y - b.z}`, other = seen.get(k);
      if (!other || b.z > other.z) seen.set(k, b);
    }
    return seen;
  }
  // Every block Pupa can walk to now, and the way: Map id -> previous id.
  function reach(s) {
    const shown = tops(s), out = new Map();
    const start = s.blocks.find(b => b.id === s.at);
    if (!start || shown.get(`${start.x - start.z},${start.y - start.z}`) !== start) return out;
    out.set(start.id, null);
    const queue = [start];
    while (queue.length) {
      const b = queue.shift(), u = b.x - b.z, v = b.y - b.z;
      for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = shown.get(`${u + du},${v + dv}`);
        if (!next || out.has(next.id)) continue;
        out.set(next.id, b.id);
        queue.push(next);
      }
    }
    return out;
  }
  // The way to a block, as ids from where Pupa is, or null.
  function pathTo(s, id) {
    const ways = reach(s);
    if (!ways.has(id)) return null;
    const path = [];
    for (let k = id; k != null; k = ways.get(k)) path.unshift(k);
    return path;
  }
  function walk(s, id) {
    const path = pathTo(s, id);
    if (path) s.at = id;
    return path;
  }
  // Move a group a step (a turn, or a push of +1 or -1 along its slide).
  // Not into another block, past its ends, or leaving Pupa buried or hidden.
  function canMove(s, i, dir = 1) {
    const g = s.groups[i];
    if (!g) return false;
    const step = g.step + (g.turn ? 1 : dir);
    if (g.slide && (step < g.from || step > g.to)) return false;
    const others = new Set(s.blocks.filter(b => b.group !== i).map(b => key(b.x, b.y, b.z)));
    if (s.blocks.some(b => b.group === i && others.has(key(...spot(g, b.home, step))))) return false;
    const t = clone(s);
    t.groups[i].step = step;
    place(t, i);
    return reach(t).has(t.at);
  }
  function move(s, i, dir = 1) {
    if (!canMove(s, i, dir)) return false;
    const g = s.groups[i];
    g.step += g.turn ? 1 : dir;
    if (g.turn) g.step %= 4;
    place(s, i);
    s.moves++;
    return true;
  }
  const won = (s) => s.at === s.goal;

  // Fewest moves to the goal (walking is free), by a search over the
  // groups' steps and the block Pupa stands on, from a level's start or a
  // world as it is: { moves, plan: [{ at: where to stand, group, dir }] },
  // or null if it can't be done.
  const solve = (n, limit) => solveFrom(build(n), limit);
  function solveFrom(start, limit = 50000) {
    const stateKey = (s) => `${s.groups.map(g => g.step).join(",")}|${s.at}`;
    // stand anywhere reachable for free
    const spread = (s) => [...reach(s).keys()].map(id => { const t = clone(s); t.at = id; return t; });
    let layer = spread(start), seen = new Set(layer.map(stateKey)), moves = 0, plan = new Map(layer.map(s => [stateKey(s), []]));
    while (layer.length && seen.size < limit) {
      for (const s of layer) if (reach(s).has(s.goal)) return { moves, plan: plan.get(stateKey(s)), standAt: s.at };
      const next = [];
      for (const s of layer) {
        s.groups.forEach((g, i) => {
          for (const dir of g.turn ? [1] : [1, -1]) {
            const t = clone(s);
            if (!move(t, i, dir)) continue;
            for (const u of spread(t)) {
              const k = stateKey(u);
              if (seen.has(k)) continue;
              seen.add(k);
              plan.set(k, [...plan.get(stateKey(s)), { at: s.at, group: i, dir }]);
              next.push(u);
            }
          }
        });
      }
      layer = next;
      moves++;
    }
    return null;
  }

  // the screen place of a point, in units of A
  const project = (x, y, z) => [x - y, (x + y) / 2 - z];

  // ---- Stars and rewards ----
  // Three stars within the fewest moves, two within three more, else one.
  const starsFor = (best, moves) => (moves <= best ? 3 : moves <= best + 3 ? 2 : 1);
  function rewardFor(level, first, stars, before = 0) {
    const coins = Math.round((40 + 10 * level) * (first ? 1 : .5));
    const gems = (first ? 15 : 0) + (stars >= 3 && before < 3 ? 10 : 0);
    return { coins, gems, dust: first ? 3 : 0, ore: first ? 5 : 0 };
  }

  return { LEVELS, build, clone, spot, place, tops, reach, pathTo, walk, canMove, move, won, solve, solveFrom, project, starsFor, rewardFor };
});

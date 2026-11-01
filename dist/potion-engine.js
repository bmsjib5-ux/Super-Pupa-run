// Potion sort (ห้องยาวิเศษ): the rules, with no page in them, so Node can
// test them too. Bottles hold up to CAP layers of potion. A pour moves the
// top run of one colour into a bottle that is empty or shows that colour
// on top, as much as fits. A level is done when every bottle is empty or
// full of one colour. Some levels hide the lower layers ("?") until they
// come to the top, and some cork a bottle until another bottle is filled
// with the lock's colour. Every level is dealt from its own seed and
// checked solvable, so it is the same on every device.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaPotionEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LEVELS = 40;
  const CAP = 4;
  // per level: undos, an extra empty bottle, hints
  const UNDOS = 5, EXTRAS = 1, HINTS = 3;
  // The potions: a name, a colour and a sign (for telling them apart
  // without the colour).
  const COLOURS = [
    { name: "ชมพู", hex: "#ff5fae", sign: "♥" },
    { name: "เขียวมิ้นต์", hex: "#3fe0a0", sign: "♣" },
    { name: "ฟ้า", hex: "#47b8ff", sign: "●" },
    { name: "เหลืองทอง", hex: "#ffd23a", sign: "★" },
    { name: "ม่วง", hex: "#a35cff", sign: "☾" },
    { name: "ส้ม", hex: "#ff8a2a", sign: "▲" },
    { name: "แดง", hex: "#ff3b4f", sign: "♦" },
    { name: "น้ำเงิน", hex: "#3550ff", sign: "■" },
    { name: "เขียวมะนาว", hex: "#a6f03c", sign: "✿" },
    { name: "ฟ้าน้ำทะเล", hex: "#22d6d6", sign: "✚" },
    { name: "ขาวมุก", hex: "#f2ecff", sign: "◆" }
  ];

  // A level: how many potion colours, empty bottles, and its twists.
  function levelOf(n) {
    const num = Math.max(1, Math.min(LEVELS, Math.floor(n) || 1));
    const colours = Math.min(COLOURS.length, 2 + Math.ceil(num / 3.5));
    const hidden = num >= 6 && num % 3 === 0;
    const lock = num >= 10 && num % 4 === 2;
    return { num, colours, empties: 2, hidden, lock };
  }

  // A small seeded random source.
  function random(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---- A board ----
  // { bottles: [{ layers: [colour, ...] bottom to top, hide: how many of
  // the bottom layers are still hidden, lock: the colour that uncorks it,
  // or -1 }] }
  const clone = (state) => ({ bottles: state.bottles.map(b => ({ layers: b.layers.slice(), hide: b.hide, lock: b.lock })) });
  const top = (b) => b.layers[b.layers.length - 1];
  // how many layers of the top colour sit together on top
  function run(b) {
    let k = 0;
    for (let i = b.layers.length - 1; i >= 0 && b.layers[i] === top(b); i--) k++;
    return k;
  }
  const isFull = (b) => b.layers.length === CAP && run(b) === CAP;
  const isSolved = (state) => state.bottles.every(b => !b.layers.length || isFull(b));

  // Can the top of bottle a go into bottle b?
  function canPour(state, a, b) {
    const from = state.bottles[a], to = state.bottles[b];
    if (!from || !to || a === b || !from.layers.length || to.layers.length >= CAP) return false;
    if (from.lock >= 0 || to.lock >= 0 || isFull(from)) return false;
    return !to.layers.length || top(to) === top(from);
  }
  // Pour: how many layers moved (0 if it can't). Reveals the layer that
  // comes to the top, and uncorks bottles once their colour is filled.
  function pour(state, a, b) {
    if (!canPour(state, a, b)) return 0;
    const from = state.bottles[a], to = state.bottles[b];
    const amount = Math.min(run(from), CAP - to.layers.length);
    for (let k = 0; k < amount; k++) to.layers.push(from.layers.pop());
    if (from.layers.length && from.hide > from.layers.length - 1) from.hide = from.layers.length - 1;
    if (!from.layers.length) from.hide = 0;
    if (isFull(to)) for (const bottle of state.bottles) if (bottle.lock === top(to)) bottle.lock = -1;
    return amount;
  }
  // every pour that can be made now
  function moves(state) {
    const out = [];
    for (let a = 0; a < state.bottles.length; a++) for (let b = 0; b < state.bottles.length; b++) if (canPour(state, a, b)) out.push([a, b]);
    return out;
  }

  // ---- Solving ----
  // A depth-first search over boards, the likeliest pours first; boards
  // seen before are skipped (bottles in any order are the same board).
  // Returns the pours, or null (none, or more than `limit` boards).
  const keyOf = (state) => state.bottles.map(b => b.layers.join(".") + (b.lock >= 0 ? `#${b.lock}` : "")).sort().join("|");
  function worth(state, a, b) {
    const from = state.bottles[a], to = state.bottles[b];
    // pouring a bottle of one colour into an empty one changes nothing
    if (!to.layers.length && run(from) === from.layers.length) return -1;
    const amount = Math.min(run(from), CAP - to.layers.length);
    let score = amount;
    if (to.layers.length && to.layers.length + amount === CAP && run(to) === to.layers.length) score += 20; // fills a bottle
    if (to.layers.length) score += 8;                                                                    // onto its colour
    if (amount === run(from)) score += 4;                                                                // takes the whole run
    if (from.layers.length - amount && from.layers[from.layers.length - amount - 1] !== top(from)) score += 1;
    return score;
  }
  // jitter: a random source that shakes up equal choices (another way)
  function solve(start, limit = 200000, jitter = null) {
    const seen = new Set(), path = [];
    let boards = 0, gaveUp = false;
    const go = (state) => {
      if (isSolved(state)) return true;
      if (++boards > limit) { gaveUp = true; return false; }
      const key = keyOf(state);
      if (seen.has(key)) return false;
      seen.add(key);
      let firstEmpty = -1;
      const list = [];
      for (const [a, b] of moves(state)) {
        // one empty bottle is as good as another
        if (!state.bottles[b].layers.length && state.bottles[b].lock < 0) { if (firstEmpty < 0) firstEmpty = b; else if (b !== firstEmpty) continue; }
        const w = worth(state, a, b);
        if (w >= 0) list.push([w + (jitter ? jitter() * 3 : 0), a, b]);
      }
      list.sort((x, y) => y[0] - x[0]);
      for (const [, a, b] of list) {
        const next = clone(state);
        pour(next, a, b);
        path.push([a, b]);
        if (go(next)) return true;
        path.pop();
        if (gaveUp) return false;
      }
      return false;
    };
    return go(clone(start)) ? path : null;
  }
  // Shorten a found way: drop pours that come back to a board seen
  // earlier on it.
  function tidy(start, path) {
    let best = path.slice();
    const boards = [keyOf(start)];
    let state = clone(start);
    for (const [a, b] of best) { pour(state, a, b); boards.push(keyOf(state)); }
    for (let i = 0; i < boards.length; i++) {
      const j = boards.lastIndexOf(boards[i]);
      if (j > i) { best.splice(i, j - i); boards.splice(i, j - i); }
    }
    return best;
  }

  // ---- Dealing a level ----
  // The colours, CAP of each, shuffled into full bottles, then the empty
  // ones; hidden levels hide all but the top layer, a lock level corks a
  // bottle with a colour it doesn't hold. Dealt again (next seed) until
  // no bottle starts sorted and the level can be solved.
  function deal(level) {
    for (let attempt = 0; attempt < 400; attempt++) {
      const rnd = random(level.num * 7919 + attempt * 104729 + 17);
      const layers = [];
      for (let c = 0; c < level.colours; c++) for (let k = 0; k < CAP; k++) layers.push(c);
      for (let i = layers.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [layers[i], layers[j]] = [layers[j], layers[i]]; }
      const bottles = [];
      for (let c = 0; c < level.colours; c++) bottles.push({ layers: layers.slice(c * CAP, c * CAP + CAP), hide: level.hidden ? CAP - 1 : 0, lock: -1 });
      if (bottles.some(b => run(b) >= 3)) continue;
      for (let e = 0; e < level.empties; e++) bottles.push({ layers: [], hide: 0, lock: -1 });
      if (level.lock) {
        const which = Math.floor(rnd() * level.colours), held = new Set(bottles[which].layers);
        const free = [];
        for (let c = 0; c < level.colours; c++) if (!held.has(c)) free.push(c);
        if (!free.length) continue;
        bottles[which].lock = free[Math.floor(rnd() * free.length)];
      }
      const state = { bottles };
      const way = solve(state);
      if (!way) continue;
      // a few more searches, each shaken differently, for a shorter way
      let short = tidy(state, way);
      for (let k = 0; k < 6; k++) {
        const other = solve(state, 60000, random(level.num * 31 + k * 977 + attempt));
        if (other && other.length < short.length) { const t = tidy(state, other); if (t.length < short.length) short = t; }
      }
      return { state, par: short.length, way: short };
    }
    throw new Error(`level ${level.num}: no solvable deal`);
  }
  // what is left to do from here: the next pour, or null at a dead end
  function hint(state, limit = 60000) {
    const way = solve(state, limit);
    return way && way.length ? way[0] : null;
  }

  // ---- Stars and rewards ----
  // Three stars within par pours (the solver's way) without the extra
  // bottle, two within half as many again plus two, else one.
  function starsFor(par, pours, usedExtra = false) {
    if (pours <= par && !usedExtra) return 3;
    return pours <= Math.ceil(par * 1.5) + 2 ? 2 : 1;
  }
  // Coins each clear (half on a replay); the first clear gems, star dust
  // and ore for the card battles; three stars the first time more gems.
  function rewardFor(level, first, stars, before = 0) {
    const coins = Math.round((30 + 6 * level.num) * (first ? 1 : .5));
    const gems = (first ? 10 : 0) + (stars >= 3 && before < 3 ? 10 : 0);
    return { coins, gems, dust: first ? 3 : 0, ore: first ? 5 : 0 };
  }

  return {
    LEVELS, CAP, UNDOS, EXTRAS, HINTS, COLOURS,
    levelOf, random, clone, top, run, isFull, isSolved, canPour, pour, moves, solve, tidy, deal, hint, starsFor, rewardFor
  };
});

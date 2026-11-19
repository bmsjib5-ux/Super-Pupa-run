// Potion sort (ห้องยาวิเศษ Pupa): the screens. The rules live in
// potion-engine.js; game.js lends the save, sounds and coins through
// window.PupaGame and keeps its own keys quiet while this is open.
//
// save.potion = { stars: { level: best stars } }.
(() => {
  "use strict";
  const P = window.PupaPotionEngine;
  const screen = document.querySelector("#potionScreen");
  if (!P || !screen) return;

  const game = () => window.PupaGame;
  const save = () => game().save;
  const tone = (...args) => game()?.tone(...args);
  const announce = (text) => game()?.announce(text);
  const store = () => game().writeSave();
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const calm = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const wait = (ms) => new Promise(done => setTimeout(done, ms));
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const button = (className, text, handler, label) => {
    const node = el("button", className, text);
    node.type = "button";
    if (label) node.setAttribute("aria-label", label);
    if (handler) game().onTap(node, (event) => { if (!node.disabled) handler(event); });
    return node;
  };
  const stars = (n) => "★".repeat(n) + "☆".repeat(3 - n);
  const colourName = (c) => P.COLOURS[c].name;
  const twist = (key) => P.TWISTS.find(t => t.key === key);
  // the hard chapters' tiers: a mark, a tag, the card's head and words
  const TIERS = [null,
    { mark: "🔥", tag: "🔥 ยากพิเศษ", card: "🔥 บทท้าทาย!", words: "ยากพิเศษ" },
    { mark: "💀", tag: "💀 ยากสุดขีด", card: "💀 บทยากสุดขีด!", words: "ยากสุดขีด" },
    { mark: "🌀", tag: "🌀 ระดับตำนาน", card: "🌀 บทระดับตำนาน!", words: "ระดับตำนาน" },
    { mark: "👑", tag: "👑 ราชันย์", card: "👑 บทราชันย์แห่งยา!", words: "ระดับราชันย์" }];
  const tierOf = (hard) => TIERS[Number(hard)] || TIERS[1];
  // the level each twist first comes in on
  const firstOf = {};
  for (let n = 1; n <= P.LEVELS; n++) for (const key of P.twistsOf(P.levelOf(n))) if (!firstOf[key]) firstOf[key] = n;

  // ---- The save ----
  function progress() {
    const s = save();
    const raw = s.potion && typeof s.potion === "object" ? s.potion : {};
    const out = {};
    for (let n = 1; n <= P.LEVELS; n++) { const v = Math.min(3, Math.floor(Number(raw.stars?.[n]) || 0)); if (v > 0) out[n] = v; }
    s.potion = { stars: out };
    return s.potion;
  }
  const record = () => save().potion;
  const isOpenLevel = (n) => n === 1 || (record().stars[n - 1] || 0) > 0;
  const nextLevel = () => { for (let n = 1; n <= P.LEVELS; n++) if (!record().stars[n]) return n; return P.LEVELS; };
  // a level's twists, as icons and words
  const twistIcons = (level) => P.twistsOf(level).map(key => twist(key).icon).join("");
  const twistWords = (level) => P.twistsOf(level).map(key => twist(key).name).join(" · ");

  // ---- The frame ----
  const frame = el("div", "shop-card potion-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "ห้องยาวิเศษ Pupa");
  title.id = "potionTitle";
  const wallet = el("div", "shop-wallet");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  const homeButton = button("icon-button potion-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(homeButton, title, wallet);
  const body = el("div", "potion-body");
  frame.append(head, body);
  screen.append(frame);
  function showCoins() {
    wallet.querySelector("b").textContent = fmt(save().coins);
    wallet.querySelector(".gems").textContent = fmt(save().gems || 0);
    wallet.setAttribute("aria-label", `เหรียญ ${fmt(save().coins)} เพชร ${fmt(save().gems || 0)}`);
  }

  let isShown = false;
  let play = null;   // the level being played, if any
  const shownTwists = new Set();   // new-twist cards shown this visit

  function open() {
    if (!game()) return;
    progress();
    isShown = true;
    screen.hidden = false;
    game().setPotionOpen?.(true);
    showLevels();
    tone(659, .07, "triangle", .04);
    homeButton.focus();
  }
  function goHome() {
    stopPlay();
    isShown = false;
    screen.hidden = true;
    game().setPotionOpen?.(false);
    game().showModes?.();
  }
  function key(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    if (play) showLevels();
    else goHome();
  }

  // ---- Choosing a level ----
  function showLevels() {
    stopPlay();
    showCoins();
    const r = record(), next = nextLevel();
    const got = Object.values(r.stars).reduce((a, b) => a + b, 0);
    const intro = el("section", "potion-intro");
    const pic = el("img", "potion-intro-pic");
    pic.src = "assets/chantra-hero.webp";
    pic.alt = "";
    const words = el("div", "potion-intro-words");
    words.append(el("b", null, "เทน้ำยาให้แต่ละขวดเหลือสีเดียว"),
      el("span", null, `แตะขวดที่จะเท แล้วแตะขวดปลายทาง เทได้เฉพาะลงขวดว่าง หรือบนน้ำยาสีเดียวกัน ขวดละ ${P.CAP} ชั้น เทไม่เกินเป้าได้ ★★★ · ${P.LEVELS} ด่าน ${P.CHAPTERS.length} บท ยิ่งสูงยิ่งมีลูกเล่นใหม่`));
    intro.append(pic, words);
    // every twist, open to read
    const guide = el("details", "potion-guide");
    guide.append(el("summary", null, `ลูกเล่นในห้องยา (${P.TWISTS.length} แบบ)`));
    const list = el("div", "potion-guide-list");
    for (const t of P.TWISTS) {
      const row = el("p", "potion-guide-row");
      row.append(el("span", "potion-guide-icon", t.icon), el("b", null, t.name), el("small", null, `${t.text} · เริ่มด่าน ${firstOf[t.key]}`));
      list.append(row);
    }
    guide.append(list);
    const go = button("primary-button potion-go", `▶ เล่นด่าน ${next}`, () => startLevel(next));
    const sum = el("p", "potion-sum", `★ ${got}/${P.LEVELS * 3} · ผ่านแล้ว ${Object.keys(r.stars).length}/${P.LEVELS} ด่าน`);
    const grid = el("div", "potion-levels");
    for (const chapter of P.CHAPTERS) {
      let have = 0;
      for (let n = chapter.from; n <= chapter.to; n++) have += r.stars[n] || 0;
      const headRow = el("h3", `potion-chapter${isOpenLevel(chapter.from) ? "" : " is-locked"}${chapter.hard ? " is-hard" : ""}`);
      headRow.append(el("span", "potion-chapter-icon", chapter.icon), el("b", null, chapter.name), ...(chapter.hard ? [el("span", `potion-hard-tag is-tier${Number(chapter.hard)}`, tierOf(chapter.hard).tag)] : []), el("small", null, `★ ${have}/${(chapter.to - chapter.from + 1) * 3}`));
      headRow.lastChild.prepend(el("span", "potion-chapter-range", `ด่าน ${chapter.from}–${chapter.to} · `));
      grid.append(headRow);
      for (let n = chapter.from; n <= chapter.to; n++) {
        const lv = P.levelOf(n), open = isOpenLevel(n), got = r.stars[n] || 0, words = twistWords(lv);
        const tile = button(`potion-level${got ? " is-cleared" : open ? " is-next" : " is-locked"}${lv.hard ? " is-hard" : ""}`, null, () => startLevel(n),
          `ด่าน ${n}${lv.hard ? ` ${tierOf(lv.hard).words}` : ""} ${open ? (got ? `ได้ ${got} ดาว` : "เล่นได้") : "ล็อกอยู่"} · น้ำยา ${lv.colours} สี${words ? ` · ${words}` : ""}`);
        tile.disabled = !open;
        tile.append(el("b", null, open ? String(n) : "🔒"), el("small", "potion-level-stars", open ? stars(got) : ""), el("small", "potion-level-info", `${lv.colours} สี`), el("small", `potion-level-twists${P.twistsOf(lv).length >= 6 ? " is-many" : ""}`, twistIcons(lv)));
        grid.append(tile);
      }
    }
    body.replaceChildren(intro, guide, go, sum, grid);
    grid.querySelector(".is-next")?.scrollIntoView({ block: "nearest" });
  }

  // ---- Playing a level ----
  function startLevel(n) {
    if (!isOpenLevel(n)) return;
    stopPlay();
    const level = P.levelOf(n);
    const dealt = P.deal(level);
    const view = el("section", "potion-play");
    const bar = el("div", "potion-bar");
    const name = el("b", "potion-name", `ด่าน ${n}${level.hard ? ` ${tierOf(level.hard).mark}` : ""}${twistIcons(level) ? ` · ${twistIcons(level)}` : ""}`);
    const count = el("span", "potion-count");
    const undo = button("potion-tool", null, () => useUndo(), "ย้อนกลับ");
    const extra = button("potion-tool", null, () => useExtra(), "เพิ่มขวดเปล่า");
    const hint = button("potion-tool", null, () => useHint(), "คำใบ้");
    const again = button("potion-tool", "⟲", () => restart(), "เริ่มด่านใหม่");
    bar.append(name, count, undo, extra, hint, again);
    const goal = el("p", "potion-goal");
    // the level's twists: tap one to read it again
    const twists = el("div", "potion-twists");
    for (const key of P.twistsOf(level)) {
      const t = twist(key);
      twists.append(button("potion-twist", `${t.icon} ${t.name}`, () => say(`${t.icon} ${t.name}: ${t.text}`), `${t.name}: ${t.text}`));
    }
    const shelf = el("div", "potion-shelf");
    const note = el("p", "potion-note");
    note.setAttribute("aria-live", "polite");
    view.append(bar, goal, twists, shelf, note);
    body.replaceChildren(view);
    play = { level, par: dealt.par, start: P.clone(dealt.state), state: P.clone(dealt.state), history: [], pours: 0,
      undos: P.UNDOS, extras: P.EXTRAS, hints: P.HINTS, usedExtra: false, pick: -1, busy: false, over: false,
      view, shelf, note, count, goal, undo, extra, hint, nodes: [] };
    build();
    paintTools();
    announce(`ด่าน ${n} · น้ำยา ${level.colours} สี · เป้า ${dealt.par} ครั้ง`);
    tone(523, .08, "triangle", .05); tone(784, .1, "triangle", .05, .08);
    // a twist that comes in on this level, the first time through
    // (or a hard chapter's first level: what makes it hard)
    const fresh = P.twistsOf(level).filter(key => firstOf[key] === n && !shownTwists.has(key));
    const chapter = P.chapterOf(n), opens = chapter.note && chapter.from === n && !shownTwists.has(`chapter${n}`);
    if (record().stars[n]) return;
    if (fresh.length) { fresh.forEach(key => shownTwists.add(key)); showCard("✨ ลูกเล่นใหม่!", fresh.map(key => twist(key)).map(t => ({ icon: t.icon, name: t.name, text: t.text }))); }
    else if (opens) { shownTwists.add(`chapter${n}`); showCard(tierOf(chapter.hard).card, [{ icon: chapter.icon, name: chapter.name, text: chapter.note }]); }
  }
  // A card over the shelves: a twist new on this level, or a hard chapter.
  function showCard(tag, items) {
    const p = play;
    p.busy = true;
    const box = el("div", "potion-cover potion-new-twist");
    box.append(el("p", "potion-new-tag", tag));
    for (const t of items) box.append(el("span", "potion-new-icon", t.icon), el("h3", null, t.name), el("p", null, t.text));
    const ok = button("primary-button", "เข้าใจแล้ว ▶", () => { box.remove(); if (play === p) p.busy = false; });
    box.append(ok);
    p.view.append(box);
    [659, 880, 1175].forEach((note, i) => tone(note, .08, "sine", .04, .2 + i * .08));
    ok.focus();
  }
  function restart() {
    const p = play;
    if (!p || p.busy) return;
    startLevel(p.level.num);
    say("เริ่มด่านใหม่แล้ว");
  }

  // The bottles, a button each, in one row or two.
  function build() {
    const p = play;
    p.nodes = p.state.bottles.map((b, i) => {
      const node = button("potion-bottle", null, () => tap(i));
      const glass = el("span", "potion-glass");
      for (let k = 0; k < P.capOf(b); k++) glass.append(el("span", "potion-layer"));
      glass.append(el("span", "potion-shine"), el("span", "potion-frost"));
      node.style.setProperty("--cap", String(P.capOf(b)));
      node.classList.toggle("is-small", P.capOf(b) < P.CAP);
      node.classList.toggle("is-drip", b.drip);
      node.classList.toggle("is-funnel", b.funnel);
      node.classList.toggle("is-only", b.only >= 0);
      if (b.only >= 0) node.style.setProperty("--o", P.COLOURS[b.only].hex);
      node.append(el("span", "potion-mouth"), el("span", "potion-cork"), glass);
      // what sort of bottle, on a badge
      const badge = b.funnel ? "⏬" : b.drip ? "💧" : b.only >= 0 ? P.COLOURS[b.only].sign : P.capOf(b) < P.CAP ? String(P.capOf(b)) : "";
      if (badge) node.append(el("span", `potion-badge${b.only >= 0 && !b.funnel && !b.drip ? " is-tint" : ""}`, badge));
      return node;
    });
    p.shelf.replaceChildren(...p.nodes);
    layout();
    paint();
  }
  // as many rows as make the bottles biggest (a bottle is 1 wide and
  // 3.3 tall, with room round it)
  function layout() {
    const p = play;
    if (!p) return;
    const count = p.nodes.length, W = p.shelf.clientWidth, H = p.shelf.clientHeight;
    let best = { width: 0, perRow: count };
    for (let rows = 1; rows <= 4; rows++) {
      const perRow = Math.ceil(count / rows), width = Math.min(70, W / (perRow * 1.45), H / (Math.ceil(count / perRow) * 4.4));
      if (width > best.width + 2) best = { width, perRow };
    }
    p.shelf.style.setProperty("--bw", `${Math.floor(Math.max(26, best.width))}px`);
    p.shelf.style.setProperty("--per", String(best.perRow));
  }
  // a light potion's sign is drawn dark
  const light = (hex) => { const n = parseInt(hex.slice(1), 16); return ((n >> 16) * .299 + ((n >> 8) & 255) * .587 + (n & 255) * .114) > 170; };
  function paint() {
    const p = play;
    p.state.bottles.forEach((b, i) => {
      const node = p.nodes[i];
      if (!node) return;
      const layers = node.querySelectorAll(".potion-layer");
      layers.forEach((layer, k) => {
        const c = b.layers[k];
        layer.classList.toggle("is-on", c != null);
        const hidden = c != null && k < b.hide;
        layer.classList.toggle("is-hidden", hidden);
        if (c == null) { layer.style.removeProperty("--c"); layer.textContent = ""; return; }
        layer.style.setProperty("--c", hidden ? "#3b2560" : P.COLOURS[c].hex);
        layer.classList.toggle("is-light", !hidden && light(P.COLOURS[c].hex));
        layer.textContent = hidden ? "?" : P.COLOURS[c].sign;
      });
      const done = P.isFull(b);
      node.classList.toggle("is-done", done);
      node.classList.toggle("is-ice", b.ice > 0);
      node.querySelector(".potion-frost").textContent = b.ice > 0 ? `❄️${b.ice}` : "";
      node.classList.toggle("is-picked", p.pick === i);
      node.classList.toggle("is-locked", b.lock >= 0);
      const cork = node.querySelector(".potion-cork");
      cork.textContent = b.lock >= 0 ? "🔒" : "";
      if (b.lock >= 0) cork.style.setProperty("--c", P.COLOURS[b.lock].hex); else cork.style.removeProperty("--c");
      node.setAttribute("aria-label", describe(b, i));
    });
    p.count.textContent = `เท ${p.pours}`;
    p.goal.textContent = `เป้า ★★★: เทไม่เกิน ${p.par} ครั้ง${p.usedExtra ? " (ใช้ขวดเสริมแล้ว ได้สูงสุด ★★)" : ""}`;
  }
  // the bottle's sort, in words
  function sortOf(b) {
    const out = [];
    if (P.capOf(b) < P.CAP) out.push(`ขวดจิ๋วจุ ${P.capOf(b)} ชั้น`);
    if (b.only >= 0) out.push(`รับเฉพาะสี${colourName(b.only)}`);
    if (b.drip) out.push("ขวดหยด เทออกทีละชั้น");
    if (b.funnel) out.push("ขวดกรวย เทออกไม่ได้");
    if (b.ice > 0) out.push(`แข็งตัว ละลายเมื่อเทอีก ${b.ice} ครั้ง`);
    if (b.lock >= 0) out.push(`ปิดจุก เปิดเมื่อเรียงสี${colourName(b.lock)}ครบ`);
    return out.length ? ` (${out.join(", ")})` : "";
  }
  function describe(b, i) {
    if (!b.layers.length) return `ขวด ${i + 1}${sortOf(b)} ว่าง`;
    const parts = [];
    for (let k = b.layers.length - 1; k >= 0; k--) parts.push(k < b.hide ? "ซ่อนอยู่" : colourName(b.layers[k]));
    return `ขวด ${i + 1}${sortOf(b)}${P.isFull(b) ? " เรียงครบแล้ว" : ""}: จากบนลงล่าง ${parts.join(", ")}`;
  }
  const iceWhy = (b) => `ขวดนี้แข็งตัวอยู่ ❄️ จะละลายเมื่อเทขวดอื่นอีก ${b.ice} ครั้ง`;

  function tap(i) {
    const p = play;
    if (!p || p.over || p.busy) return;
    clearHint();
    const b = p.state.bottles[i];
    if (p.pick < 0) {
      if (!b.layers.length) { nope(i, "เลือกขวดที่มีน้ำยาก่อน แล้วค่อยแตะขวดปลายทาง"); return; }
      if (b.lock >= 0) { nope(i, `ขวดนี้ปิดจุกอยู่ จะเปิดเมื่อเรียงสี${colourName(b.lock)}ครบ 1 ขวด`); return; }
      if (b.ice > 0) { nope(i, iceWhy(b)); return; }
      if (P.isFull(b)) { nope(i, "ขวดนี้เรียงครบแล้ว"); return; }
      if (b.funnel) { nope(i, "ขวดกรวยเทออกไม่ได้ ⏬ เติมสีเดิมลงไปให้ครบ 4 ชั้นแทน"); return; }
      p.pick = i;
      paint();
      tone(660, .04, "triangle", .03);
      return;
    }
    if (p.pick === i) { p.pick = -1; paint(); tone(330, .04, "triangle", .03); return; }
    const from = p.pick;
    if (P.canPour(p.state, from, i)) { pourInto(from, i); return; }
    // not here: pick this one instead if it can be poured from, else say why
    const to = p.state.bottles[i];
    if (to.lock >= 0) { nope(i, `ขวดนี้ปิดจุกอยู่ จะเปิดเมื่อเรียงสี${colourName(to.lock)}ครบ 1 ขวด`); return; }
    if (to.ice > 0) { nope(i, iceWhy(to)); return; }
    if (to.layers.length >= P.capOf(to)) { nope(i, P.capOf(to) < P.CAP ? `ขวดจิ๋วนี้จุได้แค่ ${P.capOf(to)} ชั้น เต็มแล้ว` : "ขวดนี้เต็มแล้ว"); return; }
    if (to.only >= 0 && P.top(p.state.bottles[from]) !== to.only) { nope(i, `ขวดนี้รับเฉพาะน้ำยาสี${colourName(to.only)} ${P.COLOURS[to.only].sign}`); return; }
    nope(i, `เทได้เฉพาะลงขวดว่าง หรือบนน้ำยาสีเดียวกัน (สี${colourName(P.top(p.state.bottles[from]))})`);
  }
  function nope(i, why) {
    const node = play.nodes[i];
    node.classList.remove("is-no"); void node.offsetWidth; node.classList.add("is-no");
    tone(160, .1, "square", .04);
    say(why);
  }

  async function pourInto(a, b) {
    const p = play;
    p.history.push({ state: P.clone(p.state), pours: p.pours });
    const colour = P.top(p.state.bottles[a]);
    const locksBefore = p.state.bottles.filter(x => x.lock >= 0).length;
    const iceBefore = p.state.bottles.filter(x => x.ice > 0).length;
    const before = p.state.bottles[b].layers.length;
    const amount = P.pour(p.state, a, b);
    p.pours++;
    p.pick = -1;
    p.busy = true;
    const A = p.nodes[a], B = p.nodes[b];
    if (!calm()) {
      // the bottle goes over the other and tips, its mouth just above the
      // other's (places from the layout, so a lifted bottle doesn't count)
      // (a small bottle's mouth sits lower)
      const w = A.offsetWidth, h = A.offsetHeight, dir = B.offsetLeft >= A.offsetLeft ? 1 : -1, tilt = 72 * Math.PI / 180;
      const lowA = A.querySelector(".potion-glass").offsetTop - h * .08, lowB = B.querySelector(".potion-glass").offsetTop - h * .08;
      const mouthX = B.offsetLeft + w / 2, mouthY = B.offsetTop + lowB + h * .08 - w * .25, reach = h / 2 - lowA;
      const dx = mouthX - dir * Math.sin(tilt) * reach - (A.offsetLeft + w / 2), dy = mouthY + Math.cos(tilt) * reach - (A.offsetTop + h / 2);
      A.classList.remove("is-picked");
      A.classList.add("is-pouring");
      A.style.transform = `translate(${dx}px, ${dy}px) rotate(${dir * 72}deg)`;
      tone(523, .05, "triangle", .03);
      await wait(200);
      // the stream falls from the mouth to where the potion now reaches
      const surface = B.offsetTop + h - (before + amount) * .22 * .92 * h;
      const stream = el("i", "potion-stream");
      stream.style.setProperty("--c", P.COLOURS[colour].hex);
      stream.style.left = `${mouthX}px`;
      stream.style.top = `${mouthY}px`;
      stream.style.height = `${Math.max(w * .3, surface - mouthY)}px`;
      p.shelf.append(stream);
      paint();
      markNew(b, before, amount);
      for (let k = 0; k < amount; k++) tone(392 + (before + k) * 80, .07, "sine", .035, k * .07);
      await wait(260);
      stream.remove();
      A.style.transform = "";
      await wait(170);
      A.classList.remove("is-pouring");
    } else {
      paint();
      tone(523, .06, "sine", .035);
    }
    if (play !== p) return;
    p.busy = false;
    if (P.isFull(p.state.bottles[b])) filled(b);
    if (p.state.bottles.filter(x => x.lock >= 0).length < locksBefore) uncorked();
    if (p.state.bottles.filter(x => x.ice > 0).length < iceBefore) thawed();
    paintTools();
    if (P.isSolved(p.state)) { finish(); return; }
    if (!P.moves(p.state).length) say("ไม่มีที่ให้เทแล้ว ลองย้อนกลับ ↶ เพิ่มขวด หรือเริ่มใหม่ ⟲");
  }
  // the layers just poured fill in from below
  function markNew(b, from, amount) {
    const layers = play.nodes[b].querySelectorAll(".potion-layer");
    for (let k = from; k < from + amount; k++) { layers[k]?.classList.remove("is-new"); void layers[k]?.offsetWidth; layers[k]?.classList.add("is-new"); }
  }
  function filled(b) {
    const node = play.nodes[b];
    node.classList.remove("is-sealed"); void node.offsetWidth; node.classList.add("is-sealed");
    [784, 988, 1175].forEach((note, i) => tone(note, .09, "triangle", .045, i * .06));
    say(`เรียงสี${colourName(P.top(play.state.bottles[b]))}ครบแล้ว!`);
  }
  function uncorked() {
    [659, 880].forEach((note, i) => tone(note, .08, "sine", .04, i * .07));
    say("ขวดปิดจุกเปิดแล้ว!");
  }
  function thawed() {
    [1047, 1319, 1568].forEach((note, i) => tone(note, .06, "sine", .03, i * .05));
    say("น้ำแข็งละลายแล้ว! ขวดนั้นเทได้แล้ว");
  }

  // ---- Tools ----
  function useUndo() {
    const p = play;
    if (!p || p.over || p.busy || p.undos <= 0 || !p.history.length) return;
    const last = p.history.pop();
    p.state = last.state;
    p.pours = last.pours;
    p.undos--;
    p.pick = -1;
    paint();
    paintTools();
    tone(440, .05, "triangle", .03); tone(330, .06, "triangle", .03, .05);
    say("ย้อนกลับ 1 ครั้ง");
  }
  function useExtra() {
    const p = play;
    if (!p || p.over || p.busy || p.extras <= 0) return;
    p.extras--;
    p.usedExtra = true;
    // the extra bottle stays even when pours are taken back
    const add = (state) => state.bottles.push(P.bottle());
    add(p.state);
    for (const h of p.history) add(h.state);
    p.pick = -1;
    build();
    paintTools();
    [523, 784].forEach((note, i) => tone(note, .07, "triangle", .04, i * .06));
    say("เพิ่มขวดเปล่าแล้ว 1 ขวด (ด่านนี้ได้สูงสุด ★★)");
  }
  function useHint() {
    const p = play;
    if (!p || p.over || p.busy || p.hints <= 0) return;
    const move = P.hint(p.state);
    if (!move) { say("ทางตันแล้ว ลองย้อนกลับ ↶ เพิ่มขวด หรือเริ่มใหม่ ⟲"); tone(200, .1, "square", .03); return; }
    p.hints--;
    paintTools();
    clearHint();
    p.pick = -1;
    paint();
    p.nodes[move[0]].classList.add("is-hint-from");
    p.nodes[move[1]].classList.add("is-hint-to");
    p.hintTimer = setTimeout(clearHint, 2600);
    say(`ลองเทขวด ${move[0] + 1} ลงขวด ${move[1] + 1}`);
    tone(880, .06, "sine", .04); tone(1175, .08, "sine", .04, .06);
  }
  function clearHint() {
    if (!play) return;
    clearTimeout(play.hintTimer);
    for (const node of play.nodes) node.classList.remove("is-hint-from", "is-hint-to");
  }
  function paintTools() {
    const p = play;
    const set = (node, icon, n, label) => {
      node.replaceChildren(el("span", null, icon), el("small", null, String(n)));
      node.setAttribute("aria-label", `${label} เหลือ ${n} ครั้ง`);
    };
    set(p.undo, "↶", p.undos, "ย้อนกลับ");
    set(p.extra, "🧪", p.extras, "เพิ่มขวดเปล่า");
    set(p.hint, "💡", p.hints, "คำใบ้");
    p.undo.disabled = p.undos <= 0 || !p.history.length || p.over;
    p.extra.disabled = p.extras <= 0 || p.over;
    p.hint.disabled = p.hints <= 0 || p.over;
  }
  function say(text) {
    if (!play) return;
    play.note.textContent = text;
    clearTimeout(play.noteTimer);
    play.noteTimer = setTimeout(() => { if (play) play.note.textContent = ""; }, 3200);
  }
  function stopPlay() {
    if (!play) return;
    clearTimeout(play.hintTimer); clearTimeout(play.noteTimer);
    play = null;
  }
  new ResizeObserver(() => { if (play && !play.over) layout(); }).observe(screen);

  // ---- The end ----
  function finish() {
    const p = play;
    p.over = true;
    paintTools();
    const n = p.level.num, r = record(), before = r.stars[n] || 0;
    const got = P.starsFor(p.par, p.pours, p.usedExtra);
    const reward = P.rewardFor(p.level, !before, got, before);
    r.stars[n] = Math.max(before, got);
    save().coins += reward.coins;
    save().gems = (save().gems || 0) + reward.gems;
    // star dust and ore go to the card battles, once their save exists
    const cards = save().cards;
    const toCards = cards && typeof cards === "object" && typeof cards.dust === "number" && typeof cards.ore === "number";
    if (toCards) { cards.dust += reward.dust; cards.ore += reward.ore; }
    store();
    showCoins();
    const parts = [`● ${fmt(reward.coins)}`];
    if (reward.gems) parts.push(`💎 ${reward.gems}`);
    if (toCards && reward.dust) parts.push(`✧ ${reward.dust}`);
    if (toCards && reward.ore) parts.push(`⛏ ${reward.ore}`);
    const box = el("div", "potion-cover potion-result");
    const chapter = P.chapterOf(n), endsChapter = !before && n === chapter.to;
    box.append(el("span", "potion-medal", endsChapter ? chapter.icon : "🏆"), el("h3", null, `ผ่านด่าน ${n}!`), el("p", "potion-stars", stars(got)),
      el("p", null, `เท ${p.pours} ครั้ง · เป้า ${p.par} ครั้ง${p.usedExtra ? " · ใช้ขวดเสริม" : ""}`),
      el("p", "potion-reward", `ได้รับ ${parts.join(" · ")}`),
      ...(endsChapter ? [el("p", "potion-chapter-done", n === P.LEVELS ? `👑 จบครบ ${P.LEVELS} ด่าน! คุณคือปรมาจารย์ห้องยาแล้ว (โบนัส 💎 20)` : `🎉 จบบท ${chapter.name}! (โบนัส 💎 20)`)] : []),
      el("p", "potion-tip", got < 3 ? (p.usedExtra ? "ไม่ใช้ขวดเสริม และเทไม่เกินเป้า เพื่อได้ ★★★" : `เทไม่เกิน ${p.par} ครั้ง เพื่อได้ ★★★`) : "ได้ครบ 3 ดาว!"));
    const actions = el("div", "title-actions");
    if (n < P.LEVELS) actions.append(button("primary-button", `ด่าน ${n + 1} ▶`, () => startLevel(n + 1)));
    actions.append(button(n < P.LEVELS ? "secondary-button" : "primary-button", "เล่นอีกครั้ง", () => startLevel(n)), button("secondary-button", "เลือกด่าน", () => showLevels()));
    box.append(actions);
    p.view.append(box);
    [523, 659, 784, 1047].forEach((note, i) => tone(note, .14, "triangle", .05, i * .1));
    announce(`ผ่านด่าน ${n} ได้ ${got} ดาว`);
    confetti(p.view);
    box.querySelector("button")?.focus();
  }
  function confetti(host) {
    if (calm()) return;
    const colours = P.COLOURS.map(c => c.hex);
    for (let i = 0; i < 40; i++) {
      const bit = el("i", "potion-confetti");
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = colours[i % colours.length];
      bit.style.animationDelay = `${Math.random() * .5}s`;
      bit.style.setProperty("--drift", `${(Math.random() - .5) * 120}px`);
      host.append(bit);
      setTimeout(() => bit.remove(), 2600);
    }
  }

  window.PupaPotion = { open, close: goHome, key, get isOpen() { return isShown; } };
  // Test link: ?potion opens straight into the potion room.
  if (new URLSearchParams(location.search).has("potion")) setTimeout(() => open(), 400);
})();

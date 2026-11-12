// สวนรวมร่างของ Pupa (the merge garden): the screen. The rules live in
// garden-engine.js; game.js lends the save, sounds and coins through
// window.PupaGame and keeps its own keys quiet while this is open.
//
// save.garden is the engine's garden as it stands (board, energy, level,
// orders...), saved after every change.
(() => {
  "use strict";
  const G = window.PupaGardenEngine;
  const screen = document.querySelector("#gardenScreen");
  if (!G || !screen) return;

  const game = () => window.PupaGame;
  const save = () => game().save;
  const tone = (...args) => game()?.tone(...args);
  const announce = (text) => game()?.announce(text);
  const store = () => game().writeSave();
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const calm = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
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
  const clock = (ms) => { const sec = Math.ceil(ms / 1000); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; };
  const friendName = (id) => window.PupaCardsEngine?.CARDS?.[id]?.name || (id === "pupa" ? "Pupa" : id);
  const REFILL = { gems: 15, energy: 40 };

  // ---- The save ----
  const garden = () => save().garden;
  function progress() {
    const s = save();
    s.garden = s.garden ? G.clean(s.garden) : G.create(Date.now(), (Math.random() * 1e9) >>> 0);
    G.syncEnergy(s.garden);
    return s.garden;
  }
  function pay(r) {
    const s = save();
    if (r.coins) s.coins += r.coins;
    if (r.gems) s.gems = (s.gems || 0) + r.gems;
    const cards = s.cards;
    const toCards = cards && typeof cards === "object" && typeof cards.dust === "number" && typeof cards.ore === "number";
    if (toCards) { cards.dust += r.dust || 0; cards.ore += r.ore || 0; }
    return toCards;
  }

  // ---- The frame ----
  const frame = el("div", "shop-card garden-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "สวนรวมร่างของ Pupa");
  title.id = "gardenTitle";
  const wallet = el("div", "shop-wallet");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  const homeButton = button("icon-button garden-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(homeButton, title, wallet);
  const body = el("div", "garden-body");
  frame.append(head, body);
  screen.append(frame);
  function showCoins() {
    wallet.querySelector("b").textContent = fmt(save().coins);
    wallet.querySelector(".gems").textContent = fmt(save().gems || 0);
    wallet.setAttribute("aria-label", `เหรียญ ${fmt(save().coins)} เพชร ${fmt(save().gems || 0)}`);
  }

  // the parts, built once
  const top = el("div", "garden-top");
  const levelBox = el("div", "garden-level");
  const levelText = el("b");
  const xpBar = el("span", "garden-xp");
  const xpFill = el("i");
  xpBar.append(xpFill);
  const xpText = el("small");
  levelBox.append(levelText, xpBar, xpText);
  const energyBox = el("div", "garden-energy");
  const energyText = el("b");
  const energyNext = el("small");
  const energyAdd = button("garden-energy-add", "+", () => openRefill(), "เติมพลังงาน");
  energyBox.append(energyText, energyNext, energyAdd);
  const albumButton = button("secondary-button garden-album-button", "📖 สมุดสะสม", () => openAlbum());
  top.append(levelBox, energyBox, albumButton);
  const main = el("div", "garden-main");
  const orders = el("section", "garden-orders");
  orders.setAttribute("aria-label", "ออเดอร์จากเพื่อน ๆ");
  const stage = el("div", "garden-stage");
  const board = el("div", "garden-board");
  board.setAttribute("role", "grid");
  board.setAttribute("aria-label", "แปลงสวน 7 คูณ 9 ช่อง");
  stage.append(board);
  const infoBar = el("section", "garden-info");
  infoBar.setAttribute("aria-live", "polite");
  main.append(top, orders, stage, infoBar);
  body.append(main);
  const cells = [];
  for (let i = 0; i < G.SIZE; i++) {
    const cell = el("button", "garden-cell");
    cell.type = "button";
    cell.dataset.i = String(i);
    cell.setAttribute("role", "gridcell");
    const item = el("span", "garden-item");
    const step = el("small", "garden-step");
    cell.append(item, step);
    board.append(cell);
    cells.push(cell);
  }

  let isShown = false;
  let selected = -1;
  let ticker = 0, hintTimer = 0;
  let cover = null;

  function open() {
    if (!game()) return;
    progress();
    isShown = true;
    screen.hidden = false;
    game().setGardenOpen?.(true);
    selected = -1;
    showCoins();
    paint();
    fit();
    requestAnimationFrame(fit);
    clearInterval(ticker);
    ticker = setInterval(paintTop, 1000);
    window.addEventListener("resize", fit);
    restHint();
    tone(659, .07, "triangle", .04);
    homeButton.focus();
  }
  function goHome() {
    closeCover();
    clearInterval(ticker);
    clearTimeout(hintTimer);
    window.removeEventListener("resize", fit);
    isShown = false;
    screen.hidden = true;
    game().setGardenOpen?.(false);
    game().showModes?.();
  }
  function key(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (cover) closeCover();
      else if (selected >= 0) { selected = -1; paint(); }
      else goHome();
    }
  }

  // the board as big as the room allows: 7 across, 9 down
  function fit() {
    const w = stage.clientWidth, h = stage.clientHeight, gap = 4;
    if (!w || !h) return;
    const size = Math.max(22, Math.floor(Math.min((w - 6 * gap) / G.COLS, (h - 8 * gap) / G.ROWS)));
    board.style.setProperty("--cell", `${size}px`);
  }

  // ---- Drawing ----
  function paint() {
    const s = garden();
    // what the orders want, and which cells could give it
    const wantCells = new Set();
    for (const o of s.orders) { const used = new Set(); for (const c of o.want) { const i = s.board.findIndex((x, j) => x === c && !used.has(j)); if (i >= 0) { used.add(i); wantCells.add(i); } } }
    s.board.forEach((code, i) => {
      const cell = cells[i], item = cell.firstChild, step = cell.lastChild;
      const inf = code ? G.info(code) : null;
      item.textContent = inf ? inf.icon : "";
      step.textContent = inf && !inf.maker ? String(inf.step) : inf?.maker ? "⚡" : "";
      cell.className = `garden-cell${code ? (inf.maker ? " is-maker" : " is-thing") : " is-empty"}${inf?.top ? " is-top" : ""}${i === selected ? " is-selected" : ""}${wantCells.has(i) ? " is-wanted" : ""}`;
      if (code) cell.style.setProperty("--tint", G.CHAINS[G.isMaker(code) ? code[1] : code[0]].color);
      else cell.style.removeProperty("--tint");
      cell.setAttribute("aria-label", inf ? `${inf.name}${inf.maker ? " แตะเพื่อเสก" : ` ขั้น ${inf.step} จาก ${inf.steps}`}` : "ช่องว่าง");
    });
    paintTop();
    paintOrders();
    paintInfo();
  }
  function paintTop() {
    if (!isShown) return;
    const s = garden(), now = Date.now();
    levelText.textContent = `🌸 สวน Lv ${s.level}`;
    xpFill.style.width = `${Math.min(100, s.xp / G.need(s.level) * 100)}%`;
    xpText.textContent = `${s.xp}/${G.need(s.level)}`;
    const e = G.energyNow(s, now), next = G.nextEnergyIn(s, now);
    energyText.textContent = `⚡ ${e}/${G.MAX_ENERGY}`;
    energyNext.textContent = next ? `+1 ใน ${clock(next)}` : "เต็ม";
    energyBox.classList.toggle("is-low", e < 5);
  }
  function paintOrders() {
    const s = garden();
    orders.replaceChildren(...s.orders.map((o, n) => {
      const card = el("article", "garden-order");
      const face = el("img", "garden-face");
      face.src = `assets/${o.who}-hero.webp`;
      face.alt = "";
      const words = el("div", "garden-order-words");
      words.append(el("b", null, friendName(o.who)));
      const wants = el("div", "garden-wants");
      const used = new Set();
      let ready = true;
      for (const c of o.want) {
        const i = s.board.findIndex((x, j) => x === c && !used.has(j));
        if (i >= 0) used.add(i); else ready = false;
        const inf = G.info(c);
        const w = el("span", `garden-want${i >= 0 ? " is-have" : ""}`, inf.icon);
        w.title = `${inf.name} (ขั้น ${inf.step})`;
        w.append(el("small", null, i >= 0 ? "✓" : String(inf.step)));
        wants.append(w);
      }
      words.append(wants, el("small", "garden-pay", `● ${fmt(o.coins)} · 🌸 ${o.xp}${o.energy ? ` · ⚡${o.energy}` : ""}`));
      const send = button(`primary-button garden-send${ready ? "" : " is-waiting"}`, ready ? "ส่ง!" : "ขาด", () => deliver(n), ready ? `ส่งของให้${friendName(o.who)}` : `ยังขาดของสำหรับ${friendName(o.who)}`);
      send.disabled = !ready;
      const swap = button("garden-swap", "↻", () => swapOrder(n), `เปลี่ยนออเดอร์ของ${friendName(o.who)} ใช้พลังงาน 1`);
      swap.title = "เปลี่ยนออเดอร์ (⚡1)";
      card.classList.toggle("is-ready", ready);
      card.append(face, words, send, swap);
      return card;
    }));
  }
  function paintInfo() {
    const s = garden();
    const code = selected >= 0 ? s.board[selected] : "";
    if (!code) {
      const tip = s.level <= 2 ? "แตะ 🧺 ตะกร้าเพื่อเสกเมล็ด แล้วลากของที่เหมือนกันมาวางทับกันเพื่อรวมร่าง! (หรือแตะของ แล้วแตะอีกชิ้นที่เหมือนกัน)" : "ลากของที่เหมือนกันมาวางทับกันเพื่อรวมร่าง · ของที่มีวงเหลืองคือของที่เพื่อนต้องการ";
      infoBar.replaceChildren(el("p", "garden-tip", tip));
      return;
    }
    const inf = G.info(code);
    const pic = el("span", "garden-info-pic", inf.icon);
    const words = el("div", "garden-info-words");
    if (inf.maker) {
      words.append(el("b", null, inf.name), el("small", null, `${inf.chain} · แตะเพื่อเสกของขั้น 1 (ใช้ ⚡1)`));
      infoBar.replaceChildren(pic, words, button("primary-button garden-act", "เสก ⚡1", () => make(selected)));
      return;
    }
    const nextInf = inf.top ? null : G.info(code[0] + (inf.step + 1));
    words.append(el("b", null, `${inf.name} · ขั้น ${inf.step}/${inf.steps}`), el("small", null, inf.top ? `${inf.chain} · ขั้นสูงสุด! เก็บเกี่ยวได้ ● ${G.HARVEST.coins} 💎 ${G.HARVEST.gems}` : `${inf.chain} · รวม 2 อันได้ ${nextInf.icon} ${nextInf.name}`));
    const act = inf.top
      ? button("primary-button garden-act", "เก็บเกี่ยว", () => reap(selected))
      : button("secondary-button garden-act", `ขาย ● ${G.sellFor(code)}`, () => sellIt(selected));
    infoBar.replaceChildren(pic, words, act);
  }

  // ---- Effects ----
  function pop(i, kind) {
    const cell = cells[i];
    cell.classList.remove("is-pop", "is-new");
    void cell.offsetWidth;
    cell.classList.add(kind);
  }
  function fly(from, to, icon) {
    if (calm()) return Promise.resolve();
    const a = cells[from].getBoundingClientRect(), b = cells[to].getBoundingClientRect();
    const ghost = el("span", "garden-fly", icon);
    ghost.style.left = `${a.left + a.width / 2}px`;
    ghost.style.top = `${a.top + a.height / 2}px`;
    ghost.style.fontSize = `${a.width * .6}px`;
    document.body.append(ghost);
    return new Promise(done => {
      requestAnimationFrame(() => {
        ghost.style.transform = `translate(calc(-50% + ${b.left - a.left}px), calc(-50% + ${b.top - a.top}px)) scale(1)`;
        setTimeout(() => { ghost.remove(); done(); }, 260);
      });
    });
  }
  function floatText(i, text) {
    const r = cells[i].getBoundingClientRect();
    const f = el("span", "garden-float", text);
    f.style.left = `${r.left + r.width / 2}px`;
    f.style.top = `${r.top}px`;
    document.body.append(f);
    setTimeout(() => f.remove(), 900);
  }
  function found(gems, code) {
    if (!gems) return;
    pay({ gems });
    showCoins();
    const inf = G.info(code);
    toast(`📖 ค้นพบใหม่: ${inf.icon} ${inf.name} · ได้ 💎 ${gems}`);
  }
  let toastTimer = 0;
  function toast(text) {
    let t = screen.querySelector(".garden-toast");
    if (!t) { t = el("p", "garden-toast"); t.setAttribute("role", "status"); frame.append(t); }
    t.textContent = text;
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), 2200);
  }

  // ---- Actions ----
  async function make(at) {
    const s = garden();
    const r = G.produce(s, at);
    if (r.error === "energy") { tone(196, .1, "triangle", .04); openRefill(); return; }
    if (r.error === "full") { tone(196, .1, "triangle", .04); toast("แปลงเต็มแล้ว! รวมร่างหรือขายของเพื่อเปิดที่ว่าง"); return; }
    if (r.error) return;
    store();
    tone(880 + Math.random() * 80, .05, "triangle", .035);
    cells[r.at].firstChild.textContent = "";
    await fly(r.from, r.at, G.info(r.code).icon);
    paint();
    pop(r.at, "is-new");
    found(r.gems, r.code);
    restHint();
  }
  function act(from, to) {
    const s = garden();
    const r = G.move(s, from, to);
    if (r.k === "none") return;
    store();
    selected = -1;
    paint();
    if (r.k === "join") {
      const n = Number(r.code[1]);
      tone(523 * Math.pow(1.122, n), .09, "triangle", .045);
      tone(523 * Math.pow(1.122, n + 4), .1, "sine", .03, .06);
      pop(r.at, "is-pop");
      found(r.gems, r.code);
      announce(`รวมร่างได้ ${G.info(r.code).name}`);
    } else tone(440, .04, "triangle", .025);
    restHint();
  }
  function sellIt(at) {
    const r = G.sell(garden(), at);
    if (r.error) return;
    pay({ coins: r.coins });
    store();
    showCoins();
    floatText(at, `● +${r.coins}`);
    tone(1175, .06, "triangle", .035);
    selected = -1;
    paint();
  }
  function reap(at) {
    const r = G.harvest(garden(), at);
    if (r.error) return;
    pay(r);
    store();
    showCoins();
    floatText(at, `● +${r.coins} 💎 +${r.gems}`);
    [784, 988, 1319].forEach((note, i) => tone(note, .1, "sine", .045, i * .08));
    selected = -1;
    paint();
  }
  function deliver(n) {
    const s = garden(), who = s.orders[n]?.who;
    const r = G.fill(s, n);
    if (r.error) return;
    const toCards = pay(r);
    store();
    showCoins();
    selected = -1;
    paint();
    [659, 880, 1047].forEach((note, i) => tone(note, .08, "triangle", .045, i * .07));
    const card = orders.children[n];
    card?.classList.add("is-new");
    toast(`${friendName(who)} ขอบใจนะ! ● +${fmt(r.coins - (r.levels.length ? r.levels.reduce((a, l) => a + G.levelReward(l).coins, 0) : 0))} · 🌸 +${r.xp}`);
    if (r.levels.length) showLevelUp(r, toCards);
    restHint();
  }
  function swapOrder(n) {
    const r = G.swapOrder(garden(), n);
    if (r.error === "energy") { openRefill(); return; }
    if (r.error) return;
    store();
    tone(587, .05, "triangle", .03);
    paint();
  }

  // ---- Touch, mouse and keys on the board ----
  let press = null;
  board.addEventListener("pointerdown", (event) => {
    const cell = event.target.closest(".garden-cell");
    if (!cell || cover) return;
    const i = Number(cell.dataset.i);
    press = { i, id: event.pointerId, x: event.clientX, y: event.clientY, drag: null };
    if (!garden().board[i]) return;
    board.setPointerCapture?.(event.pointerId);
  });
  board.addEventListener("pointermove", (event) => {
    if (!press || press.id !== event.pointerId) return;
    const code = garden().board[press.i];
    if (!code) return;
    if (!press.drag && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 8) {
      const ghost = el("span", "garden-ghost", G.info(code).icon);
      ghost.style.fontSize = `${cells[0].getBoundingClientRect().width * .7}px`;
      document.body.append(ghost);
      press.drag = ghost;
      cells[press.i].classList.add("is-lifted");
      // its match glows
      garden().board.forEach((c, j) => { if (j !== press.i && G.canJoin(code, c)) cells[j].classList.add("is-match"); });
      clearHint();
    }
    if (press.drag) {
      press.drag.style.left = `${event.clientX}px`;
      press.drag.style.top = `${event.clientY}px`;
      const over = document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".garden-cell");
      for (const c of cells) c.classList.toggle("is-over", c === over);
    }
  });
  function endPress(event, cancel) {
    if (!press || press.id !== event.pointerId) return;
    const p = press;
    press = null;
    if (p.drag) {
      p.drag.remove();
      for (const c of cells) c.classList.remove("is-lifted", "is-match", "is-over");
      const over = cancel ? null : document.elementFromPoint(event.clientX, event.clientY)?.closest?.(".garden-cell");
      if (over && board.contains(over)) act(p.i, Number(over.dataset.i));
      else paint();
      return;
    }
    if (!cancel) tap(p.i);
  }
  board.addEventListener("pointerup", (event) => endPress(event, false));
  board.addEventListener("pointercancel", (event) => endPress(event, true));
  // keyboard: Enter or Space on a cell taps it
  board.addEventListener("keydown", (event) => {
    const cell = event.target.closest(".garden-cell");
    if (!cell) return;
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); tap(Number(cell.dataset.i)); }
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -G.COLS, ArrowDown: G.COLS };
    if (moves[event.key]) { event.preventDefault(); const j = Number(cell.dataset.i) + moves[event.key]; if (j >= 0 && j < G.SIZE) cells[j].focus(); }
  });
  // a tap: a maker makes; a thing is picked; a second tap on its twin joins
  // them, on an empty cell moves it there
  function tap(i) {
    const s = garden(), code = s.board[i];
    clearHint();
    if (G.isMaker(code)) { selected = i; paintInfo(); for (const c of cells) c.classList.toggle("is-selected", c === cells[i]); make(i); return; }
    if (selected >= 0 && selected !== i && G.isThing(s.board[selected])) {
      if (!code || G.canJoin(s.board[selected], code)) { act(selected, i); return; }
    }
    selected = code && selected !== i ? i : -1;
    if (code) tone(660, .03, "triangle", .02);
    paint();
  }

  // ---- Hints when idle ----
  function clearHint() { for (const c of cells) c.classList.remove("is-hint"); }
  function restHint() {
    clearTimeout(hintTimer);
    clearHint();
    hintTimer = setTimeout(() => {
      if (!isShown || cover || press) return;
      const pair = G.hintPair(garden());
      if (pair) for (const i of pair) cells[i].classList.add("is-hint");
      else {
        const s = garden();
        if (!s.orders.some(o => G.cellsFor(s, o))) { const m = s.board.findIndex(G.isMaker); if (m >= 0) cells[m].classList.add("is-hint"); }
      }
    }, 6000);
  }

  // ---- Covers: refill, album, level up ----
  function showCover(node) {
    closeCover();
    cover = el("div", "garden-cover");
    cover.append(node);
    game().onTap(cover, (event) => { if (event.target === cover) closeCover(); });
    frame.append(cover);
    node.querySelector("button")?.focus();
  }
  function closeCover() { cover?.remove(); cover = null; }
  function openRefill() {
    const s = garden(), box = el("div", "garden-box");
    const e = G.energyNow(s), next = G.nextEnergyIn(s);
    box.append(el("h3", null, "⚡ พลังงาน"), el("p", null, `ตอนนี้ ${e}/${G.MAX_ENERGY} · ${next ? `เพิ่ม 1 ทุก 2 นาที (อีก ${clock(next)})` : "เต็มแล้ว"}`),
      el("p", null, `เติมทันที +${REFILL.energy} ⚡ ด้วย 💎 ${REFILL.gems}`));
    const actions = el("div", "title-actions");
    const buy = button("primary-button", `เติม +${REFILL.energy} ⚡ (💎 ${REFILL.gems})`, () => {
      if ((save().gems || 0) < REFILL.gems) return;
      save().gems -= REFILL.gems;
      G.addEnergy(garden(), REFILL.energy);
      store();
      showCoins();
      [784, 988].forEach((note, i) => tone(note, .08, "triangle", .04, i * .07));
      closeCover();
      paint();
    });
    buy.disabled = (save().gems || 0) < REFILL.gems;
    actions.append(buy, button("secondary-button", "ปิด", () => closeCover()));
    box.append(actions);
    showCover(box);
  }
  function openAlbum() {
    const s = garden(), box = el("div", "garden-box garden-album");
    box.append(el("h3", null, "📖 สมุดสะสม"), el("p", null, "ทุกครั้งที่ได้ของขั้นใหม่ครั้งแรก (ตั้งแต่ขั้น 3) ได้รับเพชร"));
    for (const [k, c] of Object.entries(G.CHAINS)) {
      const open = c.unlock <= s.level;
      const row = el("div", "garden-album-row");
      row.append(el("b", null, `${c.maker.icon} ${c.name}${open ? "" : ` · ปลดล็อกที่สวน Lv ${c.unlock}`}`));
      const list = el("div", "garden-album-list");
      c.steps.forEach(([icon, name], n) => {
        const seen = (s.seen[k] || 0) > n;
        const item = el("span", `garden-album-item${seen ? "" : " is-hidden"}`, seen ? icon : "❔");
        item.append(el("small", null, seen ? name : `ขั้น ${n + 1}`));
        list.append(item);
      });
      row.append(list);
      box.append(row);
    }
    const actions = el("div", "title-actions");
    actions.append(button("primary-button", "ปิด", () => closeCover()));
    box.append(actions);
    showCover(box);
  }
  function showLevelUp(r, toCards) {
    const s = garden(), box = el("div", "garden-box garden-levelup");
    const parts = [`💎 ${r.gems}`, `⚡ ${r.levels.length * 20}`, `● ${fmt(r.levels.reduce((a, l) => a + G.levelReward(l).coins, 0))}`];
    if (toCards) parts.push(`✧ ${r.dust}`, `⛏ ${r.ore}`);
    box.append(el("span", "garden-medal", "🌸"), el("h3", null, `สวนเลเวล ${s.level}!`), el("p", "garden-reward", `ได้รับ ${parts.join(" · ")}`));
    for (const k of r.opened) {
      const c = G.CHAINS[k];
      box.append(el("p", "garden-open", `ปลดล็อก ${c.maker.icon} ${c.maker.name}: ${c.name}!`));
    }
    const actions = el("div", "title-actions");
    actions.append(button("primary-button", "เยี่ยม!", () => closeCover()));
    box.append(actions);
    [523, 659, 784, 1047].forEach((note, i) => tone(note, .12, "sine", .05, i * .1));
    announce(`สวนเลเวล ${s.level}`);
    showCover(box);
  }

  window.PupaGarden = { open, close: goHome, key, get isOpen() { return isShown; }, get garden() { return isShown ? garden() : null; } };
  // Test link: ?garden opens straight into the merge garden.
  if (new URLSearchParams(location.search).has("garden")) setTimeout(() => open(), 400);
})();

// Card battles (ศึกการ์ดแสงจันทร์): the screens. The rules live in
// cards-engine.js; game.js lends the save, sounds and monster drawings
// through window.PupaGame and keeps its own keys quiet while this is open.
//
// save.cards = { units: { id: level }, team: [5 ids, "" for empty, slots
// 0-1 front], stars: { stage: best stars }, auto, fast }.
(() => {
  "use strict";
  const E = window.PupaCardsEngine;
  const screen = document.querySelector("#cardsScreen");
  if (!E || !screen) return;

  const game = () => window.PupaGame;
  const save = () => game().save;
  const tone = (...args) => game()?.tone(...args);
  const announce = (text) => game()?.announce(text);
  const fmt = (n) => Math.round(n).toLocaleString("en-US");
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
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Hero cards use the hero pictures; pets and monsters are drawn by game.js.
  const PICTURES = {
    pupa: "assets/pupa-hero-3d.webp", jibjib: "assets/jibjib-hero.webp", baitoey: "assets/baitoey-hero.webp",
    ikuya: "assets/ikuya-hero.webp", pangji: "assets/pangji-hero.webp", pupav2: "assets/pupav2-hero.webp",
    dragon: "assets/dragon-pet.webp"
  };
  function portrait(kind) {
    if (PICTURES[kind]) {
      const img = el("img", "card-art");
      img.src = PICTURES[kind];
      img.alt = "";
      img.draggable = false;
      return img;
    }
    const canvas = el("canvas", "card-art");
    canvas.width = canvas.height = 112;
    canvas.setAttribute("aria-hidden", "true");
    game().paintPortrait(canvas, kind, 1000);
    return canvas;
  }
  const stars = (n, max = 3) => "★".repeat(n) + "☆".repeat(max - n);
  const STATUS = {
    shield: ["🛡", "เกราะ"], stun: ["💫", "มึนงง"], burn: ["🔥", "ไฟลวก"], atkUp: ["⚔", "พลังโจมตีเพิ่ม"],
    defUp: ["⛨", "พลังป้องกันเพิ่ม"], defDown: ["💔", "เกราะแตก"], taunt: ["🎯", "ยั่วยุ"]
  };

  // ---- Progress ----
  // Every card the player has, at its level. The starters are free, and a
  // hero or pet owned in the market brings its card along.
  function progress() {
    const s = save();
    const raw = s.cards && typeof s.cards === "object" ? s.cards : {};
    const units = {};
    for (const id of E.CARD_IDS) {
      const lv = Math.min(E.MAX_LEVEL, Math.floor(Number(raw.units?.[id]) || 0));
      if (lv > 0) units[id] = lv;
    }
    for (const id of [...E.STARTER, ...(s.shop?.owned || [])]) if (E.CARDS[id] && !units[id]) units[id] = 1;
    const seen = new Set();
    let team = (Array.isArray(raw.team) ? raw.team : []).slice(0, E.TEAM_SIZE).map(id => {
      if (!units[id] || seen.has(id)) return "";
      seen.add(id);
      return id;
    });
    while (team.length < E.TEAM_SIZE) team.push("");
    if (!team.some(Boolean)) team = [...E.STARTER_TEAM];
    const best = {};
    for (const stage of E.STAGES) {
      const n = Math.min(3, Math.floor(Number(raw.stars?.[stage.num]) || 0));
      if (n > 0) best[stage.num] = n;
    }
    s.cards = { units, team, stars: best, auto: Boolean(raw.auto), fast: Boolean(raw.fast) };
    return s.cards;
  }
  const cards = () => save().cards;
  const isCleared = (num) => (cards().stars[num] || 0) > 0;
  const isOpen = (num) => num === 1 || isCleared(num - 1);
  const store = () => game().writeSave();
  const teamPower = () => cards().team.filter(Boolean).reduce((sum, id) => sum + E.power(id, cards().units[id]), 0);
  // The stage a card is the first-clear prize of.
  const prizeStage = (id) => E.STAGES.find(stage => stage.card === id);

  // ---- The frame ----
  const frame = el("div", "shop-card cards-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "ศึกการ์ดแสงจันทร์");
  title.id = "cardsTitle";
  const wallet = el("div", "shop-wallet");
  wallet.setAttribute("aria-label", "เหรียญที่มี");
  wallet.innerHTML = "<i>●</i> <b></b>";
  const closeButton = button("icon-button", "✕", () => close(), "ปิดศึกการ์ด");
  head.append(title, wallet, closeButton);
  const body = el("div", "cards-body");
  frame.append(head, body);
  screen.append(frame);

  let isShown = false;
  let opener = null;
  let tab = "stages";
  let sheet = null;          // the open detail panel
  let battle = null;         // the running battle view, if any

  function showCoins() { wallet.querySelector("b").textContent = fmt(save().coins); }

  function open(event) {
    if (!game()) return;
    opener = event?.currentTarget || document.activeElement;
    progress();
    isShown = true;
    screen.hidden = false;
    game().setCardsOpen(true);
    showHub();
    tone(587, .07, "triangle", .04);
    closeButton.focus();
  }

  function close() {
    if (battle) { leaveBattle(); return; }
    if (sheet) { closeSheet(); return; }
    isShown = false;
    screen.hidden = true;
    game().setCardsOpen(false);
    opener?.focus?.();
  }

  // ---- Hub: stages and team ----
  function showHub() {
    battle = null;
    sheet = null;
    frame.classList.remove("is-battle");
    showCoins();
    const tabs = el("div", "shop-tabs cards-tabs");
    tabs.setAttribute("role", "tablist");
    for (const [key, label] of [["stages", "ด่าน"], ["team", "ทีมและการ์ด"]]) {
      const t = button("", label, () => { tab = key; showHub(); tone(587, .05, "triangle", .04); });
      t.setAttribute("role", "tab");
      t.setAttribute("aria-selected", String(tab === key));
      tabs.append(t);
    }
    const panel = el("div", "shop-list cards-scroll");
    panel.setAttribute("role", "tabpanel");
    if (tab === "stages") renderStages(panel); else renderTeam(panel);
    body.replaceChildren(tabs, panel);
  }

  function renderStages(panel) {
    const next = E.STAGES.find(stage => isOpen(stage.num) && !isCleared(stage.num));
    const intro = el("p", "cards-intro");
    intro.textContent = `พลังทีม ${fmt(teamPower())} · ${next ? `ด่านถัดไป: ${next.num} ${next.name}` : "ผ่านครบทุกด่านแล้ว!"}`;
    panel.append(intro);
    for (const chapter of E.CHAPTERS) {
      const section = el("section", "shop-section");
      const got = E.STAGES.filter(s => s.num >= chapter.from && s.num <= chapter.to).reduce((sum, s) => sum + (cards().stars[s.num] || 0), 0);
      const heading = el("h3", "shop-heading", chapter.name);
      heading.append(el("span", "world-stars", `★ ${got}/${(chapter.to - chapter.from + 1) * 3}`));
      const grid = el("div", "level-grid cards-stage-grid");
      for (const stage of E.STAGES.filter(s => s.num >= chapter.from && s.num <= chapter.to)) {
        const openStage = isOpen(stage.num), done = isCleared(stage.num);
        const tile = button(`level-tile${done ? " is-cleared" : openStage ? " is-next" : " is-locked"}`, null, () => stageSheet(stage));
        tile.style.setProperty("--accent", stage.num > 10 ? "#2fb6a6" : "#c5528a");
        tile.disabled = !openStage;
        tile.setAttribute("aria-label", `ด่าน ${stage.num} ${stage.name}${done ? ` ผ่านแล้ว ${cards().stars[stage.num]} ดาว` : openStage ? " เล่นได้" : " ล็อกอยู่"}${stage.boss ? " มีบอส" : ""}`);
        tile.append(el("b", null, openStage ? String(stage.num) : "🔒"), el("span", "level-name", stage.name));
        const badge = el("span", `level-badge${done ? " level-stars" : ""}`, done ? stars(cards().stars[stage.num]) : openStage ? "ด่านใหม่" : "ล็อก");
        tile.append(badge);
        if (stage.boss) tile.append(el("i", "level-boss", "บอส"));
        if (stage.card && !done) {
          const prize = el("i", "cards-prize", "🃏");
          prize.title = `รางวัล: การ์ด${E.CARDS[stage.card].name}`;
          tile.append(prize);
        }
        grid.append(tile);
      }
      section.append(heading, grid);
      panel.append(section);
    }
  }

  function renderTeam(panel) {
    const c = cards();
    const formation = el("div", "cards-formation");
    for (const [label, from, to] of [["แถวหน้า", 0, E.FRONT_SLOTS], ["แถวหลัง", E.FRONT_SLOTS, E.TEAM_SIZE]]) {
      const row = el("div", "cards-row");
      row.append(el("span", "cards-row-label", label));
      const slots = el("div", "cards-slots");
      for (let slot = from; slot < to; slot++) {
        const id = c.team[slot];
        if (id) slots.append(cardTile(id, () => cardSheet(id), "in-team"));
        else {
          const empty = button("cards-empty", "+", () => { tab = "team"; announce("แตะการ์ดด้านล่างเพื่อใส่ทีม"); tone(587, .05, "triangle", .04); }, `ช่องว่าง${label}`);
          slots.append(empty);
        }
      }
      row.append(slots);
      formation.append(row);
    }
    const sum = el("p", "cards-intro", `พลังทีม ${fmt(teamPower())} · แถวหน้าโดนตีบ่อยกว่า ให้ตัวป้องกันยืนหน้า`);
    const heading = el("h3", "shop-heading", `การ์ดทั้งหมด ${Object.keys(c.units).length}/${E.CARD_IDS.length}`);
    const grid = el("div", "cards-grid");
    for (const id of E.CARD_IDS) grid.append(cardTile(id, () => cardSheet(id)));
    panel.append(formation, sum, heading, grid);
  }

  // A small card: picture, rarity, role, name and level.
  function cardTile(id, onPick, extra = "") {
    const def = E.CARDS[id], lv = cards().units[id];
    const tile = button(`tcard r${def.rarity}${lv ? "" : " is-locked"}${cards().team.includes(id) ? " is-picked" : ""} ${extra}`, null, onPick);
    tile.setAttribute("aria-label", `${def.name} ${E.ROLES[def.role].name} ${def.rarity} ดาว${lv ? ` เลเวล ${lv}` : " ยังไม่มี"}`);
    const art = el("span", "tcard-art");
    art.append(portrait(id));
    tile.append(art, el("span", "tcard-rare", "★".repeat(def.rarity)), el("span", "tcard-role", E.ROLES[def.role].icon), el("b", "tcard-name", def.name), el("small", "tcard-lv", lv ? `Lv ${lv}` : "🔒"));
    return tile;
  }

  // ---- Detail panels ----
  function openSheet(content) {
    closeSheet(true);
    sheet = el("div", "cards-sheet");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    const box = el("div", "cards-sheet-box cards-scroll");
    const x = button("icon-button cards-sheet-close", "✕", () => closeSheet(), "ปิด");
    box.append(x, ...content);
    sheet.append(box);
    sheet.addEventListener("click", (event) => { if (event.target === sheet) closeSheet(); });
    frame.append(sheet);
    x.focus();
  }
  function closeSheet(quiet) {
    if (!sheet) return;
    sheet.remove();
    sheet = null;
    if (!quiet) showHub();
  }

  function cardSheet(id) {
    const c = cards(), def = E.CARDS[id], lv = c.units[id];
    const role = E.ROLES[def.role];
    const top = el("div", "sheet-card");
    const art = el("div", `sheet-art r${def.rarity}`);
    art.append(portrait(id));
    const info = el("div", "sheet-info");
    info.append(el("h3", null, def.name), el("p", "sheet-sub", `${"★".repeat(def.rarity)} · ${role.icon} ${role.name} · ${lv ? `Lv ${lv}/${E.MAX_LEVEL}` : "ยังไม่มี"}`), el("p", "sheet-text", def.text));
    const now = E.cardStats(id, lv || 1), then = lv && lv < E.MAX_LEVEL ? E.cardStats(id, lv + 1) : null;
    const table = el("dl", "sheet-stats");
    for (const [key, label] of [["hp", "พลังชีวิต"], ["atk", "โจมตี"], ["def", "ป้องกัน"], ["spd", "ความเร็ว"]]) {
      table.append(el("dt", null, label), el("dd", null, then ? `${fmt(now[key])} → ${fmt(then[key])}` : fmt(now[key])));
    }
    info.append(table);
    top.append(art, info);
    const parts = [top];
    if (def.passive) parts.push(el("p", "sheet-passive", `ติดตัว · ${def.passive.text}`));
    def.skills.forEach((skill, n) => {
      const row = el("div", "sheet-skill");
      row.append(el("span", "sheet-skill-icon", skill.icon), el("b", null, `สกิล ${n + 1} · ${skill.name}`), el("p", null, E.describe(skill)));
      parts.push(row);
    });
    const actions = el("div", "title-actions sheet-actions");
    if (lv) {
      const slot = c.team.indexOf(id);
      if (slot >= 0) {
        actions.append(button("secondary-button", slot < E.FRONT_SLOTS ? "ย้ายไปแถวหลัง" : "ย้ายไปแถวหน้า", () => moveRow(id)));
        actions.append(button("secondary-button", "ถอดจากทีม", () => setTeam(id, false)));
      } else actions.append(button("primary-button", "ใส่ทีม", () => setTeam(id, true)));
      if (lv < E.MAX_LEVEL) {
        const cost = E.levelCost(lv);
        const up = button("shop-buy sheet-up", `อัปเลเวล ● ${fmt(cost)}`, () => levelUp(id));
        up.disabled = save().coins < cost;
        up.setAttribute("aria-label", `อัปเลเวล${def.name}เป็นเลเวล ${lv + 1} ใช้ ${cost} เหรียญ`);
        actions.append(up);
      } else actions.append(el("span", "sheet-max", "เลเวลสูงสุดแล้ว"));
    } else {
      const stage = prizeStage(id);
      const where = [stage ? `ผ่านด่าน ${stage.num} ${stage.name} ครั้งแรก` : "", "หรือซื้อตัวนี้ในตลาด"].filter(Boolean).join(" ");
      actions.append(el("p", "sheet-lock", `🔒 ได้การ์ดนี้เมื่อ${where}`));
    }
    parts.push(actions);
    openSheet(parts);
  }

  function setTeam(id, add) {
    const team = cards().team;
    if (add) {
      const def = E.CARDS[id];
      const frontFirst = def.role !== "support" && def.role !== "magic";
      const order = frontFirst ? [0, 1, 2, 3, 4] : [2, 3, 4, 0, 1];
      const slot = order.find(n => !team[n]);
      if (slot == null) { tone(150, .12, "square", .05); announce("ทีมเต็มแล้ว ถอดการ์ดออกก่อน"); return; }
      team[slot] = id;
      tone(660, .08, "triangle", .05);
      announce(`ใส่${def.name}ในทีมแล้ว`);
    } else {
      if (team.filter(Boolean).length <= 1) { tone(150, .12, "square", .05); announce("ทีมต้องมีการ์ดอย่างน้อย 1 ใบ"); return; }
      team[team.indexOf(id)] = "";
      tone(440, .08, "triangle", .05);
    }
    store();
    cardSheet(id);
  }

  // Swap the card into the other row, trading places if that row is full.
  function moveRow(id) {
    const team = cards().team, from = team.indexOf(id);
    const range = from < E.FRONT_SLOTS ? [2, 3, 4] : [0, 1];
    const to = range.find(n => !team[n]) ?? range[0];
    [team[from], team[to]] = [team[to], team[from]];
    store();
    tone(587, .06, "triangle", .04);
    cardSheet(id);
  }

  function levelUp(id) {
    const c = cards(), lv = c.units[id], cost = E.levelCost(lv);
    if (lv >= E.MAX_LEVEL || save().coins < cost) { tone(150, .12, "square", .05); return; }
    save().coins -= cost;
    c.units[id] = lv + 1;
    store();
    showCoins();
    [523, 659, 784, 1047].forEach((note, i) => tone(note, .1, "triangle", .05, i * .07));
    announce(`${E.CARDS[id].name} เลเวล ${lv + 1} แล้ว`);
    cardSheet(id);
  }

  function stageSheet(stage) {
    if (!isOpen(stage.num)) return;
    const c = cards();
    const first = !isCleared(stage.num);
    const parts = [el("h3", "sheet-title", `ด่าน ${stage.num} · ${stage.name}`), el("p", "sheet-sub", `${stage.boss ? "ด่านบอส · " : ""}มอนสเตอร์ Lv ${stage.lv} · ${stage.waves.length} คลื่น · ดาวที่ได้ ${stars(c.stars[stage.num] || 0)}`)];
    const foes = el("div", "sheet-foes");
    for (const id of [...new Set(stage.waves.flat().map(f => f.id))]) {
      const foe = el("figure", `sheet-foe${E.FOES[id].boss ? " is-boss" : ""}`);
      foe.append(portrait(E.FOES[id].art), el("figcaption", null, E.FOES[id].name));
      foes.append(foe);
    }
    parts.push(foes);
    const reward = el("p", "sheet-reward");
    reward.textContent = first
      ? `รางวัลผ่านครั้งแรก: ● ${stage.coins}${stage.card ? ` + การ์ด${E.CARDS[stage.card].name}` : ""}`
      : `รางวัลเล่นซ้ำ: ● ${stage.repeat}`;
    parts.push(reward, el("p", "sheet-goals", `★ ชนะ · ★ ไม่มีการ์ดล้ม · ★ ชนะภายใน ${stage.par} เทิร์น`));
    const team = el("div", "sheet-team");
    for (const id of c.team) team.append(id ? cardTile(id, () => { tab = "team"; cardSheet(id); }) : el("span", "cards-empty is-flat", "–"));
    parts.push(el("p", "sheet-sub", `ทีมของคุณ · พลังทีม ${fmt(teamPower())}`), team);
    const actions = el("div", "title-actions sheet-actions");
    actions.append(button("primary-button", "เริ่มต่อสู้ ⚔", () => startBattle(stage)), button("secondary-button", "จัดทีม", () => { tab = "team"; closeSheet(); }));
    parts.push(actions);
    openSheet(parts);
  }

  // ---- Battle ----
  function startBattle(stage) {
    const c = cards();
    if (!c.team.some(Boolean)) return;
    closeSheet(true);
    const team = c.team.map(id => (id ? { id, lv: c.units[id] } : null));
    const state = E.createBattle({ team, stage, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
    battle = { stage, state, queue: [], token: {}, go: null, hint: "", busy: false, quitArmed: 0 };
    frame.classList.add("is-battle");
    buildBattle();
    tone(392, .1, "triangle", .05); tone(523, .12, "triangle", .05, .1);
    announce(`เริ่มด่าน ${stage.num} ${stage.name}`);
    runBattle(battle);
  }

  function buildBattle() {
    const v = battle;
    const view = el("div", "battle");
    const top = el("div", "battle-top");
    v.title = el("b", "battle-title");
    v.wave = el("span", "battle-wave");
    const auto = button("battle-toggle", "อัตโนมัติ", () => toggleAuto());
    const fast = button("battle-toggle", "×2", () => toggleFast());
    const quit = button("battle-toggle battle-quit", "ออก", () => leaveBattle());
    v.auto = auto; v.fast = fast; v.quit = quit;
    top.append(v.title, v.wave, auto, fast, quit);
    const field = el("div", "battle-field");
    v.foeSide = el("div", "battle-side is-foes");
    v.heroSide = el("div", "battle-side is-heroes");
    field.append(v.heroSide, v.foeSide);
    v.banner = el("div", "battle-banner");
    v.banner.setAttribute("aria-hidden", "true");
    field.append(v.banner);
    v.hintLine = el("p", "battle-hint");
    v.hintLine.setAttribute("aria-live", "polite");
    v.bar = el("div", "battle-bar");
    v.result = el("div", "battle-result");
    v.result.hidden = true;
    view.append(top, field, v.hintLine, v.bar, v.result);
    body.replaceChildren(view);
    v.tiles = { hero: [], foe: [] };
    drawSide("hero");
    drawSide("foe");
    drawTop();
    drawBar();
  }

  function drawTop() {
    const v = battle, b = v.state;
    v.title.textContent = `ด่าน ${v.stage.num} · ${v.stage.name}`;
    v.wave.textContent = `คลื่น ${b.wave + 1}/${b.waves.length} · เทิร์น ${Math.max(1, b.turn)}`;
    v.auto.setAttribute("aria-pressed", String(cards().auto));
    v.fast.setAttribute("aria-pressed", String(cards().fast));
  }

  // One side of the field: front row nearest the middle.
  function drawSide(side) {
    const v = battle, b = v.state;
    const list = side === "hero" ? b.heroes : b.foes;
    const box = side === "hero" ? v.heroSide : v.foeSide;
    const rows = { front: el("div", "battle-row is-front"), back: el("div", "battle-row is-back") };
    v.tiles[side] = [];
    list.forEach((u, i) => {
      if (!u) return;
      const tile = side === "foe" ? button("unit is-foe", null, () => setFocus(i)) : el("div", "unit");
      if (u.boss) tile.classList.add("is-boss");
      const art = el("span", "unit-art");
      art.append(portrait(side === "foe" ? E.FOES[u.id].art : u.id));
      const info = el("span", "unit-info");
      const name = el("b", "unit-name", u.name);
      const lv = el("small", "unit-lv", `Lv ${u.lv}`);
      const hp = el("span", "unit-hp");
      hp.append(el("i", "unit-hp-fill"), el("i", "unit-hp-shield"));
      const fx = el("span", "unit-fx");
      info.append(name, lv, hp, fx);
      tile.append(art, info);
      if (side === "hero") tile.append(el("span", "unit-queue"));
      else tile.append(el("span", "unit-focus", "🎯"));
      rows[u.row].append(tile);
      v.tiles[side][i] = tile;
      paintUnit(side, i, { hp: u.hp, maxHp: u.maxHp, sh: u.status.find(s => s.k === "shield")?.v || 0, st: u.status.map(s => s.k), alive: u.alive });
    });
    box.replaceChildren(rows.back, rows.front);
    markFocus();
    markQueue();
  }

  function paintUnit(side, i, snap) {
    const tile = battle?.tiles[side][i];
    if (!tile) return;
    const fill = Math.max(0, snap.hp / snap.maxHp);
    tile.querySelector(".unit-hp-fill").style.width = `${fill * 100}%`;
    tile.querySelector(".unit-hp-shield").style.width = `${Math.min(1, snap.sh / snap.maxHp) * 100}%`;
    tile.classList.toggle("is-low", fill < .3);
    tile.classList.toggle("is-ko", !snap.alive);
    const fx = tile.querySelector(".unit-fx");
    fx.replaceChildren(...[...new Set(snap.st)].filter(k => STATUS[k]).map(k => { const s = el("i", null, STATUS[k][0]); s.title = STATUS[k][1]; return s; }));
    const u = (side === "hero" ? battle.state.heroes : battle.state.foes)[i];
    if (u) tile.setAttribute("aria-label", `${u.name} พลังชีวิต ${fmt(snap.hp)} จาก ${fmt(snap.maxHp)}${snap.alive ? "" : " ล้มแล้ว"}${snap.st.length ? ` · ${[...new Set(snap.st)].map(k => STATUS[k]?.[1]).filter(Boolean).join(" ")}` : ""}${side === "foe" ? " · แตะเพื่อเล็งเป้า" : ""}`);
  }

  // Tap a monster to aim every single-target attack at it.
  function setFocus(i) {
    const v = battle;
    if (!v || v.state.phase === "done" || !v.state.foes[i]?.alive) return;
    v.state.focus = v.state.focus === i ? -1 : i;
    markFocus();
    tone(740, .05, "triangle", .04);
    announce(v.state.focus >= 0 ? `เล็งเป้า${v.state.foes[i].name}` : "ยกเลิกเป้า");
  }
  function markFocus() {
    battle?.tiles.foe.forEach((tile, i) => tile?.classList.toggle("is-focus", battle.state.focus === i));
  }

  // The skill buttons, two per hero, in team order.
  function drawBar() {
    const v = battle, b = v.state;
    const myTurn = b.phase === "hero" && !v.busy && !cards().auto;
    const groups = [];
    b.heroes.forEach((u, i) => {
      if (!u) return;
      const group = el("div", `skill-group${u.alive ? "" : " is-ko"}`);
      group.append(el("span", "skill-owner", u.name));
      const stunned = u.status.some(s => s.k === "stun");
      u.skills.forEach((skill, s) => {
        const queued = v.queue.findIndex(q => q.i === i && q.s === s);
        const node = button(`skill${queued >= 0 ? " is-queued" : ""}`, null, () => pickSkill(i, s));
        node.append(el("span", "skill-icon", skill.icon), el("span", "skill-name", skill.name));
        if (skill.cool > 0) node.append(el("span", "skill-cool", String(skill.cool)));
        if (queued >= 0) node.append(el("span", "skill-order", String(queued + 1)));
        node.disabled = !myTurn || !u.alive || stunned || skill.cool > 0;
        node.setAttribute("aria-label", `${u.name} ${skill.name}${skill.cool > 0 ? ` รออีก ${skill.cool} เทิร์น` : ""}${queued >= 0 ? ` ลำดับที่ ${queued + 1}` : ""}: ${E.describe(skill)}`);
        node.setAttribute("aria-pressed", String(queued >= 0));
        group.append(node);
      });
      groups.push(group);
    });
    const go = button("primary-button battle-go", v.queue.length ? `ลุย! (${v.queue.length} สกิล)` : "ลุย!", () => goTurn());
    go.disabled = !myTurn;
    v.goButton = go;
    v.bar.replaceChildren(...groups, go);
    v.bar.classList.toggle("is-waiting", !myTurn);
    markQueue();
  }

  function markQueue() {
    battle?.tiles.hero.forEach((tile, i) => {
      if (!tile) return;
      const n = battle.queue.findIndex(q => q.i === i);
      tile.querySelector(".unit-queue").textContent = n >= 0 ? String(n + 1) : "";
      tile.classList.toggle("is-queued", n >= 0);
    });
  }

  // One skill per hero per turn; tap again to take it back.
  function pickSkill(i, s) {
    const v = battle;
    const u = v.state.heroes[i], skill = u.skills[s];
    const at = v.queue.findIndex(q => q.i === i);
    if (at >= 0 && v.queue[at].s === s) v.queue.splice(at, 1);
    else if (at >= 0) v.queue[at].s = s;
    else v.queue.push({ i, s });
    hint(`${u.name} · ${skill.name}: ${E.describe(skill)}`);
    tone(at >= 0 && v.queue.every(q => q.i !== i) ? 440 : 660, .05, "triangle", .04);
    drawBar();
  }

  function hint(text) { if (battle) battle.hintLine.textContent = text; }

  function goTurn() {
    const v = battle;
    if (!v?.go) return;
    const resolve = v.go;
    v.go = null;
    resolve(v.queue.slice());
  }

  function toggleAuto() {
    const c = cards();
    c.auto = !c.auto;
    store();
    drawTop();
    tone(c.auto ? 784 : 523, .06, "triangle", .04);
    announce(c.auto ? "เปิดสู้อัตโนมัติ" : "ปิดสู้อัตโนมัติ");
    if (c.auto && battle?.go) { battle.queue = E.autoQueue(battle.state); goTurn(); }
    else if (battle) drawBar();
  }
  function toggleFast() {
    const c = cards();
    c.fast = !c.fast;
    store();
    drawTop();
    tone(659, .06, "triangle", .04);
  }

  // Leaving mid-battle asks once more first.
  function leaveBattle() {
    const v = battle;
    if (!v) return;
    if (v.state.phase !== "done" && Date.now() - v.quitArmed > 2500) {
      v.quitArmed = Date.now();
      v.quit.textContent = "ออกจริง?";
      setTimeout(() => { if (battle === v) v.quit.textContent = "ออก"; }, 2500);
      tone(330, .08, "square", .04);
      announce("กดออกอีกครั้งเพื่อยอมแพ้และกลับ");
      return;
    }
    v.token.stopped = true;
    battle = null;
    tab = "stages";
    showHub();
  }

  const speed = () => (cards().fast ? .45 : 1);
  const DELAY = { turn: 200, act: 330, hit: 230, heal: 200, shield: 140, fx: 110, skip: 380, burn: 260, wave: 900, status: 0, end: 300 };

  async function runBattle(v) {
    const b = v.state;
    while (b.phase !== "done" && !v.token.stopped) {
      if (b.phase === "foe") {
        v.busy = true; drawBar();
        hint("ฝ่ายมอนสเตอร์กำลังโจมตี…");
        await play(v, E.enemyTurn(b));
        continue;
      }
      v.busy = false;
      v.queue = [];
      drawTop(); drawBar();
      let queue;
      if (cards().auto) {
        hint("สู้อัตโนมัติ · กดปุ่มอัตโนมัติเพื่อเลือกสกิลเอง");
        await wait(350 * speed());
        if (v.token.stopped) return;
        queue = cards().auto ? E.autoQueue(b) : await new Promise(resolve => { v.go = resolve; drawBar(); });
      } else {
        hint("เทิร์นของคุณ · แตะสกิลตามลำดับที่อยากใช้ แตะมอนสเตอร์เพื่อเล็งเป้า แล้วกด ลุย!");
        queue = await new Promise(resolve => { v.go = resolve; drawBar(); });
      }
      if (v.token.stopped) return;
      v.busy = true;
      v.queue = queue;
      drawBar();
      await play(v, E.heroTurn(b, queue, b.focus));
    }
    if (!v.token.stopped) finish(v);
  }

  // Animate what happened, one event at a time.
  async function play(v, events) {
    for (const ev of events) {
      if (v.token.stopped) return;
      const side = ev.side, tile = side ? v.tiles[side]?.[ev.i] : null;
      switch (ev.t) {
        case "turn": drawTop(); break;
        case "act": {
          const u = (side === "hero" ? v.state.heroes : v.state.foes)[ev.i];
          if (tile) { tile.classList.remove("is-acting"); void tile.offsetWidth; tile.classList.add("is-acting"); }
          if (ev.name) banner(ev.name, side);
          if (side === "hero" && ev.s >= 0) v.queue = v.queue.filter(q => q.i !== ev.i);
          markQueue();
          if (ev.s >= 0) { tone(side === "hero" ? 784 : 330, .09, "triangle", .05); tone(side === "hero" ? 1047 : 247, .1, "triangle", .04, .07); }
          else tone(side === "hero" ? 523 : 262, .05, "square", .03);
          if (u && ev.name) hint(`${u.name} ใช้ ${ev.name}`);
          break;
        }
        case "skip": pop(tile, "มึนงง!", "is-miss"); tone(200, .1, "sawtooth", .03); break;
        case "hit":
          paintUnit(side, ev.i, ev.u);
          if (tile) { tile.classList.remove("is-hit"); void tile.offsetWidth; tile.classList.add("is-hit"); }
          pop(tile, `${ev.crit ? "คริ! " : ""}-${fmt(ev.v)}`, ev.crit ? "is-crit" : "is-dmg");
          tone(ev.crit ? 180 : 140, .07, "square", ev.crit ? .06 : .04);
          if (ev.ko) { tone(110, .25, "sawtooth", .05); const u = (side === "hero" ? v.state.heroes : v.state.foes)[ev.i]; if (u) announce(`${u.name} ล้มแล้ว`); }
          break;
        case "heal": paintUnit(side, ev.i, ev.u); if (ev.v > 0) { pop(tile, `+${fmt(ev.v)}`, "is-heal"); tone(880, .08, "sine", .04); } break;
        case "shield": paintUnit(side, ev.i, ev.u); pop(tile, "เกราะ", "is-shield"); break;
        case "fx": paintUnit(side, ev.i, ev.u); if (ev.k === "stun") pop(tile, "มึนงง", "is-miss"); else if (ev.k === "cleanse") pop(tile, "ล้างสถานะ", "is-heal"); break;
        case "burn": paintUnit(side, ev.i, ev.u); pop(tile, `🔥-${fmt(ev.v)}`, "is-dmg"); break;
        case "status": paintUnit(side, ev.i, ev.u); break;
        case "wave":
          drawSide("foe"); drawTop();
          banner(`คลื่นที่ ${ev.n}/${ev.total}`, "wave");
          announce(`มอนสเตอร์คลื่นที่ ${ev.n} มาแล้ว`);
          [392, 523, 659].forEach((note, n) => tone(note, .1, "triangle", .05, n * .08));
          break;
        default: break;
      }
      await wait((DELAY[ev.t] ?? 100) * speed());
    }
    if (!v.token.stopped && battle === v) {
      // settle every card on its final numbers
      drawSide("hero");
      if (v.state.phase !== "done") drawSide("foe");
      drawTop();
    }
  }

  function pop(tile, text, kind) {
    if (!tile) return;
    const n = el("span", `unit-pop ${kind}`, text);
    n.style.setProperty("--dx", `${Math.round((Math.random() - .5) * 30)}px`);
    tile.append(n);
    setTimeout(() => n.remove(), 1100);
  }
  function banner(text, side) {
    const v = battle;
    if (!v) return;
    v.banner.textContent = text;
    v.banner.className = `battle-banner is-${side}`;
    void v.banner.offsetWidth;
    v.banner.classList.add("is-on");
  }

  // ---- Result ----
  function finish(v) {
    const b = v.state, stage = v.stage, c = cards();
    const won = b.result === "won";
    const got = E.starsFor(b, stage);
    const first = won && !isCleared(stage.num);
    let coins = 0, newCard = null;
    if (won) {
      coins = first ? stage.coins : stage.repeat;
      if (c.team.includes("pupa")) coins = Math.round(coins * (1 + E.CARDS.pupa.passive.coins));
      if (first && stage.card && !c.units[stage.card]) { c.units[stage.card] = 1; newCard = stage.card; }
      c.stars[stage.num] = Math.max(c.stars[stage.num] || 0, got);
      save().coins += coins;
      store();
      showCoins();
    }
    v.busy = true;
    drawBar();
    const box = el("div", "message-card battle-card");
    box.append(el("span", "moon-icon", won ? "✦" : "☾"), el("h2", null, won ? "ชนะแล้ว!" : "พ่ายแพ้…"));
    if (won) {
      const row = el("div", "end-stars battle-stars", stars(got));
      row.setAttribute("role", "img");
      row.setAttribute("aria-label", `ได้ ${got} ดาว`);
      box.append(row);
      const goals = el("ul", "end-goals");
      for (const [okay, text] of [[true, "ชนะ"], [b.heroes.every(u => !u || u.alive), "ไม่มีการ์ดล้ม"], [b.turn <= stage.par, `ชนะภายใน ${stage.par} เทิร์น (ใช้ ${b.turn})`]]) {
        goals.append(el("li", okay ? "is-done" : "", `${okay ? "★" : "☆"} ${text}`));
      }
      box.append(goals);
      box.append(el("p", "end-reward battle-reward", `ได้รับ ● ${fmt(coins)}${c.team.includes("pupa") ? " (รวมโบนัส Pupa)" : ""}`));
      if (newCard) {
        const prize = el("div", "battle-prize");
        prize.append(cardTile(newCard, null), el("p", null, `การ์ดใหม่! ${E.CARDS[newCard].name}`));
        box.append(prize);
        [659, 784, 988, 1319].forEach((note, n) => tone(note, .14, "triangle", .06, .3 + n * .09));
      }
    } else box.append(el("p", null, "ลองอัปเลเวลการ์ด เปลี่ยนทีม หรือเรียงลำดับสกิลใหม่ แล้วมาลองอีกครั้ง"));
    const actions = el("div", "title-actions");
    const next = E.STAGES[stage.num];
    if (won && next && isOpen(next.num)) actions.append(button("primary-button", "ด่านต่อไป ▶", () => { battle = null; startBattle(next); }));
    actions.append(button(won ? "secondary-button" : "primary-button", "เล่นอีกครั้ง", () => { battle = null; startBattle(stage); }));
    if (!won) actions.append(button("secondary-button", "จัดทีม", () => { battle = null; tab = "team"; showHub(); }));
    actions.append(button("secondary-button", "กลับ", () => { battle = null; tab = "stages"; showHub(); }));
    box.append(actions);
    v.result.replaceChildren(box);
    v.result.hidden = false;
    hint("");
    game().tone(won ? 784 : 220, .2, "triangle", .06);
    if (won) [523, 659, 784, 1047].forEach((note, n) => tone(note, .12, "triangle", .05, n * .1));
    announce(won ? `ชนะด่าน ${stage.num} ได้ ${got} ดาว และ ${coins} เหรียญ${newCard ? ` ได้การ์ด${E.CARDS[newCard].name}` : ""}` : "พ่ายแพ้ ลองอีกครั้ง");
    actions.querySelector("button")?.focus();
  }

  // ---- Keys (game.js hands them over while this is open) ----
  function key(event) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (battle && (event.key === "Enter" || event.key === " ") && battle.go && !event.target.closest?.("button")) { event.preventDefault(); goTurn(); }
  }

  window.PupaCards = { open, close, key, get isOpen() { return isShown; } };
  document.querySelectorAll("[data-open-cards]").forEach(node => game()?.onTap(node, open));
  // Test link: ?cards opens straight into the card battles.
  if (new URLSearchParams(location.search).has("cards")) setTimeout(() => open(), 400);
})();

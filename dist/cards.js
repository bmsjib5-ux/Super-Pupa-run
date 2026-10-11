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
    dragon: "assets/dragon-pet.webp",
    sakura: "assets/sakura-hero.webp", chantra: "assets/chantra-hero.webp", thongkham: "assets/thongkham-hero.webp",
    miu: "assets/miu-hero.webp", ratri: "assets/ratri-hero.webp",
    phloeng: "assets/phloeng-hero.webp", mekha: "assets/mekha-hero.webp", fasai: "assets/fasai-hero.webp",
    moonrabbit: "assets/moonrabbit-pet.webp", starowl: "assets/starowl-pet.webp", silverwolf: "assets/silverwolf-pet.webp"
  };
  // A worn costume recolours the card and adds a golden glow.
  const COSTUME_HUE = { pupa: 200, jibjib: 150, baitoey: 260, ikuya: 300, pangji: 40, pupav2: 120, firefly: 180, kitten: 220, minibat: 90, starsprite: 320, dragon: 140, sakura: 160, chantra: 40, thongkham: 200, miu: 120, ratri: 300, moonrabbit: 280, starowl: 60, silverwolf: 330, phloeng: 190, mekha: 250, fasai: 300 };
  const COSTUME_NAME = { pupa: "ชุดไหมราตรีฟ้า", jibjib: "ชุดนักบินมรกต", baitoey: "ชุดภูตม่วงแสงจันทร์", ikuya: "ชุดนักสู้กุหลาบ", pangji: "ชุดซาลาเปาทองคำ", pupav2: "ชุดนักผจญภัยใบไม้", firefly: "ชุดแสงฟ้าคราม", kitten: "ชุดแมวน้ำทะเล", minibat: "ชุดค้างคาวมรกต", starsprite: "ชุดดาวชมพู", dragon: "ชุดมังกรหยก", sakura: "ชุดนินจาใบไผ่", chantra: "ชุดนักบวชสุริยะ", thongkham: "ชุดอัศวินมรกต", miu: "ชุดแม่มดน้ำแข็ง", ratri: "ชุดนักธนูโลหิต", moonrabbit: "ชุดกระต่ายซากุระ", starowl: "ชุดนกฮูกอำพัน", silverwolf: "ชุดหมาป่าอัคคี", phloeng: "ชุดอัศวินน้ำแข็ง", mekha: "ชุดเมฆอาทิตย์อัสดง", fasai: "ชุดนักดนตรีกุหลาบ" };
  const wearing = (id) => save()?.cards?.outfit?.[id] === 2;
  // A monster's picture; the burning ones of chapter 3 are recoloured.
  function foeArt(id) {
    const art = portrait(E.FOES[id].art);
    const foe = E.FOES[id], glow = `drop-shadow(0 0 .3rem ${foe.glow || "rgba(255,120,40,.7)"})`;
    if (foe.look) art.style.filter = `${foe.look} ${glow}`;
    else if (foe.hue) art.style.filter = `hue-rotate(${foe.hue}deg) saturate(1.4) ${glow}`;
    return art;
  }
  function portrait(kind) {
    const art = plainPortrait(kind);
    if (E.CARDS[kind] && wearing(kind)) { art.classList.add("is-costume"); art.style.setProperty("--hue", `${COSTUME_HUE[kind] || 180}deg`); }
    return art;
  }
  function plainPortrait(kind) {
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
  // Which 2D effect each skill shows (see cards-fx.js), by "card:skill".
  const LOOK = {
    "pupa:0": "ribbon", "pupa:1": "shield", "jibjib:0": "peck", "jibjib:1": "wind",
    "baitoey:0": "leaf", "baitoey:1": "leaf", "ikuya:0": "wind", "ikuya:1": "moon",
    "pangji:0": "shield", "pangji:1": "steam", "pupav2:0": "bolt", "pupav2:1": "bolt",
    "firefly:0": "heal", "firefly:1": "buff", "kitten:0": "slash", "kitten:1": "peck",
    "minibat:0": "bite", "minibat:1": "sonic", "starsprite:0": "shield", "starsprite:1": "star",
    "dragon:0": "fire", "dragon:1": "fire",
    "sakura:0": "peck", "sakura:1": "wind", "chantra:0": "heal", "chantra:1": "shield", "thongkham:0": "shield", "thongkham:1": "stomp",
    "miu:0": "star", "miu:1": "star", "ratri:0": "orb", "ratri:1": "star", "moonrabbit:0": "heal", "moonrabbit:1": "buff",
    "starowl:0": "orb", "starowl:1": "star", "silverwolf:0": "bite", "silverwolf:1": "sonic",
    "phloeng:0": "fire", "phloeng:1": "fire", "mekha:0": "bolt", "mekha:1": "bolt", "fasai:0": "heal", "fasai:1": "buff",
    "walker:0": "spore", "bat:0": "bite", "hopper:0": "stomp", "urchin:0": "shield", "spitter:0": "seed",
    "jelly:0": "heal", "crab:0": "foeSlash", "roller:0": "stomp", "swooper:0": "foeSlash",
    "king:0": "stomp", "king:1": "spore", "queen:0": "sonic", "queen:1": "bite"
  };
  function lookOf(u, s) {
    if (s >= 0 && LOOK[`${u.id}:${s}`]) return LOOK[`${u.id}:${s}`];
    const ranged = u.role === "magic" || u.role === "support";
    return u.side === "foe" ? (ranged ? "foeOrb" : "foeSlash") : ranged ? "orb" : "slash";
  }
  let show = null;           // the battle's 2D effects (cards-fx.js)
  const stopShow = () => { show?.destroy(); show = null; };

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
    // and every card's hero or pet can be played in the adventure too
    if (s.shop?.owned) for (const id of Object.keys(units)) if (!s.shop.owned.includes(id)) s.shop.owned.push(id);
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
    const xp = {}, outfit = {};
    for (const id of Object.keys(units)) {
      const n = Math.max(0, Math.floor(Number(raw.xp?.[id]) || 0));
      if (n > 0) xp[id] = n;
      const o = Math.floor(Number(raw.outfit?.[id]) || 0);
      if (o === 1 || o === 2) outfit[id] = o;
    }
    const now = Date.now();
    const idleAt = Math.min(now, Math.max(0, Math.floor(Number(raw.idleAt) || 0))) || now;
    const daily = raw.daily && typeof raw.daily.day === "string" ? { day: raw.daily.day.slice(0, 10), streak: Math.max(1, Math.min(7, Math.floor(Number(raw.daily.streak) || 1))) } : null;
    const dungeon = raw.dungeon && raw.dungeon.day === today() ? { day: today(), exp: raw.dungeon.exp === true, coin: raw.dungeon.coin === true } : { day: today(), exp: false, coin: false };
    const awake = {}, shards = {};
    for (const id of E.CARD_IDS) {
      const a = Math.min(E.MAX_AWAKE, Math.floor(Number(raw.awake?.[id]) || 0));
      if (a > 0 && units[id]) awake[id] = a;
      const sh = Math.max(0, Math.floor(Number(raw.shards?.[id]) || 0));
      if (sh > 0) shards[id] = sh;
      if (units[id]) units[id] = Math.min(units[id], E.capFor(awake[id]));
    }
    const dust = Math.max(0, Math.floor(Number(raw.dust) || 0));
    s.cards = { units, team, stars: best, xp, outfit, idleAt, daily, dungeon, awake, shards, dust, arena: Math.max(1, Math.floor(Number(raw.arena) || 1)), auto: Boolean(raw.auto), fast: Boolean(raw.fast) };
    return s.cards;
  }
  const cards = () => save().cards;
  const isCleared = (num) => (cards().stars[num] || 0) > 0;
  const isOpen = (num) => num === 1 || isCleared(num - 1);
  const store = () => game().writeSave();
  // The furthest stage cleared: how rich the auto hunt is.
  const bestStage = () => E.STAGES.reduce((best, stage) => (isCleared(stage.num) ? stage.num : best), 0);
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  // XP for these cards; says who went up a level.
  function shareXp(ids, amount) {
    const ups = [];
    for (const id of new Set(ids)) if (cards().units[id] && E.giveXp(cards(), id, amount)) ups.push(`${E.CARDS[id].name} Lv ${cards().units[id]}`);
    return ups;
  }
  const teamPower = () => cards().team.filter(Boolean).reduce((sum, id) => sum + E.power(id, cards().units[id]), 0);
  // The stage a card is the first-clear prize of.

  // ---- The frame ----
  const frame = el("div", "shop-card cards-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "ศึกการ์ดแสงจันทร์");
  title.id = "cardsTitle";
  const wallet = el("div", "shop-wallet");
  wallet.setAttribute("aria-label", "เหรียญที่มี");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
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

  function showCoins() {
    wallet.querySelector("b").textContent = fmt(save().coins);
    wallet.querySelector(".gems").textContent = fmt(save().gems || 0);
    wallet.setAttribute("aria-label", `เหรียญ ${fmt(save().coins)} เพชร ${fmt(save().gems || 0)}`);
  }
  const addGems = (n) => { save().gems = (save().gems || 0) + n; };

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
    if (cards().daily?.day !== today()) dailySheet();
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
    stopShow();
    battle = null;
    sheet = null;
    frame.classList.remove("is-battle", "is-arena");
    showCoins();
    const tabs = el("div", "shop-tabs cards-tabs");
    tabs.setAttribute("role", "tablist");
    for (const [key, label] of [["stages", "ด่าน"], ["pulls", "🎴 สุ่ม"], ["daily", "ประจำวัน"], ["arena", "ประลอง"], ["team", "ทีม"]]) {
      const t = button("", label, () => { tab = key; showHub(); tone(587, .05, "triangle", .04); });
      t.setAttribute("role", "tab");
      t.setAttribute("aria-selected", String(tab === key));
      tabs.append(t);
    }
    const panel = el("div", "shop-list cards-scroll");
    panel.setAttribute("role", "tabpanel");
    if (tab === "stages") renderStages(panel); else if (tab === "pulls") renderPulls(panel); else if (tab === "daily") renderDungeons(panel); else if (tab === "arena") renderArena(panel); else renderTeam(panel);
    body.replaceChildren(idleBanner(), tabs, panel);
  }

  // ---- Auto hunting ----
  // The team out hunting: a little scene, what has piled up, a claim button.
  function idleBanner() {
    const c = cards();
    const got = E.idleReward(bestStage(), Date.now() - c.idleAt);
    const box = el("section", "idle-banner");
    const scene = el("div", "idle-scene");
    scene.setAttribute("aria-hidden", "true");
    c.team.filter(Boolean).forEach((id, n) => { const f = el("span", "idle-hero"); f.style.animationDelay = `${-n * .17}s`; f.append(portrait(id)); scene.append(f); });
    const foe = el("span", "idle-foe"); foe.append(portrait(["walker", "bat", "hopper", "crab", "jelly"][Math.floor(Date.now() / 60000) % 5])); scene.append(foe);
    const text = el("div", "idle-text");
    const h = Math.floor(got.hours), m = Math.floor((got.hours - h) * 60);
    text.append(el("b", null, "⚔ ล่าอัตโนมัติ"), el("span", null, `สะสม ${h} ชม. ${m} นาที${got.hours >= E.IDLE_HOURS ? " (เต็มแล้ว)" : ` / ${E.IDLE_HOURS} ชม.`}`), el("span", "idle-loot", `● ${fmt(got.coins)} · EXP ${fmt(got.xp)}`));
    const claim = button("shop-buy idle-claim", "รับรางวัล", () => claimIdle());
    claim.disabled = got.coins < 1 && got.xp < 1;
    box.append(scene, text, claim);
    return box;
  }
  function claimIdle() {
    const c = cards(), got = E.idleReward(bestStage(), Date.now() - c.idleAt);
    if (got.coins < 1 && got.xp < 1) return;
    c.idleAt = Date.now();
    save().coins += got.coins;
    const ups = shareXp(c.team.filter(Boolean), got.xp);
    store();
    [523, 659, 784, 1047].forEach((note, i) => tone(note, .1, "triangle", .05, i * .07));
    announce(`รับ ${got.coins} เหรียญ และ EXP ${got.xp}${ups.length ? ` เลเวลอัป: ${ups.join(", ")}` : ""}`);
    showHub();
    openSheet([el("h3", "sheet-title", "รางวัลล่าอัตโนมัติ"), el("p", "sheet-reward", `● ${fmt(got.coins)} · EXP ${fmt(got.xp)} ให้การ์ดทุกใบในทีม`), ...(ups.length ? [el("p", "sheet-passive", `เลเวลอัป! ${ups.join(" · ")}`)] : []), el("p", "sheet-goals", "ทีมจะล่าต่อเองแม้ปิดเกม ผ่านด่านไกลขึ้น ได้รางวัลมากขึ้น")]);
  }

  // ---- Login rewards ----
  function dailySheet() {
    const c = cards();
    const yesterday = new Date(Date.now() - 864e5);
    const ymd = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const day = c.daily && c.daily.day === ymd ? (c.daily.streak % 7) + 1 : 1;
    const grid = el("div", "daily-grid");
    E.DAILY.forEach((r, n) => {
      const cell = el("div", `daily-day${n + 1 < day ? " is-done" : n + 1 === day ? " is-today" : ""}`);
      cell.append(el("small", null, `วันที่ ${n + 1}`), el("b", null, [r.gems ? `💎 ${r.gems}` : "", r.coins ? `● ${r.coins}` : "", r.xp ? `EXP ${r.xp}` : ""].filter(Boolean).join(" + ")));
      grid.append(cell);
    });
    const take = button("primary-button", "รับรางวัลวันนี้", () => {
      const r = E.DAILY[day - 1];
      c.daily = { day: today(), streak: day };
      save().coins += r.coins || 0;
      addGems(r.gems || 0);
      const ups = r.xp ? shareXp(c.team.filter(Boolean), r.xp) : [];
      store();
      [659, 784, 988, 1319].forEach((note, i) => tone(note, .12, "triangle", .06, i * .08));
      announce(`รับรางวัลวันที่ ${day} แล้ว${ups.length ? ` เลเวลอัป: ${ups.join(", ")}` : ""}`);
      closeSheet();
    });
    openSheet([el("h3", "sheet-title", "รางวัลเข้าเกมรายวัน"), el("p", "sheet-sub", "เข้ามาทุกวันติดกัน รางวัลยิ่งใหญ่ขึ้น ครบ 7 วันเริ่มรอบใหม่ · EXP แจกให้การ์ดทุกใบในทีม"), grid, el("div", "title-actions sheet-actions", null)]);
    sheet.querySelector(".sheet-actions").append(take);
    take.focus();
  }

  // ---- Card pulls ----
  // Characters and pets are found only here. Rolls happen on this device
  // with gems, which are earned in play and never sold for money.
  const pity = () => Math.max(0, Math.floor(Number(save().cardPity) || 0));
  function renderPulls(panel) {
    const g = E.GACHA, have = save().gems || 0;
    const banner = el("section", "pull-banner");
    const row = el("div", "pull-faces");
    for (const id of ["phloeng", "chantra", "mekha", "ratri", "fasai"]) { const f = el("span", `pull-face r${E.CARDS[id].rarity}`); f.append(portrait(id)); row.append(f); }
    banner.append(el("p", "news-eyebrow", "✦ สุ่มการ์ดแสงจันทร์"), el("h3", null, "ตัวละครและสัตว์เลี้ยงได้จากที่นี่เท่านั้น"), row);
    const odds = el("p", "pull-odds", `อัตรา: ★5 ${g.rates[5] * 100}% · ★4 ${g.rates[4] * 100}% · ★3 ${g.rates[3] * 100}% · การันตี ★5 ภายใน ${g.pity} ครั้ง (อีก ${g.pity - pity()} ครั้ง) · สุ่ม 10 ครั้งได้ ★4 ขึ้นไปอย่างน้อย 1 ใบ · ได้ซ้ำเปลี่ยนเป็นเศษการ์ดใบนั้นไว้อัปดาว (★3 5 · ★4 10 · ★5 20)`);
    const actions = el("div", "title-actions sheet-actions pull-actions");
    const one = button("primary-button", `สุ่ม 1 ครั้ง · 💎 ${g.one}`, () => doPull(1));
    const ten = button("primary-button pull-ten", `สุ่ม 10 ครั้ง · 💎 ${g.ten}`, () => doPull(10));
    one.disabled = have < g.one; ten.disabled = have < g.ten;
    actions.append(one, ten);
    banner.append(odds, actions, el("p", "sheet-goals", `มีเพชร 💎 ${fmt(have)} · เพชรได้จากผ่านด่านครั้งแรก (ทั้งผจญภัยและศึกการ์ด) รางวัลรายวัน ลานประลอง และด่านประจำวัน`));
    panel.append(banner);
    const list = el("div", "pull-pool");
    for (const r of [5, 4, 3]) {
      const line = el("p", "pull-tier");
      line.append(el("b", null, "★".repeat(r)), document.createTextNode(" " + E.CARD_IDS.filter(id => E.CARDS[id].rarity === r).map(id => `${E.CARDS[id].name}${cards().units[id] ? " ✓" : ""}`).join(" · ")));
      list.append(line);
    }
    panel.append(el("h3", "shop-heading", "การ์ดที่สุ่มได้ (✓ = มีแล้ว)"), list);
  }

  function doPull(count) {
    const g = E.GACHA, cost = count >= 10 ? g.ten : g.one;
    if ((save().gems || 0) < cost) { tone(150, .12, "square", .05); return; }
    save().gems -= cost;
    const state = { pity: pity() };
    const got = E.pull(state, Math.random, count);
    save().cardPity = state.pity;
    const c = cards();
    const results = got.map(id => {
      if (!c.units[id]) {
        c.units[id] = 1;
        if (save().shop && !save().shop.owned.includes(id)) save().shop.owned.push(id);
        return { id, fresh: true };
      }
      const shards = E.DUPE_SHARDS[E.CARDS[id].rarity];
      c.shards[id] = (c.shards[id] || 0) + shards;
      return { id, fresh: false, shards };
    });
    store(); showCoins();
    reveal(results);
  }

  // Cards turn over one after another, the rare ones with more light.
  function reveal(results) {
    const grid = el("div", `pull-reveal${results.length > 1 ? " is-ten" : ""}`);
    results.forEach((r, n) => {
      const def = E.CARDS[r.id];
      const slot = el("div", `pull-card r${def.rarity}`);
      slot.style.animationDelay = `${n * 180}ms`;
      const front = el("div", "pull-front");
      front.append(cardTile(r.id, null), el("small", r.fresh ? "pull-new" : "pull-dupe", r.fresh ? "ใหม่!" : `ซ้ำ → เศษ +${r.shards}`));
      slot.append(el("div", "pull-back", "✦"), front);
      grid.append(slot);
      const best = def.rarity === 5 ? [784, 988, 1175, 1568] : def.rarity === 4 ? [659, 880] : [523];
      setTimeout(() => best.forEach((note, i) => tone(note, .1, "triangle", .05, i * .06)), n * 180 + 380);
    });
    const fresh = results.filter(r => r.fresh).map(r => E.CARDS[r.id].name);
    const again = el("div", "title-actions sheet-actions");
    const g = E.GACHA;
    const more = button("primary-button", results.length > 1 ? `สุ่มอีก 10 · 💎 ${g.ten}` : `สุ่มอีก · 💎 ${g.one}`, () => doPull(results.length));
    more.disabled = (save().gems || 0) < (results.length > 1 ? g.ten : g.one);
    again.append(more, button("secondary-button", "ดูการ์ด", () => { tab = "team"; closeSheet(); }));
    openSheet([el("h3", "sheet-title", "ผลการสุ่ม"), grid, el("p", "sheet-sub", fresh.length ? `ได้ใหม่: ${fresh.join(" · ")}` : "ไม่มีการ์ดใหม่รอบนี้ การ์ดซ้ำเปลี่ยนเป็นเศษไว้อัปดาวแล้ว"), again]);
    announce(`ผลการสุ่ม: ${results.map(r => `${E.CARDS[r.id].name} ${E.CARDS[r.id].rarity} ดาว${r.fresh ? " ใหม่" : " ซ้ำ"}`).join(", ")}`);
  }

  // ---- Daily dungeons ----
  // A day's clear of each is recorded in cards.dungeon; a lost run can be
  // tried again the same day.
  const doneToday = (kind) => { const d = cards().dungeon; return d.day === today() && d[kind]; };
  function untilMidnight() {
    const now = new Date(), next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const mins = Math.ceil((next - now) / 60000);
    return `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
  }
  function renderDungeons(panel) {
    if (cards().dungeon.day !== today()) cards().dungeon = { day: today(), exp: false, coin: false };
    panel.append(el("p", "cards-intro", `รับรางวัลได้ด่านละ 1 ครั้งต่อวัน · แพ้แล้วลองใหม่ได้ · รีเซ็ตใน ${untilMidnight()}`));
    const grid = el("div", "dungeon-grid");
    for (const kind of ["exp", "coin"]) {
      const d = E.DUNGEONS[kind], stage = E.dungeon(kind, bestStage()), done = doneToday(kind);
      const box = el("section", `dungeon-box is-${kind}${done ? " is-done" : ""}`);
      box.append(el("span", "dungeon-icon", d.icon), el("h3", null, d.name), el("p", "sheet-text", d.text));
      const foes = el("div", "sheet-foes");
      for (const id of [...new Set(stage.waves.flat().map(f => f.id))]) { const fig = el("figure", `sheet-foe${E.FOES[id].boss ? " is-boss" : ""}`); fig.append(foeArt(id), el("figcaption", null, E.FOES[id].name)); foes.append(fig); }
      box.append(foes, el("p", "sheet-sub", `มอนสเตอร์ Lv ${stage.lv} · 3 คลื่น`), el("p", "sheet-reward", kind === "exp" ? `รางวัล: EXP ${fmt(stage.xp)} ต่อการ์ด + ● ${fmt(stage.coins)} + 💎 ${stage.gems}` : `รางวัล: ● ${fmt(stage.coins)} + EXP ${fmt(stage.xp)} ต่อการ์ด + 💎 ${stage.gems}`));
      const go = button(done ? "secondary-button" : "primary-button", done ? `ผ่านแล้ววันนี้ ✓ · มาใหม่ใน ${untilMidnight()}` : "เข้าด่าน ⚔", () => startBattle(stage));
      go.disabled = done;
      const actions = el("div", "title-actions sheet-actions");
      actions.append(go);
      box.append(actions);
      grid.append(box);
    }
    panel.append(grid);
  }
  function finishDungeon(v) {
    const b = v.state, stage = v.stage, c = cards(), won = b.result === "won";
    const xp = won ? stage.xp : E.stageXp({ num: 1 }, false);
    const ups = shareXp(c.team.filter(Boolean), xp);
    if (won) {
      if (c.dungeon.day !== today()) c.dungeon = { day: today(), exp: false, coin: false };
      c.dungeon[stage.dungeon] = true;
      save().coins += stage.coins;
      addGems(stage.gems);
      cards().dust += stage.dust || 0;
    }
    store(); showCoins();
    v.busy = true;
    const box = el("div", "message-card battle-card");
    box.append(el("span", "moon-icon", won ? E.DUNGEONS[stage.dungeon].icon : "☾"), el("h2", null, won ? "ผ่านด่านประจำวัน!" : "พ่ายแพ้…"));
    box.append(el("p", "end-reward battle-reward", won ? `ได้รับ 💎 ${stage.gems} · ✧ ผลึกดาว ${stage.dust} · ● ${fmt(stage.coins)} · EXP ${fmt(xp)} ต่อการ์ด` : `ได้ EXP ${xp} ต่อการ์ด · ลองใหม่ได้วันนี้`));
    if (ups.length) box.append(el("p", "battle-ups", `เลเวลอัป! ${ups.join(" · ")}`));
    if (won) box.append(el("p", null, `ด่านนี้รับรางวัลได้อีกครั้งพรุ่งนี้ (อีก ${untilMidnight()})`));
    const actions = el("div", "title-actions");
    if (!won) actions.append(button("primary-button", "ลองอีกครั้ง", () => { battle = null; startBattle(stage); }));
    actions.append(button(won ? "primary-button" : "secondary-button", "กลับ", () => { battle = null; tab = "daily"; showHub(); }));
    box.append(actions);
    v.result.replaceChildren(box);
    v.result.hidden = false;
    hint("");
    if (won) [523, 659, 784, 1047].forEach((note, n) => tone(note, .12, "triangle", .05, n * .1));
    announce(won ? `ผ่าน${stage.name} ได้ ${stage.coins} เหรียญ และ EXP ${xp}` : "พ่ายแพ้ ลองใหม่ได้");
    actions.querySelector("button")?.focus();
  }

  // ---- Arena: ten against ten ----
  function renderArena(panel) {
    const c = cards(), tier = E.arenaTier(c.arena);
    const team = E.arenaTeam(c);
    panel.append(el("p", "cards-intro", `การ์ดที่แรงที่สุด ${team.length} ใบลงสนามเอง ตัวป้องกันยืนหน้า · สู้อัตโนมัติทั้งหมด · ชนะแล้วขึ้นชั้นต่อไป`));
    const box = el("section", "arena-box");
    box.append(el("h3", "sheet-title", `ชั้น ${tier.num}${tier.boss ? " · มีบอส" : ""}`), el("p", "sheet-sub", `มอนสเตอร์ 10 ตัว Lv ${tier.lv} · รางวัล 💎 ${tier.gems} · ● ${tier.coins} · EXP ${tier.xp} ต่อการ์ด`));
    const foes = el("div", "sheet-foes");
    for (const f of tier.waves[0]) { const fig = el("figure", `sheet-foe${E.FOES[f.id].boss ? " is-boss" : ""}`); fig.append(foeArt(f.id), el("figcaption", null, E.FOES[f.id].name)); foes.append(fig); }
    const mine = el("div", "arena-team");
    for (const t of team) mine.append(cardTile(t.id, () => cardSheet(t.id)));
    const go = button("primary-button", "เริ่มประลอง ⚔", () => startBattle(tier));
    box.append(foes, el("p", "sheet-sub", `ทีมของคุณ ${team.length}/10 · พลังรวม ${fmt(team.reduce((sum, t) => sum + E.power(t.id, t.lv), 0))}`), mine, el("div", "title-actions sheet-actions"));
    box.querySelector(".sheet-actions").append(go);
    panel.append(box);
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
        tile.style.setProperty("--accent", stage.num > 50 ? "#ffd76a" : stage.num > 40 ? "#b067ff" : stage.num > 30 ? "#7fd4ff" : stage.num > 20 ? "#ff7a3c" : stage.num > 10 ? "#2fb6a6" : "#c5528a");
        tile.disabled = !openStage;
        tile.setAttribute("aria-label", `ด่าน ${stage.num} ${stage.name}${done ? ` ผ่านแล้ว ${cards().stars[stage.num]} ดาว` : openStage ? " เล่นได้" : " ล็อกอยู่"}${stage.boss ? " มีบอส" : ""}`);
        tile.append(el("b", null, openStage ? String(stage.num) : "🔒"), el("span", "level-name", stage.name));
        const badge = el("span", `level-badge${done ? " level-stars" : ""}`, done ? stars(cards().stars[stage.num]) : openStage ? "ด่านใหม่" : "ล็อก");
        tile.append(badge);
        if (stage.boss) tile.append(el("i", "level-boss", "บอส"));
        if (!done) {
          const prize = el("i", "cards-prize", `💎${stage.gems}`);
          prize.title = `รางวัลผ่านครั้งแรก: ${stage.gems} เพชร`;
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
    const awake = cards().awake?.[id] || 0;
    tile.append(art, el("span", "tcard-rare", "★".repeat(def.rarity)), el("span", "tcard-role", E.ROLES[def.role].icon), el("b", "tcard-name", def.name), el("small", "tcard-lv", lv ? `Lv ${lv}${awake ? ` · ✦${awake}` : ""}` : "🔒"));
    if (awake) tile.classList.add(`awake-${awake}`);
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
    info.append(el("h3", null, def.name), el("p", "sheet-sub", `${"★".repeat(def.rarity)} · ${role.icon} ${role.name} · ${lv ? `Lv ${lv}/${E.capFor(c.awake[id])}` : "ยังไม่มี"}`), el("p", "sheet-text", def.text));
    const boost = (st) => { const k = 1 + E.cardBonus(c, id); return { ...st, hp: Math.round(st.hp * k), atk: Math.round(st.atk * k), def: Math.round(st.def * k) }; };
    const cap = E.capFor(c.awake[id]);
    const now = boost(E.cardStats(id, lv || 1)), then = lv && lv < cap ? boost(E.cardStats(id, lv + 1)) : null;
    const table = el("dl", "sheet-stats");
    for (const [key, label] of [["hp", "พลังชีวิต"], ["atk", "โจมตี"], ["def", "ป้องกัน"], ["spd", "ความเร็ว"]]) {
      table.append(el("dt", null, label), el("dd", null, then ? `${fmt(now[key])} → ${fmt(then[key])}` : fmt(now[key])));
    }
    info.append(table);
    top.append(art, info);
    const parts = [top];
    if (lv && lv < cap) {
      const need = E.xpNeed(lv), have = c.xp[id] || 0;
      const bar = el("div", "sheet-xp");
      bar.append(el("span", null, `EXP ${fmt(have)} / ${fmt(need)}`), el("i"));
      bar.querySelector("i").style.setProperty("--fill", `${Math.floor(100 * have / need)}%`);
      parts.push(bar);
    }
    if (def.passive) parts.push(el("p", "sheet-passive", `ติดตัว · ${def.passive.text}`));
    if (lv) {
      // stars: shards of this card (or star dust) and coins
      const at = c.awake[id] || 0, cost = E.awakeCost(c, id);
      const box = el("div", "sheet-awake");
      box.append(el("b", null, `อัปดาว ${"✦".repeat(at)}${"✧".repeat(E.MAX_AWAKE - at)}`), el("span", null, `เศษ${def.name} ${fmt(c.shards[id] || 0)} · ผลึกดาว ${fmt(c.dust)} · ดาวละ: เลเวลสูงสุด +10 และพลัง +${Math.round(E.AWAKE_BONUS * 100)}%`));
      if (cost) {
        const ok = cost.dust >= cost.fromDust && save().coins >= cost.coins;
        const up = button("shop-buy", `✦${cost.star} · เศษ ${cost.need} ● ${fmt(cost.coins)}`, () => awakenCard(id));
        up.disabled = !ok;
        up.setAttribute("aria-label", `อัปดาว${def.name}เป็น ${cost.star} ดาว ใช้เศษ ${cost.fromShards}${cost.fromDust ? ` ผลึกดาว ${cost.fromDust}` : ""} และ ${cost.coins} เหรียญ`);
        box.append(up);
        if (cost.fromDust) box.append(el("small", null, cost.dust >= cost.fromDust ? `ใช้ผลึกดาวแทน ${cost.fromDust}` : `เศษไม่พอ ขาด ${cost.fromDust - cost.dust}`));
      } else box.append(el("span", "sheet-max", "ดาวเต็มแล้ว"));
      parts.push(box);
    }
    if (lv) {
      const own = c.outfit[id];
      const row = el("div", "sheet-costume");
      row.append(el("b", null, `คอสตูม · ${COSTUME_NAME[id]}`), el("span", null, `เปลี่ยนสีชุดและเพิ่มพลังชีวิต โจมตี ป้องกัน +${Math.round(E.COSTUME_BONUS * 100)}% เมื่อสวม`));
      if (!own) {
        const buyIt = button("shop-buy", `ซื้อ ● ${E.COSTUME_PRICE}`, () => {
          if (save().coins < E.COSTUME_PRICE) return;
          save().coins -= E.COSTUME_PRICE; c.outfit[id] = 2; store(); showCoins();
          [784, 988, 1319].forEach((note, i) => tone(note, .1, "triangle", .05, i * .07));
          announce(`ซื้อ${COSTUME_NAME[id]}แล้ว`);
          cardSheet(id);
        });
        buyIt.disabled = save().coins < E.COSTUME_PRICE;
        row.append(buyIt);
      } else row.append(button("shop-equip", own === 2 ? "ถอดชุด" : "สวมชุด", () => { c.outfit[id] = own === 2 ? 1 : 2; store(); tone(660, .08, "triangle", .05); cardSheet(id); }));
      parts.push(row);
    }
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
      if (lv < cap) {
        const cost = E.levelCost(lv);
        const up = button("shop-buy sheet-up", `อัปเลเวล ● ${fmt(cost)}`, () => levelUp(id));
        up.disabled = save().coins < cost;
        up.setAttribute("aria-label", `อัปเลเวล${def.name}เป็นเลเวล ${lv + 1} ใช้ ${cost} เหรียญ`);
        actions.append(up);
      } else actions.append(el("span", "sheet-max", (c.awake[id] || 0) < E.MAX_AWAKE ? "เลเวลเต็ม · อัปดาวเพื่อไปต่อ" : "เลเวลสูงสุดแล้ว"));
    } else {
      actions.append(el("p", "sheet-lock", "🔒 ได้จากการสุ่มการ์ดเท่านั้น"), button("primary-button", "🎴 ไปสุ่มการ์ด", () => { tab = "pulls"; closeSheet(); }));
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

  function awakenCard(id) {
    const c = cards(), left = E.awaken(c, id, save().coins);
    if (left == null) { tone(150, .12, "square", .05); return; }
    save().coins = left;
    E.giveXp(c, id, 0); // XP waiting at the old cap counts now
    store(); showCoins();
    [523, 659, 784, 1047, 1319].forEach((note, i) => tone(note, .12, "triangle", .06, i * .08));
    announce(`${E.CARDS[id].name} อัปเป็น ${c.awake[id]} ดาว เลเวลสูงสุด ${E.capFor(c.awake[id])}`);
    cardSheet(id);
  }

  function levelUp(id) {
    const c = cards(), lv = c.units[id], cost = E.levelCost(lv);
    if (lv >= E.capFor(c.awake[id]) || save().coins < cost) { tone(150, .12, "square", .05); return; }
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
      foe.append(foeArt(id), el("figcaption", null, E.FOES[id].name));
      foes.append(foe);
    }
    parts.push(foes);
    const reward = el("p", "sheet-reward");
    reward.textContent = first
      ? `รางวัลผ่านครั้งแรก: ● ${stage.coins} + 💎 ${stage.gems}${stage.dust ? ` + ✧ ผลึกดาว ${stage.dust}` : ""}`
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
    if (stage.dungeon && doneToday(stage.dungeon)) { tone(150, .12, "square", .05); announce("ด่านนี้ผ่านแล้ววันนี้ มาใหม่พรุ่งนี้"); return; }
    closeSheet(true);
    const team = stage.arena ? E.arenaTeam(c) : c.team.map(id => (id ? { id, lv: c.units[id], bonus: E.cardBonus(c, id) } : null));
    const state = E.createBattle({ team, stage, seed: (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
    battle = { stage, state, queue: [], token: {}, go: null, hint: "", busy: false, quitArmed: 0 };
    frame.classList.add("is-battle");
    frame.classList.toggle("is-arena", Boolean(stage.arena));
    buildBattle();
    tone(392, .1, "triangle", .05); tone(523, .12, "triangle", .05, .1);
    announce(stage.arena ? `เริ่ม${stage.name}` : `เริ่มด่าน ${stage.num} ${stage.name}`);
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
    stopShow();
    show = window.PupaCardsFx?.create(field, { chapter: Math.min(6, Math.ceil(v.stage.num / 10)) }) || null;
    show?.follow(() => [...v.tiles.hero, ...v.tiles.foe].filter(Boolean).map(tile => ({ el: tile, stun: tile.status?.includes("stun"), burn: tile.status?.includes("burn"), taunt: tile.status?.includes("taunt") })));
    drawSide("hero");
    drawSide("foe");
    drawTop();
    drawBar();
  }

  function drawTop() {
    const v = battle, b = v.state;
    v.title.textContent = v.stage.arena ? `⚔ ${v.stage.name} · 10 vs 10` : v.stage.dungeon ? `${E.DUNGEONS[v.stage.dungeon].icon} ด่านประจำวัน · ${v.stage.name}` : `ด่าน ${v.stage.num} · ${v.stage.name}`;
    v.wave.textContent = `คลื่น ${b.wave + 1}/${b.waves.length} · เทิร์น ${Math.max(1, b.turn)}`;
    v.auto.setAttribute("aria-pressed", String(cards().auto));
    v.fast.setAttribute("aria-pressed", String(cards().fast));
  }

  // Where each fighter stands, as a share of the field: heroes on the
  // left facing right, monsters on the right, front rows near the middle.
  // y is where the feet touch the ground.
  const STAND_X = { hero: { front: 37, back: 15 }, foe: { front: 63, back: 85 } };
  function standAt(count, n) {
    if (count === 1) return 70;
    const top = 44, bottom = 90;
    return top + (bottom - top) * n / (count - 1);
  }

  // One side of the field: every fighter standing on the ground.
  function drawSide(side) {
    const v = battle, b = v.state;
    const list = side === "hero" ? b.heroes : b.foes;
    const box = side === "hero" ? v.heroSide : v.foeSide;
    v.tiles[side] = [];
    const nodes = [];
    for (const row of ["back", "front"]) {
      const inRow = list.filter(u => u && u.row === row);
      inRow.forEach((u, n) => {
        const i = list.indexOf(u);
        const tile = side === "foe" ? button("unit is-foe", null, () => setFocus(i)) : el("div", "unit");
        if (u.boss) tile.classList.add("is-boss");
        const crowd = inRow.length > 3;
        const y = crowd ? standAt(Math.ceil(inRow.length / 2), Math.floor(n / 2)) + (n % 2) * 4 : standAt(inRow.length, n);
        const shift = crowd ? (n % 2 ? 6 : -6) : inRow.length > 2 ? (n % 2 ? 3 : -3) : 0;
        tile.style.left = `${STAND_X[side][row] + (shift || 0) * (side === "hero" ? 1 : -1)}%`;
        if (crowd) tile.classList.add("is-crowd");
        tile.style.top = `${y}%`;
        tile.style.zIndex = String(Math.round(y));
        tile.style.setProperty("--depth", String(.82 + y / 500));
        const art = el("span", "unit-art");
        art.append(side === "foe" ? foeArt(u.id) : portrait(u.id));
        const head = el("span", "unit-head");
        const hp = el("span", "unit-hp");
        hp.append(el("i", "unit-hp-fill"), el("i", "unit-hp-shield"));
        head.append(el("span", "unit-fx"), hp, el("small", "unit-lv", `Lv ${u.lv}`));
        tile.append(el("span", "unit-shadow"), art, head);
        if (side === "hero") tile.append(el("span", "unit-queue"));
        else tile.append(el("span", "unit-focus"));
        nodes.push(tile);
        v.tiles[side][i] = tile;
      });
    }
    box.replaceChildren(...nodes);
    list.forEach((u, i) => { if (u) paintUnit(side, i, { hp: u.hp, maxHp: u.maxHp, sh: u.status.find(st => st.k === "shield")?.v || 0, st: u.status.map(st => st.k), alive: u.alive }); });
    markFocus();
    markQueue();
  }

  // Close-range fighters run up to their target and back.
  const MELEE = new Set(["slash", "peck", "bite", "foeSlash", "stomp"]);
  function dash(v, tile, target) {
    if (!tile || !target || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const a = tile.getBoundingClientRect(), t = target.getBoundingClientRect();
    const toward = Math.sign(t.left - a.left) || 1;
    const dx = t.left - a.left - toward * a.width * .55, dy = t.top - a.top;
    const time = 150 * speed();
    tile.style.transition = `translate ${time}ms ease-in`;
    tile.style.translate = `${dx}px ${dy}px`;
    tile.style.zIndex = "200";
    setTimeout(() => {
      tile.style.transition = `translate ${time * 1.6}ms ease-out`;
      tile.style.translate = "";
      setTimeout(() => { tile.style.zIndex = String(Math.round(parseFloat(tile.style.top))); }, time * 1.6);
    }, time + 260 * speed());
  }

  function paintUnit(side, i, snap) {
    const tile = battle?.tiles[side][i];
    if (!tile) return;
    const fill = Math.max(0, snap.hp / snap.maxHp);
    tile.querySelector(".unit-hp-fill").style.width = `${fill * 100}%`;
    tile.querySelector(".unit-hp-shield").style.width = `${Math.min(1, snap.sh / snap.maxHp) * 100}%`;
    tile.classList.toggle("is-low", fill < .3);
    if (snap.alive === false && !tile.classList.contains("is-ko") && tile.isConnected) show?.knockout(tile);
    tile.classList.toggle("is-ko", !snap.alive);
    tile.status = snap.alive ? snap.st : [];
    if (side === "hero") { const bar = battle.bar.querySelectorAll(".skill-group")[battle.state.heroes.slice(0, i).filter(Boolean).length]?.querySelector(".skill-hp i"); if (bar) bar.style.width = `${fill * 100}%`; }
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
      const owner = el("span", "skill-owner");
      const face = el("span", "skill-face");
      face.append(portrait(u.id));
      const bar = el("span", "skill-hp");
      bar.append(el("i"));
      bar.firstChild.style.width = `${Math.max(0, u.hp / u.maxHp) * 100}%`;
      owner.append(face, el("b", null, u.name), bar);
      group.append(owner);
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
    tab = v.stage.arena ? "arena" : v.stage.dungeon ? "daily" : "stages";
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
      if (v.stage.arena) {
        hint("ลานประลอง · สู้อัตโนมัติ");
        await wait(300 * speed());
        if (v.token.stopped) return;
        queue = E.autoQueue(b);
      } else if (cards().auto) {
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
    let look = "slash";
    for (const [index, ev] of events.entries()) {
      if (v.token.stopped) return;
      const side = ev.side, tile = side ? v.tiles[side]?.[ev.i] : null;
      switch (ev.t) {
        case "turn": drawTop(); break;
        case "act": {
          const u = (side === "hero" ? v.state.heroes : v.state.foes)[ev.i];
          if (tile) { tile.classList.remove("is-acting"); void tile.offsetWidth; tile.classList.add("is-acting"); }
          if (ev.name) banner(ev.name, side);
          if (u && tile && show) {
            // everyone this action reaches, up to the next action
            look = lookOf(u, ev.s);
            const reached = [];
            for (const next of events.slice(index + 1)) {
              if (["act", "skip", "turn", "status", "wave", "end"].includes(next.t)) break;
              const node = v.tiles[next.side]?.[next.i];
              if (node && next.side !== side && !reached.includes(node)) reached.push(node);
            }
            show.cast(tile, reached, look, side);
            if (MELEE.has(look) && reached.length === 1) dash(v, tile, reached[0]);
          }
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
          if (tile) show?.impact(tile, look, ev.crit, (side === "hero" ? v.state.heroes : v.state.foes)[ev.i]?.boss);
          pop(tile, `${ev.crit ? "คริ! " : ""}-${fmt(ev.v)}`, ev.crit ? "is-crit" : "is-dmg");
          tone(ev.crit ? 180 : 140, .07, "square", ev.crit ? .06 : .04);
          if (ev.ko) { tone(110, .25, "sawtooth", .05); const u = (side === "hero" ? v.state.heroes : v.state.foes)[ev.i]; if (u) announce(`${u.name} ล้มแล้ว`); }
          break;
        case "heal": paintUnit(side, ev.i, ev.u); if (tile) show?.heal(tile, look === "leaf"); if (ev.v > 0) { pop(tile, `+${fmt(ev.v)}`, "is-heal"); tone(880, .08, "sine", .04); } break;
        case "shield": paintUnit(side, ev.i, ev.u); if (tile) show?.shield(tile); pop(tile, "เกราะ", "is-shield"); break;
        case "fx": paintUnit(side, ev.i, ev.u); if (tile && ["atkUp", "defUp", "defDown"].includes(ev.k)) show?.buff(tile, ev.k === "defDown"); if (ev.k === "stun") pop(tile, "มึนงง", "is-miss"); else if (ev.k === "cleanse") pop(tile, "ล้างสถานะ", "is-heal"); break;
        case "burn": paintUnit(side, ev.i, ev.u); if (tile) show?.impact(tile, "fire", false, false); pop(tile, `🔥-${fmt(ev.v)}`, "is-dmg"); break;
        case "status": paintUnit(side, ev.i, ev.u); break;
        case "wave":
          drawSide("foe"); drawTop(); show?.wave();
          v.tiles.foe.forEach((node, n) => { if (node) { node.style.animationDelay = `${n * 70}ms`; node.classList.add("is-arriving"); setTimeout(() => node.classList.remove("is-arriving"), 1000); } });
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
    if (stage.arena) { finishArena(v); return; }
    if (stage.dungeon) { finishDungeon(v); return; }
    const got = E.starsFor(b, stage);
    const first = won && !isCleared(stage.num);
    let coins = 0, gems = 0;
    const xp = E.stageXp(stage, won);
    const ups = shareXp(c.team.filter(Boolean), xp);
    store();
    if (won) {
      coins = first ? stage.coins : stage.repeat;
      if (c.team.includes("pupa")) coins = Math.round(coins * (1 + E.CARDS.pupa.passive.coins));
      if (first) { gems = stage.gems; addGems(gems); c.dust += stage.dust || 0; }
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
      box.append(el("p", "end-reward battle-reward", `ได้รับ ${gems ? `💎 ${gems} · ` : ""}${first && stage.dust ? `✧ ผลึกดาว ${stage.dust} · ` : ""}● ${fmt(coins)}${c.team.includes("pupa") ? " (รวมโบนัส Pupa)" : ""} · EXP ${xp} ต่อการ์ด`));
      if (ups.length) box.append(el("p", "battle-ups", `เลเวลอัป! ${ups.join(" · ")}`));
      if (gems) [659, 784, 988, 1319].forEach((note, n) => tone(note, .14, "triangle", .06, .3 + n * .09));
    } else box.append(el("p", null, `ได้ EXP ${xp} ต่อการ์ด${ups.length ? ` · เลเวลอัป! ${ups.join(" · ")}` : ""} · ลองอัปเลเวลการ์ด เปลี่ยนทีม หรือเรียงลำดับสกิลใหม่ แล้วมาลองอีกครั้ง`));
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
    announce(won ? `ชนะด่าน ${stage.num} ได้ ${got} ดาว และ ${coins} เหรียญ${gems ? ` และ ${gems} เพชร` : ""}` : "พ่ายแพ้ ลองอีกครั้ง");
    actions.querySelector("button")?.focus();
  }

  function finishArena(v) {
    const b = v.state, tier = v.stage, c = cards(), won = b.result === "won";
    const xp = Math.round(tier.xp * (won ? 1 : .3));
    const ups = shareXp(b.heroes.filter(Boolean).map(u => u.id), xp);
    if (won) { save().coins += tier.coins; addGems(tier.gems); c.dust += tier.dust || 0; c.arena = Math.max(c.arena, tier.num + 1); }
    store(); showCoins();
    v.busy = true;
    const box = el("div", "message-card battle-card");
    box.append(el("span", "moon-icon", won ? "✦" : "☾"), el("h2", null, won ? `ผ่านชั้น ${tier.num}!` : "พ่ายแพ้…"));
    box.append(el("p", "end-reward battle-reward", `${won ? `ได้รับ 💎 ${tier.gems} · ✧ ${tier.dust} · ● ${fmt(tier.coins)} · ` : ""}EXP ${xp} ต่อการ์ด`));
    if (ups.length) box.append(el("p", "battle-ups", `เลเวลอัป! ${ups.join(" · ")}`));
    const actions = el("div", "title-actions");
    if (won) actions.append(button("primary-button", `ชั้น ${tier.num + 1} ▶`, () => { battle = null; startBattle(E.arenaTier(tier.num + 1)); }));
    actions.append(button(won ? "secondary-button" : "primary-button", "สู้อีกครั้ง", () => { battle = null; startBattle(E.arenaTier(c.arena)); }));
    actions.append(button("secondary-button", "กลับ", () => { battle = null; tab = "arena"; showHub(); }));
    box.append(actions);
    v.result.replaceChildren(box);
    v.result.hidden = false;
    hint("");
    if (won) [523, 659, 784, 1047].forEach((note, n) => tone(note, .12, "triangle", .05, n * .1));
    announce(won ? `ผ่านลานประลองชั้น ${tier.num}` : "พ่ายแพ้ในลานประลอง");
    actions.querySelector("button")?.focus();
  }

  // ---- Keys (game.js hands them over while this is open) ----
  function key(event) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (battle && (event.key === "Enter" || event.key === " ") && battle.go && !event.target.closest?.("button")) { event.preventDefault(); goTurn(); }
  }

  // Straight to the pulls, from the market or the lobby.
  function openPulls() { tab = "pulls"; if (isShown) { closeSheet(true); if (!battle) showHub(); } else open(); }
  window.PupaCards = { open, openPulls, close, key, get isOpen() { return isShown; } };
  document.querySelectorAll("[data-open-cards]").forEach(node => game()?.onTap(node, open));
  // Test link: ?cards opens straight into the card battles.
  if (new URLSearchParams(location.search).has("cards")) setTimeout(() => open(), 400);
})();

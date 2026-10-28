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
  // A tap on something that has only just appeared is dropped: a quick
  // second tap (or a slow phone's late one) after opening a stage would
  // otherwise land on what opened under the finger, like a team card.
  const TAP_GUARD_MS = 400;
  let freshBox = null, freshAt = 0;
  const freshen = (box) => { freshBox = box; freshAt = performance.now(); };
  const button = (className, text, handler, label) => {
    const node = el("button", className, text);
    node.type = "button";
    if (label) node.setAttribute("aria-label", label);
    if (handler) game().onTap(node, (event) => {
      if (node.disabled) return;
      if (freshBox?.contains(node) && performance.now() - freshAt < TAP_GUARD_MS) return;
      handler(event);
    });
    return node;
  };
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // Hero cards use the hero pictures; pets and monsters are drawn by game.js.
  const PICTURES = {
    pupa: "assets/pupa-card.webp", jibjib: "assets/jibjib-hero.webp", baitoey: "assets/baitoey-hero.webp",
    ikuya: "assets/ikuya-hero.webp", pangji: "assets/pangji-hero.webp", pupav2: "assets/pupav2-hero.webp",
    dragon: "assets/dragon-pet.webp",
    sakura: "assets/sakura-hero.webp", chantra: "assets/chantra-hero.webp", thongkham: "assets/thongkham-hero.webp",
    miu: "assets/miu-hero.webp", ratri: "assets/ratri-hero.webp",
    phloeng: "assets/phloeng-hero.webp", mekha: "assets/mekha-hero.webp", fasai: "assets/fasai-hero.webp",
    moonrabbit: "assets/moonrabbit-pet.webp", starowl: "assets/starowl-pet.webp", silverwolf: "assets/silverwolf-pet.webp",
    seraphina: "assets/seraphina-hero.webp", asani: "assets/asani-hero.webp", phoenix: "assets/phoenix-pet.webp",
    vajira: "assets/vajira-hero.webp", naphalai: "assets/naphalai-hero.webp", qilin: "assets/qilin-pet.webp",
    nilakan: "assets/nilakan-hero.webp", arunee: "assets/arunee-hero.webp",
    kalawit: "assets/kalawit-hero.webp", thamin: "assets/thamin-hero.webp", nisa: "assets/nisa-hero.webp", asura: "assets/asura-hero.webp", prapha: "assets/prapha-hero.webp", suriyan: "assets/suriyan-hero.webp", ratsami: "assets/ratsami-hero.webp", thinakorn: "assets/thinakorn-hero.webp",
    chada: "assets/chada-hero.webp", anchan: "assets/anchan-hero.webp", phayak: "assets/phayak-hero.webp", wayu: "assets/wayu-hero.webp", sila: "assets/sila-hero.webp",
    // the four pets first drawn in code, now painted like the rest
    minibat: "assets/minibat-pet.webp", starsprite: "assets/starsprite-pet.webp", firefly: "assets/firefly-pet.webp", kitten: "assets/kitten-pet.webp",
    // the base monsters, painted (each chapter recolours them)
    ...Object.fromEntries(["bat", "crab", "ghost", "hopper", "jelly", "mimic", "queen", "rockling", "roller", "slime", "spider", "spitter", "swooper", "urchin", "wisp"].map(id => [id, `assets/foe-${id}.webp`])),
    // the angels of chapter 16
    ...Object.fromEntries(["angelguard", "cherub", "angelknight", "angelharp", "angelshield", "seraph", "angelmage", "stormangel", "archking", "archqueen"].map(id => [id, `assets/foe-${id}.webp`])),
    // the upper tower's five zones (floors 101-150)
    ...Object.fromEntries(E.TOWER_ZONES.flatMap(z => [...Object.keys(z.guards), z.lord[0], z.queen[0], z.great]).map(id => [id, `assets/foe-${id}.webp`])),
    // Halloween's raid dragon
    pumpkindragon: "assets/foe-pumpkindragon.webp",
    // bosses with art of their own
    serpent: "assets/boss-serpent.webp", golem: "assets/boss-golem.webp", icedragon: "assets/boss-icedragon.webp", reaper: "assets/boss-reaper.webp", kraken: "assets/boss-kraken.webp"
  };
  // A worn costume shows the card in its costume picture (assets/<id>-costume.webp)
  // with a golden glow.
  const costumeArt = (id) => `assets/${id}-costume.webp`;
  const COSTUME_NAME = { pupa: "ชุดไหมราตรีฟ้า", jibjib: "ชุดนักบินมรกต", baitoey: "ชุดภูตม่วงแสงจันทร์", ikuya: "ชุดนักสู้กุหลาบ", pangji: "ชุดซาลาเปาทองคำ", pupav2: "ชุดนักผจญภัยใบไม้", firefly: "ชุดแสงฟ้าคราม", kitten: "ชุดแมวน้ำทะเล", minibat: "ชุดค้างคาวมรกต", starsprite: "ชุดดาวชมพู", dragon: "ชุดมังกรหยก", sakura: "ชุดนินจาใบไผ่", chantra: "ชุดนักบวชสุริยะ", thongkham: "ชุดอัศวินมรกต", miu: "ชุดแม่มดน้ำแข็ง", ratri: "ชุดนักธนูโลหิต", moonrabbit: "ชุดกระต่ายซากุระ", starowl: "ชุดนกฮูกอำพัน", silverwolf: "ชุดหมาป่าอัคคี", phloeng: "ชุดอัศวินน้ำแข็ง", mekha: "ชุดเมฆอาทิตย์อัสดง", fasai: "ชุดนักดนตรีกุหลาบ", seraphina: "ชุดนักบุญราตรีฟ้า", asani: "ชุดอัศวินมังกรมรกต", phoenix: "ชุดวิหคเพลิงคราม", vajira: "ชุดอัศวินเพชรทับทิม", naphalai: "ชุดจอมเวทสุริยะ", qilin: "ชุดกิเลนหยกขาว", nilakan: "ชุดอัศวินรัตติกาลโลหิต", arunee: "ชุดอัศวินแสงจันทร์เงิน", kalawit: "ชุดนักฆ่าเงาครามเที่ยงคืน", thamin: "ชุดเกราะทมิฬโลหิต", nisa: "ชุดนักบวชจันทร์ม่วง", asura: "ชุดหอกอสูรมรกต", prapha: "ชุดดาบแสงกุหลาบทอง", suriyan: "ชุดโล่สุริยันเพลิง", ratsami: "ชุดนักบวชแสงฟ้า", thinakorn: "ชุดหอกตะวันเงิน", chada: "ชุดซามูไรทองคำ", anchan: "ชุดซามูไรซากุระ", phayak: "ชุดเสือดาวหิมะ", wayu: "ชุดเสือมรกต", sila: "ชุดอัศวินศิลาคราม" };
  // Every card has a 3D model (made with Hunyuan3D-2), shown on its sheet.
  // cards with a painted scene of their own behind the picture
  // (assets/cardbg-<id>.webp); the rest show their grade's scene
  const BACKDROPS = new Set("pupa jibjib baitoey ikuya pangji pupav2 firefly kitten minibat starsprite dragon sakura chantra thongkham miu ratri moonrabbit starowl phloeng mekha fasai silverwolf chada anchan phayak wayu sila nilakan arunee kalawit thamin nisa asura prapha suriyan ratsami thinakorn seraphina asani phoenix vajira naphalai qilin".split(" "));
  const backdrop = (node, id) => {
    if (BACKDROPS.has(id)) node.style.setProperty("--bg", `url("assets/cardbg-${id}.webp")`);
    return node;
  };
  const MODELS_3D = Object.fromEntries(E.CARD_IDS.map(id => [id, { bin: `assets/${id}-3d.bin`, texture: `assets/${id}-3d.webp` }]));
  // Halloween costumes (E.hasHallo: S and SSS cards), a gift: assets/<id>-halloween.webp
  const halloArt = (id) => `assets/${id}-halloween.webp`;
  const HALLO_NAME = { pupav2: "ชุดแม่มดฟักทอง", dragon: "ชุดมังกรฟักทอง", chantra: "ชุดแม่มดจันทร์เสี้ยว", ratri: "ชุดนักล่าแวมไพร์", phloeng: "ชุดนักรบเปลวฟักทอง", silverwolf: "ชุดมนุษย์หมาป่าจันทร์เพ็ญ", chada: "ชุดซามูไรภูตผี", anchan: "ชุดจิ้งจอกวิญญาณ", phayak: "ชุดมัมมี่พยัคฆ์", wayu: "ชุดโครงกระดูกจอมซน", sila: "ชุดอัศวินฟักทอง", nilakan: "ชุดยมทูต", arunee: "ชุดแม่มดแสงทอง", kalawit: "ชุดนักฆ่าค้างคาว", thamin: "ชุดอัศวินแฟรงเกนสไตน์", nisa: "ชุดเจ้าสาวภูตพราย", asura: "ชุดราชาปีศาจ", prapha: "ชุดภูตแคนดี้คอร์น", suriyan: "ชุดพาลาดินฟักทอง", ratsami: "ชุดภูตเทียนไข", thinakorn: "ชุดฟาโรห์มัมมี่", seraphina: "ชุดเทวดาราตรี", asani: "ชุดเคานต์แดร็กคูล่า", phoenix: "ชุดวิหคไฟผี", vajira: "ชุดอัศวินโครงกระดูก", naphalai: "ชุดราชินีแม่มด", qilin: "ชุดกิเลนฟักทอง" };
  // what a card wears: "halloween", "costume" or ""
  const skinOf = (id) => { const c = save()?.cards; return c?.hallo?.[id] === 1 && E.hasHallo(id) ? "halloween" : c?.outfit?.[id] === 2 ? "costume" : ""; };
  const wearing = (id) => Boolean(skinOf(id));
  // A monster's picture; the burning ones of chapter 3 are recoloured.
  function foeArt(id) {
    const art = portrait(E.FOES[id].art);
    const foe = E.FOES[id], glow = `drop-shadow(0 0 .3rem ${foe.glow || "rgba(255,120,40,.7)"})`;
    if (foe.look) art.style.filter = `${foe.look} ${glow}`;
    else if (foe.hue) art.style.filter = `hue-rotate(${foe.hue}deg) saturate(1.4) ${glow}`;
    return art;
  }
  function portrait(kind) {
    if (E.CARDS[kind] && wearing(kind)) {
      const img = el("img", `card-art is-costume${skinOf(kind) === "halloween" ? " is-halloween" : ""}`);
      img.src = skinOf(kind) === "halloween" ? halloArt(kind) : costumeArt(kind);
      img.alt = "";
      img.draggable = false;
      return img;
    }
    return plainPortrait(kind);
  }
  // The new monsters, drawn here on a 112 px square.
  const eyes = (g, x, y, gap, r, angry) => {
    for (const s of [-1, 1]) {
      g.fillStyle = "#fff"; g.beginPath(); g.ellipse(x + s * gap, y, r, r * 1.15, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#1a0d2e"; g.beginPath(); g.arc(x + s * gap - r * .15, y + r * .15, r * .58, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(x + s * gap - r * .35, y - r * .2, r * .22, 0, Math.PI * 2); g.fill();
      if (angry) { g.strokeStyle = "#1a0d2e"; g.lineWidth = 3; g.beginPath(); g.moveTo(x + s * (gap + r), y - r * 1.4); g.lineTo(x + s * (gap - r * .6), y - r * .9); g.stroke(); }
    }
  };
  const shine = (g, x, y, rx, ry) => { g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(x, y, rx, ry, -.5, 0, Math.PI * 2); g.fill(); };
  const MONSTER_ART = {
    slime(g) {
      const body = g.createRadialGradient(46, 50, 6, 56, 70, 50);
      body.addColorStop(0, "#b8ffcf"); body.addColorStop(1, "#2fb86a");
      g.fillStyle = body; g.beginPath(); g.moveTo(14, 96);
      g.bezierCurveTo(8, 60, 30, 26, 56, 24); g.bezierCurveTo(84, 26, 104, 60, 98, 96); g.quadraticCurveTo(56, 104, 14, 96); g.fill();
      g.fillStyle = "#2fb86a"; g.beginPath(); g.arc(30, 98, 6, 0, Math.PI * 2); g.arc(80, 99, 5, 0, Math.PI * 2); g.fill();
      shine(g, 40, 44, 10, 6); eyes(g, 56, 64, 15, 8, false);
      g.strokeStyle = "#1a5a32"; g.lineWidth = 3; g.beginPath(); g.arc(56, 76, 7, .2, Math.PI - .2); g.stroke();
    },
    ghost(g) {
      g.fillStyle = "rgba(190,170,255,.35)"; g.beginPath(); g.arc(56, 56, 48, 0, Math.PI * 2); g.fill();
      const body = g.createLinearGradient(0, 14, 0, 100);
      body.addColorStop(0, "#ffffff"); body.addColorStop(1, "#c9bdf5");
      g.fillStyle = body; g.beginPath(); g.moveTo(22, 96); g.lineTo(22, 52); g.bezierCurveTo(22, 20, 90, 20, 90, 52); g.lineTo(90, 96);
      for (let k = 0; k < 4; k++) g.quadraticCurveTo(90 - k * 17 - 8, 86 + (k % 2) * 4, 90 - (k + 1) * 17, 96);
      g.fill();
      g.beginPath(); g.ellipse(16, 62, 9, 5, -.6, 0, Math.PI * 2); g.ellipse(96, 62, 9, 5, .6, 0, Math.PI * 2); g.fill();
      shine(g, 40, 38, 9, 5); eyes(g, 56, 54, 13, 7, false);
      g.fillStyle = "#6b4fb8"; g.beginPath(); g.ellipse(56, 72, 6, 8, 0, 0, Math.PI * 2); g.fill();
    },
    wisp(g) {
      const glow = g.createRadialGradient(56, 66, 6, 56, 66, 54);
      glow.addColorStop(0, "rgba(255,200,90,.6)"); glow.addColorStop(1, "rgba(255,120,40,0)");
      g.fillStyle = glow; g.fillRect(0, 0, 112, 112);
      const body = g.createLinearGradient(0, 8, 0, 104);
      body.addColorStop(0, "#ff5a2a"); body.addColorStop(.55, "#ffb347"); body.addColorStop(1, "#fff1a8");
      g.fillStyle = body; g.beginPath(); g.moveTo(56, 6);
      g.bezierCurveTo(70, 30, 98, 46, 92, 74); g.bezierCurveTo(88, 98, 24, 98, 20, 74); g.bezierCurveTo(16, 52, 40, 44, 38, 26); g.bezierCurveTo(48, 34, 52, 22, 56, 6); g.fill();
      eyes(g, 56, 70, 13, 7, true);
      g.fillStyle = "#7a2410"; g.beginPath(); g.arc(56, 84, 5, 0, Math.PI); g.fill();
    },
    mimic(g) {
      g.fillStyle = "#6a3a1a"; g.fillRect(16, 58, 80, 40); g.fillStyle = "#8a5226"; g.fillRect(16, 58, 80, 8);
      g.fillStyle = "#ffd76a"; for (const x of [16, 52, 90]) g.fillRect(x, 58, 6, 40);
      g.save(); g.translate(16, 58); g.rotate(-.42);
      g.fillStyle = "#8a5226"; g.beginPath(); g.moveTo(0, 0); g.lineTo(80, 0); g.lineTo(80, -18); g.quadraticCurveTo(40, -36, 0, -18); g.fill();
      g.fillStyle = "#ffd76a"; g.fillRect(0, -6, 80, 6);
      g.fillStyle = "#fff"; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(4 + k * 11, 0); g.lineTo(9 + k * 11, 9); g.lineTo(14 + k * 11, 0); g.fill(); }
      g.restore();
      g.fillStyle = "#3a0a14"; g.beginPath(); g.moveTo(18, 58); g.lineTo(94, 58); g.lineTo(90, 40); g.lineTo(26, 30); g.fill();
      g.fillStyle = "#ff6a8a"; g.beginPath(); g.ellipse(58, 56, 16, 6, -.2, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#fff"; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(20 + k * 11, 58); g.lineTo(25 + k * 11, 50); g.lineTo(30 + k * 11, 58); g.fill(); }
      eyes(g, 50, 22, 11, 6, true);
      g.fillStyle = "#ffd76a"; g.beginPath(); g.arc(56, 80, 6, 0, Math.PI * 2); g.fill();
    },
    rockling(g) {
      g.fillStyle = "#5a5a6e";
      const rock = (x, y, r) => { g.beginPath(); for (let k = 0; k < 7; k++) { const a = k * Math.PI * 2 / 7, rr = r * (.85 + (k % 3) * .08); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); };
      g.fillStyle = "#4a4a5c"; rock(22, 74, 13); rock(90, 74, 13); rock(38, 100, 10); rock(74, 100, 10);
      g.fillStyle = "#6e6e86"; rock(56, 62, 34);
      g.fillStyle = "#8a8aa4"; rock(48, 50, 12);
      g.strokeStyle = "rgba(120,220,255,.85)"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(40, 78); g.lineTo(50, 70); g.lineTo(60, 80); g.lineTo(72, 70); g.stroke();
      g.fillStyle = "#7fe8ff"; g.shadowColor = "#7fe8ff"; g.shadowBlur = 10;
      g.beginPath(); g.ellipse(44, 58, 6, 4, 0, 0, Math.PI * 2); g.ellipse(68, 58, 6, 4, 0, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0;
    },
    spider(g) {
      g.strokeStyle = "#7a4fd8"; g.lineWidth = 4; g.lineCap = "round";
      for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
        g.beginPath(); g.moveTo(56 + s * 14, 66 + k * 5); g.quadraticCurveTo(56 + s * (34 + k * 4), 40 + k * 10, 56 + s * (46 + k * 2), 86 + k * 5); g.stroke();
      }
      const body = g.createRadialGradient(50, 50, 4, 56, 64, 34);
      body.addColorStop(0, "#f0d8ff"); body.addColorStop(1, "#8a5ad8");
      g.fillStyle = body; g.beginPath(); g.ellipse(56, 66, 26, 22, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#c9a8ff"; g.beginPath(); g.moveTo(56, 26); g.lineTo(66, 46); g.lineTo(56, 52); g.lineTo(46, 46); g.fill();
      shine(g, 46, 56, 8, 5); eyes(g, 56, 68, 11, 6, true);
      g.fillStyle = "#3a1a6a"; for (const x of [44, 68]) { g.beginPath(); g.arc(x, 56, 2.5, 0, Math.PI * 2); g.fill(); }
    }
  };
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
    if (MONSTER_ART[kind]) MONSTER_ART[kind](canvas.getContext("2d"));
    else game().paintPortrait(canvas, kind, 1000);
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
    "seraphina:0": "heal", "seraphina:1": "buff", "asani:0": "bolt", "asani:1": "bolt", "phoenix:0": "fire", "phoenix:1": "fire",
    "vajira:0": "shield", "vajira:1": "shield", "naphalai:0": "star", "naphalai:1": "star", "qilin:0": "bite", "qilin:1": "heal",
    "nilakan:0": "orb", "nilakan:1": "orb", "arunee:0": "star", "arunee:1": "fire",
    "kalawit:0": "slash", "kalawit:1": "slash", "thamin:0": "shield", "thamin:1": "shield", "nisa:0": "heal", "nisa:1": "orb", "asura:0": "slash", "asura:1": "sonic",
    "prapha:0": "slash", "prapha:1": "star", "suriyan:0": "shield", "suriyan:1": "shield", "ratsami:0": "heal", "ratsami:1": "buff", "thinakorn:0": "slash", "thinakorn:1": "fire",
    "chada:0": "slash", "chada:1": "slash", "anchan:0": "slash", "anchan:1": "shield", "phayak:0": "bite", "phayak:1": "stomp", "wayu:0": "shield", "wayu:1": "stomp", "sila:0": "shield", "sila:1": "shield",
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
    const xp = {}, outfit = {}, hallo = {};
    for (const id of Object.keys(units)) {
      const n = Math.max(0, Math.floor(Number(raw.xp?.[id]) || 0));
      if (n > 0) xp[id] = n;
      const o = Math.floor(Number(raw.outfit?.[id]) || 0);
      if (o === 1 || o === 2) outfit[id] = o;
      // a Halloween costume worn takes the shop costume off
      if (raw.hallo?.[id] === 1 && E.hasHallo(id)) { hallo[id] = 1; if (outfit[id] === 2) outfit[id] = 1; }
    }
    const now = Date.now();
    const idleAt = Math.min(now, Math.max(0, Math.floor(Number(raw.idleAt) || 0))) || now;
    const daily = raw.daily && typeof raw.daily.day === "string" ? { day: raw.daily.day.slice(0, 10), streak: Math.max(1, Math.min(7, Math.floor(Number(raw.daily.streak) || 1))) } : null;
    const dungeon = raw.dungeon && raw.dungeon.day === today() ? { day: today(), exp: raw.dungeon.exp === true, coin: raw.dungeon.coin === true } : { day: today(), exp: false, coin: false };
    // the dragon raid: today's best score and the coins paid for it, and
    // the best score ever
    const count = (v) => Math.max(0, Math.floor(Number(v) || 0));
    const raid = raw.raid?.day === today() ? { day: today(), best: count(raw.raid.best), paid: count(raw.raid.paid), top: count(raw.raid.top) } : { day: today(), best: 0, paid: 0, top: count(raw.raid?.top) };
    // Halloween's candy (see E.HALLOWEEN): earned, bought, today's counts
    const re = raw.event?.id === E.HALLOWEEN.id ? raw.event : null;
    const bought = {};
    for (const item of E.HALLOWEEN_SHOP) { const n = Math.min(item.limit, count(re?.bought?.[item.key])); if (n) bought[item.key] = n; }
    const event = { id: E.HALLOWEEN.id, earned: count(re?.earned), bought, ...(re?.day === today() ? { day: today(), battle: count(re.battle), gift: re.gift === true, raid: count(re.raid) } : { day: today(), battle: 0, gift: false, raid: 0 }) };
    const awake = {}, shards = {};
    for (const id of E.CARD_IDS) {
      const a = Math.min(E.maxAwake(id), Math.floor(Number(raw.awake?.[id]) || 0));
      if (a > 0 && units[id]) awake[id] = a;
      const sh = Math.max(0, Math.floor(Number(raw.shards?.[id]) || 0));
      if (sh > 0) shards[id] = sh;
      if (units[id]) units[id] = Math.min(units[id], E.capFor(awake[id]));
    }
    const dust = Math.max(0, Math.floor(Number(raw.dust) || 0));
    // enhancement ore for gear; saves from before gear start with a gift
    const ore = raw.ore == null ? E.ORE_GIFT : Math.max(0, Math.floor(Number(raw.ore) || 0));
    // gear: tier * 100 + level per owned card's piece (see E.gearOf)
    const gear = {};
    for (const id of Object.keys(units)) E.GEAR_SLOTS.forEach((_, n) => {
      const key = E.gearKey(id, n), v = Math.floor(Number(raw.gear?.[key]) || 0);
      if (v > 100) gear[key] = Math.min(E.GEAR_TIERS.length * 100 + E.GEAR_TIERS.length * E.GEAR_STEP, v);
    });
    // items from battles (see E.itemParts), worn only by an owned card, one
    // a slot; gone: items broken down, so a merge does not bring them back
    const items = [], worn = new Set();
    for (const it of Array.isArray(raw.items) ? raw.items : []) {
      if (!it || typeof it.i !== "string" || !/^[a-z0-9]{1,12}$/.test(it.i) || items.length >= E.BAG_SIZE + 30 || items.some(other => other.i === it.i)) continue;
      const sl = Math.floor(Number(it.s)), r = Math.floor(Number(it.r)), m = Math.floor(Number(it.m));
      if (!(sl >= 0 && sl < E.GEAR_SLOTS.length && r >= 1 && r <= E.ITEM_RARITY.length && m >= 0 && m <= 100)) continue;
      const x = (Array.isArray(it.x) ? it.x : []).map(Number).filter(v => Number.isInteger(v) && v >= 0 && Math.floor(v / 1000) < E.ITEM_EXTRAS.length && v % 1000 <= 100).slice(0, r - 1);
      let o = typeof it.o === "string" && units[it.o] ? it.o : "";
      if (o && worn.has(`${o}:${sl}`)) o = "";
      if (o) worn.add(`${o}:${sl}`);
      items.push({ i: it.i, s: sl, r, m, x, o });
    }
    const gone = (Array.isArray(raw.gone) ? raw.gone : []).filter(v => typeof v === "string" && /^[a-z0-9]{1,12}$/.test(v)).slice(-300);
    // star-up wings; saves from before wings start with a gift of 3
    let wings = raw.wings == null ? 3 : Math.max(0, Math.floor(Number(raw.wings) || 0));
    // once per account: the wings boss stages and arena floors cleared
    // before wings existed would have given (see E.wingCompensation)
    const wingComp = raw.wingComp === true;
    if (!wingComp) { wingGift = E.wingCompensation(best, Math.max(1, Math.floor(Number(raw.arena) || 1))); wings += wingGift; }
    const rq = raw.quest && typeof raw.quest.day === "string" ? raw.quest : null;
    const quest = E.questFor(rq ? { day: rq.day.slice(0, 10), counts: Object.fromEntries(Object.entries(rq.counts || {}).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))])), claimed: (Array.isArray(rq.claimed) ? rq.claimed : []).filter(id => typeof id === "string") } : null, today());
    const arenaPick = [...new Set((Array.isArray(raw.arenaPick) ? raw.arenaPick : []).filter(id => units[id]))].slice(0, E.ARENA_SIZE);
    const arenaFront = [...new Set((Array.isArray(raw.arenaFront) ? raw.arenaFront : []).filter(id => arenaPick.includes(id)))].slice(0, E.ARENA_FRONT);
    const achv = [...new Set((Array.isArray(raw.achv) ? raw.achv : []).filter(id => typeof id === "string"))];
    const starPaid = [...new Set((Array.isArray(raw.starPaid) ? raw.starPaid : []).map(Number).filter(n => Number.isInteger(n) && n > 0 && n <= 99))].sort((a, b) => a - b);
    // saved teams: five slots, each a name and five places ("" empty)
    const sets = Array.from({ length: TEAM_SETS }, (_, k) => {
      const one = Array.isArray(raw.sets) ? raw.sets[k] : null;
      if (!one || !Array.isArray(one.t)) return null;
      const t = one.t.slice(0, E.TEAM_SIZE).map(id => (typeof id === "string" && units[id] ? id : ""));
      while (t.length < E.TEAM_SIZE) t.push("");
      t.forEach((id, n) => { if (id && t.indexOf(id) !== n) t[n] = ""; });
      return { n: typeof one.n === "string" ? one.n.trim().slice(0, SET_NAME_MAX) : "", t, ...(E.FORMATIONS.some(f => f.id === one.f) ? { f: one.f } : {}) };
    });
    // the formation in use and each one's level (see E.formOf)
    const form = E.FORMATIONS.some(f => f.id === raw.form) ? raw.form : E.FORMATIONS[0].id;
    const formLv = {};
    for (const f of E.FORMATIONS) { const n = Math.min(E.FORM_MAX, Math.floor(Number(raw.formLv?.[f.id]) || 0)); if (n > 1) formLv[f.id] = n; }
    const set = Math.min(TEAM_SETS - 1, Math.max(0, Math.floor(Number(raw.set) || 0)));
    s.cards = { units, team, sets, set, form, formLv, stars: best, xp, outfit, hallo, idleAt, daily, dungeon, awake, shards, dust, ore, gear, items, gone, wings, wingComp: true, quest, achv, arenaPick, arenaFront, tower: Math.min(E.TOWER_FLOORS, Math.max(0, Math.floor(Number(raw.tower) || 0))), starPaid, arena: Math.max(1, Math.floor(Number(raw.arena) || 1)), raid, event, auto: Boolean(raw.auto), fast: Boolean(raw.fast) };
    return s.cards;
  }
  let wingGift = 0; // wings given back on this visit, shown once
  const cards = () => save().cards;
  // A card's grade badge (D to SSS) and its red awakening stars.
  const gradeOf = (id) => E.GRADES[E.CARDS[id].rarity];
  const gradeBadge = (id, cls = "grade") => el("span", `${cls} grade-${gradeOf(id).toLowerCase()}`, gradeOf(id));
  // red stars 1-5; the second awakening turns them gold one by one
  const redStars = (n, max = 0) => {
    const row = el("span", "red-stars");
    const gold = Math.max(0, n - E.MAX_AWAKE), red = Math.min(n, E.MAX_AWAKE) - gold;
    if (gold) row.append(el("em", null, "★".repeat(gold)));
    if (red) row.append(el("b", null, "★".repeat(red)));
    const empty = Math.min(max, E.MAX_AWAKE) - Math.min(n, E.MAX_AWAKE);
    if (empty > 0) row.append(el("i", null, "★".repeat(empty)));
    return row;
  };
  // ---- Items from battles ----
  const newItemId = () => `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 6)}`.replace(/[^a-z0-9]/g, "0");
  const itemName = (item) => `${E.GEAR_SLOTS[item.s].name}${E.ITEM_RARITY[item.r - 1].name}`;
  // count items with luck (see E.rollItem); with the bag full, an item
  // turns straight into ore
  function grantLoot(count, luck = 0, minRarity = 1) {
    const c = cards(), loot = { items: [], ore: 0 };
    c.items = c.items || [];
    for (let k = 0; k < count; k++) {
      const item = { i: newItemId(), ...E.rollItem(Math.random, luck, minRarity), o: "" };
      if (c.items.length >= E.BAG_SIZE) loot.ore += E.SALVAGE_ORE[item.r - 1];
      else { c.items.push(item); loot.items.push(item); }
    }
    c.ore += loot.ore;
    return loot;
  }
  // the items won, for a result card
  function lootRow(loot) {
    const row = el("div", "loot-row");
    for (const item of loot.items) {
      const one = el("span", `loot-item r${item.r}`);
      const icon = el("span", `gear-icon t${item.r}`), img = el("img");
      img.src = `assets/gear-${E.GEAR_SLOTS[item.s].key}.webp`; img.alt = "";
      icon.append(img);
      one.append(icon, el("small", null, itemName(item)));
      row.append(one);
    }
    if (loot.ore) row.append(el("small", "loot-full", `กระเป๋าเต็ม · ย่อยเป็น ⛏ ${loot.ore}`));
    return row;
  }
  const hasLoot = (loot) => Boolean(loot && (loot.items.length || loot.ore));
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
  // a card as the power numbers see it: level, stars, costume and gear
  const powerEntry = (id) => ({ id, lv: cards().units[id], bonus: E.cardBonus(cards(), id), gear: E.gearBonus(cards(), id) });
  // the team as it fights: with the formation's bonus
  const teamPower = () => E.teamPowerOf(E.fielded(cards()).filter(Boolean));

  // ---- Recommended cards ----
  // Three cards per stage and tower floor (E.favsOf); each one in the team
  // gives everyone attack +E.FAV_ATK there. `after` redraws what shows it.
  function favStrip(stage, after) {
    const c = cards(), favs = E.favsOf(stage);
    if (!favs.length) return null;
    const fielded = favs.filter(id => c.team.includes(id)).length;
    const box = el("div", `fav-strip${fielded ? " is-active" : ""}`);
    const head = el("p", "fav-head");
    head.append(el("b", null, "⭐ ตัวละครแนะนำ"), el("span", null, `ลงทีมใบละ โจมตีทั้งทีม +${pct(E.FAV_ATK)} · ตอนนี้ ${fielded}/${favs.length} ใบ +${pct(fielded * E.FAV_ATK)}`));
    const row = el("div", "fav-row");
    for (const id of favs) {
      const def = E.CARDS[id], owned = Boolean(c.units[id]), on = c.team.includes(id);
      const tile = button(`fav-card r${def.rarity}${owned ? "" : " is-locked"}${on ? " is-on" : ""}`, null, () => { tab = "team"; cardSheet(id); },
        `${def.name} ระดับ ${gradeOf(id)} ${on ? "อยู่ในทีมแล้ว" : owned ? "มีแล้ว ยังไม่อยู่ในทีม" : "ยังไม่มีการ์ดนี้"}`);
      const face = backdrop(el("span", "fav-face"), id);
      face.append(portrait(id));
      tile.append(face, gradeBadge(id, "fav-grade grade"), el("b", null, def.name), el("small", null, on ? "ในทีม ✓" : owned ? "มีแล้ว" : "🔒 ยังไม่มี"));
      row.append(tile);
    }
    box.append(head, row);
    const ready = favs.filter(id => c.units[id] && !c.team.includes(id)), plan = planFavs(c, stage);
    if (plan.added.length) box.append(button("secondary-button fav-fill", `⭐ ใส่ตัวแนะนำที่มีลงทีม (${plan.added.length})`, () => { fillFavs(stage); after(); }));
    else if (ready.length) box.append(el("p", "fav-note", "ทีมเต็มด้วยตัวแนะนำและตัวฮีลแล้ว · เก็บตัวฮีลไว้ จัดเองได้ที่แท็บทีม"));
    return box;
  }
  // A card that heals, which the button below never takes out of the team.
  const isHealer = (id) => E.CARDS[id]?.skills.some(skill => skill.heal);
  // Where the recommended cards this player owns would go: into empty
  // places first, then in place of the weakest card that is neither
  // recommended nor a healer.
  function planFavs(c, stage) {
    const favs = E.favsOf(stage), team = [...c.team], added = [];
    for (const id of favs) {
      if (!c.units[id] || team.includes(id)) continue;
      let slot = team.indexOf("");
      if (slot < 0) {
        const out = team.map((t, n) => ({ t, n })).filter(o => o.t && !favs.includes(o.t) && !isHealer(o.t)).sort((a, b) => E.cardPower(c, a.t) - E.cardPower(c, b.t))[0];
        if (!out) break;
        slot = out.n;
      }
      team[slot] = id;
      added.push(id);
    }
    return { team, added };
  }
  function fillFavs(stage) {
    const c = cards(), plan = planFavs(c, stage);
    if (!plan.added.length) return;
    plan.team.forEach((id, n) => { c.team[n] = id; });
    store();
    [659, 880, 1047].forEach((note, i) => tone(note, .07, "triangle", .04, i * .06));
    const kept = c.team.filter(id => id && isHealer(id) && !plan.added.includes(id)).map(id => E.CARDS[id].name);
    announce(`ใส่${plan.added.map(id => E.CARDS[id].name).join(" ")}ลงทีมแล้ว โจมตีทั้งทีม +${pct(E.favAtk(c.team, stage))}${kept.length ? ` · เก็บตัวฮีล ${kept.join(" ")} ไว้` : ""}`);
  }

  // ---- Team sets ----
  // Five saved teams. The one picked is the team in play (c.team); the
  // others wait in c.sets until picked. A new set starts as a copy of the
  // team in play.
  const TEAM_SETS = 5, SET_NAME_MAX = 16;
  const setName = (c, k) => c.sets?.[k]?.n || `ทีม ${k + 1}`;
  const setTeamOf = (c, k) => (k === c.set ? c.team : c.sets?.[k]?.t || null);
  const setPower = (c, k) => (k === c.set ? teamPower() : E.teamPowerOf(E.fielded({ ...c, team: setTeamOf(c, k) || [], form: c.sets?.[k]?.f || c.form }).filter(Boolean)));
  function pickSet(k, after) {
    const c = cards();
    if (k === c.set) return;
    if (!Array.isArray(c.sets)) c.sets = Array(TEAM_SETS).fill(null);
    // the team as it stands goes back into its own set
    // (each set keeps its formation too)
    c.sets[c.set] = { n: c.sets[c.set]?.n || "", t: [...c.team], f: E.formOf(c).id };
    const saved = c.sets[k], fresh = !saved?.t?.some(id => id && c.units[id]);
    if (fresh) c.sets[k] = { n: saved?.n || "", t: [...c.team], f: E.formOf(c).id };
    else { c.team = saved.t.map(id => (id && c.units[id] ? id : "")); if (saved.f) c.form = saved.f; }
    c.set = k;
    store();
    [587, 784].forEach((note, i) => tone(note, .06, "triangle", .04, i * .05));
    announce(fresh ? `สร้าง${setName(c, k)} จากทีมปัจจุบัน จัดการ์ดได้เลย` : `ใช้${setName(c, k)} พลังทีม ${fmt(teamPower())}`);
    after();
  }
  // the row of set buttons; `after` redraws whatever shows it
  function setStrip(after, compact = false) {
    const c = cards();
    const box = el("div", `team-sets${compact ? " is-compact" : ""}`);
    if (!compact) box.append(el("span", "team-sets-label", "ทีมเซ็ต"));
    const row = el("div", "team-sets-row");
    row.setAttribute("role", "tablist");
    row.setAttribute("aria-label", "ทีมเซ็ต");
    for (let k = 0; k < TEAM_SETS; k++) {
      const on = k === c.set, has = Boolean(setTeamOf(c, k)?.some(Boolean));
      const chip = button(`team-set${on ? " is-on" : ""}${has ? "" : " is-empty"}`, null, () => pickSet(k, after),
        `${setName(c, k)}${on ? " (ใช้อยู่)" : has ? ` พลังทีม ${fmt(setPower(c, k))}` : " ว่าง แตะเพื่อสร้างจากทีมปัจจุบัน"}`);
      chip.setAttribute("role", "tab");
      chip.setAttribute("aria-selected", String(on));
      chip.append(el("b", null, setName(c, k)), el("small", null, has ? `⚔ ${fmt(setPower(c, k))}` : "+ สร้าง"));
      row.append(chip);
    }
    box.append(row);
    if (!compact) box.append(button("team-set-name", "✎ ตั้งชื่อ", () => renameSet(after), `ตั้งชื่อ${setName(c, c.set)}`));
    return box;
  }
  function renameSet(after) {
    const c = cards(), k = c.set;
    const form = el("form", "set-name-form");
    const input = el("input", "set-name-input");
    input.type = "text";
    input.maxLength = SET_NAME_MAX;
    input.value = c.sets?.[k]?.n || "";
    input.placeholder = `ทีม ${k + 1}`;
    input.setAttribute("aria-label", "ชื่อทีมเซ็ต");
    input.autocomplete = "off";
    const done = () => {
      const now = cards();
      if (!Array.isArray(now.sets)) now.sets = Array(TEAM_SETS).fill(null);
      now.sets[k] = { n: input.value.trim().slice(0, SET_NAME_MAX), t: [...(k === now.set ? now.team : now.sets[k]?.t || now.team)], f: k === now.set ? E.formOf(now).id : now.sets[k]?.f || E.formOf(now).id };
      store();
      tone(660, .08, "triangle", .05);
      announce(`ตั้งชื่อเป็น ${setName(now, k)} แล้ว`);
      closeSheet(true);
      after();
    };
    form.addEventListener("submit", (event) => { event.preventDefault(); done(); });
    const actions = el("div", "title-actions sheet-actions");
    actions.append(button("primary-button", "บันทึก", done), button("secondary-button", "ยกเลิก", () => closeSheet(true)));
    form.append(input, actions);
    openSheet([el("h3", "sheet-title", `ตั้งชื่อ${setName(c, k)}`), el("p", "sheet-sub", `ไม่เกิน ${SET_NAME_MAX} ตัวอักษร · เว้นว่างไว้เพื่อใช้ชื่อ ทีม ${k + 1}`), form]);
    input.focus();
    input.select();
  }
  // The stage a card is the first-clear prize of.

  // ---- The frame ----
  const frame = el("div", "shop-card cards-card");
  const head = el("header", "shop-head");
  const title = el("h2", null, "ศึกการ์ดแสงจันทร์");
  title.id = "cardsTitle";
  const wallet = el("div", "shop-wallet");
  wallet.setAttribute("aria-label", "เหรียญที่มี");
  wallet.innerHTML = "<i>●</i> <b></b> <span class=\"gem\">💎</span> <b class=\"gems\"></b>";
  // The card mode fills the screen; home goes back to choosing a mode.
  const closeButton = button("icon-button cards-home", "🏠", () => goHome(), "กลับหน้าเลือกโหมด");
  head.append(closeButton, title, wallet);
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
    else if (!showWingGift() && !halloGiftSheet()) payStarBonus(true);
  }

  // The Halloween costumes' gift note, once on this device; returns whether
  // it showed.
  const HALLO_SEEN_KEY = "superPupaRunHalloGift";
  function halloGiftSheet() {
    try {
      if (localStorage.getItem(HALLO_SEEN_KEY)) return false;
      localStorage.setItem(HALLO_SEEN_KEY, "1");
    } catch { return false; }
    const c = cards(), all = E.CARD_IDS.filter(E.hasHallo), mine = all.filter(id => c.units[id]);
    const grid = el("div", "hallo-gift");
    for (const id of (mine.length ? mine : all).slice(0, 12)) {
      const fig = el("figure", "hallo-gift-card");
      const img = el("img");
      img.src = halloArt(id);
      img.alt = "";
      fig.append(img, el("figcaption", null, E.CARDS[id].name));
      grid.append(fig);
    }
    const parts = [el("span", "moon-icon", "🎃"), el("h3", "sheet-title", `ของขวัญฮาโลวีน · ชุดคอสตูม ${all.length} ชุด`),
      el("p", "sheet-sub", `การ์ดระดับ S และ SSS ทุกใบได้ชุดฮาโลวีนฟรี ใส่แล้วเพิ่มพลังชีวิต โจมตี ป้องกัน +${Math.round(E.COSTUME_BONUS * 100)}% เท่าชุดคอสตูม (ใส่ได้ทีละชุด) เปลี่ยนชุดได้ที่หน้าการ์ด แท็บคอสตูม`), grid];
    const actions = el("div", "title-actions sheet-actions");
    if (mine.length) {
      actions.append(button("primary-button", `ใส่ชุดฮาโลวีนให้ทั้ง ${mine.length} ใบ`, () => {
        for (const id of mine) { c.hallo[id] = 1; if (c.outfit[id] === 2) c.outfit[id] = 1; }
        store();
        [784, 988, 1319].forEach((note, i) => tone(note, .1, "triangle", .05, i * .07));
        announce("ใส่ชุดฮาโลวีนให้การ์ดระดับ S ขึ้นไปแล้ว");
        closeSheet();
      }));
    } else parts.push(el("p", null, "ยังไม่มีการ์ดระดับ S ได้การ์ด S หรือ SSS เมื่อไร ชุดฮาโลวีนพร้อมใส่ทันที"));
    actions.append(button("secondary-button", "ไว้ทีหลัง", () => closeSheet()));
    parts.push(actions);
    openSheet(parts);
    return true;
  }

  function close() {
    if (battle) { leaveBattle(); return; }
    if (sheet) { closeSheet(); return; }
    goHome();
  }

  // Back to the mode picker. A battle still running needs a second tap.
  let homeArmed = 0;
  function goHome() {
    const v = battle;
    if (v && v.state.phase !== "done" && Date.now() - homeArmed > 2500) {
      homeArmed = Date.now();
      closeButton.textContent = "ออก?";
      setTimeout(() => { closeButton.textContent = "🏠"; }, 2500);
      tone(330, .08, "square", .04);
      announce("กดอีกครั้งเพื่อยอมแพ้และกลับหน้าเลือกโหมด");
      return;
    }
    homeArmed = 0;
    closeButton.textContent = "🏠";
    if (v) { v.token.stopped = true; stopShow(); battle = null; }
    stopMap();
    mapChapter = 0;
    if (sheet) closeSheet(true);
    tab = "stages";
    isShown = false;
    screen.hidden = true;
    game().setCardsOpen(false);
    if (game().showModes) game().showModes(); else opener?.focus?.();
  }

  // ---- Hub: stages and team ----
  function showHub() {
    stopShow();
    stopMap();
    battle = null;
    // back from a sheet or a battle: the hub's cards appear under the finger
    const back = Boolean(sheet) || frame.classList.contains("is-battle");
    sheet = null;
    frame.classList.remove("is-battle", "is-arena");
    showCoins();
    // the menu sits at the foot of the screen, as in a phone game: an
    // icon and a short name; the full name is the label and tooltip
    const tabs = el("nav", "shop-tabs cards-tabs cards-footer");
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "เมนูศึกการ์ด");
    for (const [key, icon, label, short] of [["stages", "🗺️", "ด่าน", "ด่าน"], ["pulls", "🎴", "สุ่มการ์ด", "สุ่ม"], ["daily", "🌞", "ด่านประจำวัน", "ประจำวัน"], ["arena", "⚔️", "ลานประลอง", "ประลอง"], ["tower", "🗼", "หอคอย", "หอคอย"], ["quests", "📜", "เควส", "เควส"], ["team", "👥", "ทีม", "ทีม"]]) {
      const t = button(`cards-tab-icon${key === "quests" && questsReady() ? " has-dot" : ""}`, null, () => { tab = key; showHub(); tone(587, .05, "triangle", .04); }, label);
      t.append(el("span", "tab-icon", icon), el("small", "tab-name", short));
      t.title = label;
      t.setAttribute("role", "tab");
      t.setAttribute("aria-selected", String(tab === key));
      tabs.append(t);
    }
    const panel = el("div", "shop-list cards-scroll");
    panel.setAttribute("role", "tabpanel");
    if (tab === "stages") renderStages(panel); else if (tab === "pulls") renderPulls(panel); else if (tab === "daily") renderDungeons(panel); else if (tab === "arena") renderArena(panel); else if (tab === "quests") renderQuests(panel); else if (tab === "tower") renderTower(panel); else renderTeam(panel);
    const event = eventBanner();
    body.replaceChildren(idleBanner(), ...(event ? [event] : []), panel, tabs);
    if (back) freshen(body);
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
    text.append(el("b", null, "⚔ ล่าอัตโนมัติ"), el("span", null, `สะสม ${h} ชม. ${m} นาที${got.hours >= E.IDLE_HOURS ? " (เต็มแล้ว)" : ` / ${E.IDLE_HOURS} ชม.`}`), el("span", "idle-loot", `● ${fmt(got.coins)} · EXP ${fmt(got.xp)} · ⛏ ${got.ore}${got.hours >= 2 ? ` · 🎁 ${Math.floor(got.hours / 2)}` : ""}`));
    const claim = button("shop-buy idle-claim", "รับรางวัล", () => claimIdle());
    claim.disabled = got.coins < 1 && got.xp < 1;
    box.append(scene, text, claim);
    return box;
  }
  function claimIdle() {
    const c = cards(), got = E.idleReward(bestStage(), Date.now() - c.idleAt);
    if (got.coins < 1 && got.xp < 1) return;
    c.idleAt = Date.now();
    questTick("idle");
    save().coins += got.coins;
    c.ore += got.ore;
    const loot = grantLoot(Math.floor(got.hours / 2), Math.min(2, bestStage() / 80));
    const ups = shareXp(c.team.filter(Boolean), got.xp);
    store();
    [523, 659, 784, 1047].forEach((note, i) => tone(note, .1, "triangle", .05, i * .07));
    announce(`รับ ${got.coins} เหรียญ และ EXP ${got.xp}${ups.length ? ` เลเวลอัป: ${ups.join(", ")}` : ""}`);
    showHub();
    openSheet([el("h3", "sheet-title", "รางวัลล่าอัตโนมัติ"), el("p", "sheet-reward", `● ${fmt(got.coins)} · ⛏ แร่ ${got.ore} · EXP ${fmt(got.xp)} ให้การ์ดทุกใบในทีม`), ...(hasLoot(loot) ? [lootRow(loot)] : []), ...(ups.length ? [el("p", "sheet-passive", `เลเวลอัป! ${ups.join(" · ")}`)] : []), el("p", "sheet-goals", "ทีมจะล่าต่อเองแม้ปิดเกม ผ่านด่านไกลขึ้น ได้รางวัลมากขึ้น")]);
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
      cell.append(el("small", null, `วันที่ ${n + 1}`), el("b", null, [r.gems ? `💎 ${r.gems}` : "", r.coins ? `● ${r.coins}` : "", r.xp ? `EXP ${r.xp}` : "", r.wings ? `🪽 ${r.wings}` : ""].filter(Boolean).join(" + ")));
      grid.append(cell);
    });
    const take = button("primary-button", "รับรางวัลวันนี้", () => {
      const r = E.DAILY[day - 1];
      c.daily = { day: today(), streak: day };
      save().coins += r.coins || 0;
      addGems(r.gems || 0);
      cards().wings += r.wings || 0;
      const ups = r.xp ? shareXp(c.team.filter(Boolean), r.xp) : [];
      store();
      [659, 784, 988, 1319].forEach((note, i) => tone(note, .12, "triangle", .06, i * .08));
      announce(`รับรางวัลวันที่ ${day} แล้ว${ups.length ? ` เลเวลอัป: ${ups.join(", ")}` : ""}`);
      closeSheet();
      if (!showWingGift()) payStarBonus(true);
    });
    openSheet([el("h3", "sheet-title", "รางวัลเข้าเกมรายวัน"), el("p", "sheet-sub", "เข้ามาทุกวันติดกัน รางวัลยิ่งใหญ่ขึ้น ครบ 7 วันเริ่มรอบใหม่ · EXP แจกให้การ์ดทุกใบในทีม"), grid, el("div", "title-actions sheet-actions", null)]);
    sheet.querySelector(".sheet-actions").append(take);
    take.focus();
  }

  // ---- Card pulls ----
  // Characters and pets are found only here. Rolls happen on this device
  // with gems, which are earned in play and never sold for money.
  const pity = () => Math.max(0, Math.floor(Number(save().cardPity) || 0));
  const pity6 = () => Math.max(0, Math.floor(Number(save().cardPity6) || 0));
  function renderPulls(panel) {
    const g = E.GACHA, have = save().gems || 0;
    const banner = el("section", "pull-banner");
    const row = el("div", "pull-faces");
    for (const id of ["nilakan", "arunee", "vajira", "seraphina", "naphalai", "asani", "qilin"]) { const f = backdrop(el("span", `pull-face r${E.CARDS[id].rarity}`), id); f.append(portrait(id), gradeBadge(id, "pull-grade"), cardDeco()); row.append(f); }
    banner.append(el("p", "news-eyebrow", "✦ สุ่มการ์ดแสงจันทร์"), el("h3", null, "ตัวละครและสัตว์เลี้ยงได้จากที่นี่เท่านั้น"), row);
    const odds = el("p", "pull-odds", `อัตรา: ${[6, 5, 4, 3, 2, 1].map(r => `${E.GRADES[r]} ${Math.round(g.rates[r] * 1000) / 10}%`).join(" · ")} · การันตี S ขึ้นไปภายใน ${g.pity} ครั้ง (อีก ${g.pity - pity()} ครั้ง) · การันตี SSS ภายใน ${g.pity6} ครั้ง (อีก ${g.pity6 - pity6()} ครั้ง) · สุ่ม 10 ครั้งได้ B ขึ้นไปอย่างน้อย 1 ใบ · ได้ซ้ำเปลี่ยนเป็นเศษการ์ดใบนั้นไว้อัปดาว (${[6, 5, 4, 3, 2, 1].map(r => `${E.GRADES[r]} ${E.DUPE_SHARDS[r]}`).join(" · ")}) และ S ได้ปีกอัพดาว 🪽1 SSS ได้ 🪽3`);
    const actions = el("div", "title-actions sheet-actions pull-actions");
    const one = button("primary-button", `สุ่ม 1 ครั้ง · 💎 ${g.one}`, () => doPull(1));
    const ten = button("primary-button pull-ten", `สุ่ม 10 ครั้ง · 💎 ${g.ten}`, () => doPull(10));
    one.disabled = have < g.one; ten.disabled = have < g.ten;
    actions.append(one, ten);
    const left = el("p", "pull-pity");
    left.append(el("span", "grade grade-s", "S"), ` อีก ${g.pity - pity()} ครั้ง · `, el("span", "grade grade-sss", "SSS"), ` อีก ${g.pity6 - pity6()} ครั้ง การันตีได้แน่นอน`);
    banner.append(left, odds, actions, el("p", "sheet-goals", `มีเพชร 💎 ${fmt(have)} · เพชรได้จากผ่านด่านครั้งแรก (ทั้งผจญภัยและศึกการ์ด) รางวัลรายวัน ลานประลอง และด่านประจำวัน`));
    panel.append(banner, itemBanner());
    const list = el("div", "pull-pool");
    for (const r of [6, 5, 4, 3, 2, 1]) {
      const line = el("p", "pull-tier");
      line.append(el("b", `grade grade-${E.GRADES[r].toLowerCase()}`, E.GRADES[r]), document.createTextNode(" " + E.CARD_IDS.filter(id => E.CARDS[id].rarity === r).map(id => `${E.CARDS[id].name}${cards().units[id] ? " ✓" : ""}`).join(" · ")));
      list.append(line);
    }
    panel.append(el("h3", "shop-heading", "การ์ดที่สุ่มได้ (✓ = มีแล้ว)"), list);
  }

  // ---- Item pulls ----
  const itemPity = () => Math.max(0, Math.floor(Number(save().itemPity) || 0));
  function itemBanner() {
    const g = E.ITEM_GACHA, have = save().gems || 0, c = cards();
    const box = el("section", "pull-banner item-banner");
    const icons = el("div", "item-banner-icons");
    // all eight pieces, in the rarer frames
    for (const [n, r] of [[0, 5], [6, 4], [4, 5], [5, 3], [1, 4], [2, 5], [7, 3], [3, 4]]) {
      const icon = el("span", `gear-icon t${r}`), img = el("img");
      img.src = gearArt(n); img.alt = "";
      icon.append(img);
      icons.append(icon);
    }
    box.append(el("p", "news-eyebrow", "🎁 สุ่มไอเทม"), el("h3", null, "อุปกรณ์ค่าสุ่ม 8 ชนิด 5 ระดับ ใส่ให้การ์ดใบไหนก็ได้"), icons);
    const left = el("p", "pull-pity");
    left.append(el("b", "item-legend", "ตำนาน"), ` อีก ${g.pity - itemPity()} ครั้ง การันตีได้แน่นอน`);
    const odds = el("p", "pull-odds", `อัตรา: ${E.ITEM_RARITY.map((t, n) => `${t.name} ${Math.round(g.rates[n] * 1000) / 10}%`).reverse().join(" · ")} · สุ่ม 10 ครั้งได้หายากขึ้นไปอย่างน้อย 1 ชิ้น · ค่าหลักและค่ารองสุ่มทุกชิ้น ยิ่งหายากยิ่งได้ค่ารองมาก (ตำนาน 4 ค่า)`);
    const actions = el("div", "title-actions sheet-actions pull-actions");
    const one = button("primary-button", `สุ่ม 1 ครั้ง · 💎 ${g.one}`, () => doItemPull(1));
    const ten = button("primary-button pull-ten", `สุ่ม 10 ครั้ง · 💎 ${g.ten}`, () => doItemPull(10));
    one.disabled = have < g.one; ten.disabled = have < g.ten;
    actions.append(one, ten);
    const room = E.BAG_SIZE - (c.items || []).length;
    box.append(left, odds, actions, el("p", "sheet-goals", `กระเป๋า ${(c.items || []).length}/${E.BAG_SIZE}${room < 10 ? ` · เหลือที่ ${room} ชิ้น ของที่เกินจะย่อยเป็นแร่` : ""} · ใส่ไอเทมได้ที่หน้าการ์ด แตะช่องอุปกรณ์`));
    return box;
  }
  function doItemPull(count) {
    const g = E.ITEM_GACHA, cost = count >= 10 ? g.ten : g.one, c = cards();
    if ((save().gems || 0) < cost) { tone(150, .12, "square", .05); return; }
    save().gems -= cost;
    const state = { pity: itemPity() };
    const got = E.pullItems(state, Math.random, count);
    save().itemPity = state.pity;
    c.items = c.items || [];
    let ore = 0;
    const kept = got.map(item => {
      const full = c.items.length >= E.BAG_SIZE;
      const one = { i: newItemId(), ...item, o: "" };
      if (full) ore += E.SALVAGE_ORE[item.r - 1]; else c.items.push(one);
      return { item: one, full };
    });
    c.ore += ore;
    store(); showCoins();
    revealItems(kept, count, ore);
  }
  // items turn over one after another, the rare ones with more light
  function revealItems(results, count, ore) {
    const grid = el("div", `pull-reveal${results.length > 1 ? " is-ten" : ""}`);
    results.forEach(({ item, full }, n) => {
      const slot = el("div", `pull-card item-pull t${item.r}`);
      slot.style.animationDelay = `${n * 160}ms`;
      const icon = el("span", `gear-icon t${item.r}`), img = el("img");
      img.src = gearArt(item.s); img.alt = "";
      icon.append(img);
      const parts = E.itemParts(item);
      slot.append(icon, el("b", null, itemName(item)), el("small", "item-pull-main", parts.main.map(([stat, v]) => statText(stat, v)).join(" · ")));
      if (parts.extras.length) slot.append(el("small", "item-pull-extra", parts.extras.map(([stat, v]) => statText(stat, v)).join(" · ")));
      if (full) slot.append(el("small", "pull-dupe", `กระเป๋าเต็ม → ⛏ ${E.SALVAGE_ORE[item.r - 1]}`));
      grid.append(slot);
      const notes = item.r === 5 ? [784, 988, 1175, 1568, 1976] : item.r === 4 ? [784, 988, 1175, 1568] : item.r >= 3 ? [659, 880] : [523];
      setTimeout(() => notes.forEach((note, i) => tone(note, .1, "triangle", .05, i * .06)), n * 160 + 380);
    });
    const g = E.ITEM_GACHA;
    const again = el("div", "title-actions sheet-actions");
    const more = button("primary-button", count > 1 ? `สุ่มอีก 10 · 💎 ${g.ten}` : `สุ่มอีก · 💎 ${g.one}`, () => doItemPull(count));
    more.disabled = (save().gems || 0) < (count > 1 ? g.ten : g.one);
    again.append(more, button("secondary-button", "ไปใส่ไอเทม", () => { tab = "team"; closeSheet(); }));
    const best = results.reduce((top, r) => Math.max(top, r.item.r), 1);
    openSheet([el("h3", "sheet-title", "ผลการสุ่มไอเทม"), grid, el("p", "sheet-sub", `${best >= 4 ? `ได้ของ${E.ITEM_RARITY[best - 1].name}! · ` : ""}ตำนานอีก ${g.pity - itemPity()} ครั้งการันตี${ore ? ` · กระเป๋าเต็ม ย่อยเป็น ⛏ ${ore}` : ""}`), again]);
    announce(`ผลการสุ่มไอเทม: ${results.map(r => itemName(r.item)).join(", ")}`);
  }

  function doPull(count) {
    const g = E.GACHA, cost = count >= 10 ? g.ten : g.one;
    if ((save().gems || 0) < cost) { tone(150, .12, "square", .05); return; }
    save().gems -= cost;
    questTick("pull", count);
    const state = { pity: pity(), pity6: pity6() };
    const got = E.pull(state, Math.random, count);
    save().cardPity = state.pity;
    save().cardPity6 = state.pity6;
    const c = cards();
    const results = got.map(id => {
      if (!c.units[id]) {
        c.units[id] = 1;
        if (save().shop && !save().shop.owned.includes(id)) save().shop.owned.push(id);
        return { id, fresh: true };
      }
      const shards = E.DUPE_SHARDS[E.CARDS[id].rarity], wings = E.DUPE_WINGS[E.CARDS[id].rarity] || 0;
      c.shards[id] = (c.shards[id] || 0) + shards;
      c.wings += wings;
      return { id, fresh: false, shards, wings };
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
      front.append(cardTile(r.id, null), el("small", r.fresh ? "pull-new" : "pull-dupe", r.fresh ? "ใหม่!" : `ซ้ำ → เศษ +${r.shards}${r.wings ? ` 🪽+${r.wings}` : ""}`));
      slot.append(el("div", "pull-back", "✦"), front);
      grid.append(slot);
      const best = def.rarity === 6 ? [784, 988, 1175, 1568, 1976] : def.rarity === 5 ? [784, 988, 1175, 1568] : def.rarity >= 3 ? [659, 880] : [523];
      setTimeout(() => best.forEach((note, i) => tone(note, .1, "triangle", .05, i * .06)), n * 180 + 380);
    });
    const fresh = results.filter(r => r.fresh).map(r => E.CARDS[r.id].name);
    const again = el("div", "title-actions sheet-actions");
    const g = E.GACHA;
    const more = button("primary-button", results.length > 1 ? `สุ่มอีก 10 · 💎 ${g.ten}` : `สุ่มอีก · 💎 ${g.one}`, () => doPull(results.length));
    more.disabled = (save().gems || 0) < (results.length > 1 ? g.ten : g.one);
    again.append(more, button("secondary-button", "ดูการ์ด", () => { tab = "team"; closeSheet(); }));
    openSheet([el("h3", "sheet-title", "ผลการสุ่ม"), grid, el("p", "sheet-sub", fresh.length ? `ได้ใหม่: ${fresh.join(" · ")}` : "ไม่มีการ์ดใหม่รอบนี้ การ์ดซ้ำเปลี่ยนเป็นเศษไว้อัปดาวแล้ว"), again]);
    announce(`ผลการสุ่ม: ${results.map(r => `${E.CARDS[r.id].name} ระดับ ${gradeOf(r.id)}${r.fresh ? " ใหม่" : " ซ้ำ"}`).join(", ")}`);
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
    panel.append(el("p", "cards-intro", `รับรางวัลได้ด่านละ 1 ครั้งต่อวัน · แพ้แล้วลองใหม่ได้ · รีเซ็ตใน ${untilMidnight()}`), setStrip(() => showHub(), true));
    const grid = el("div", "dungeon-grid");
    for (const kind of ["exp", "coin"]) {
      const d = E.DUNGEONS[kind], stage = E.dungeon(kind, bestStage()), done = doneToday(kind);
      const box = el("section", `dungeon-box is-${kind}${done ? " is-done" : ""}`);
      box.append(el("span", "dungeon-icon", d.icon), el("h3", null, d.name), el("p", "sheet-text", d.text));
      const foes = el("div", "sheet-foes");
      for (const id of [...new Set(stage.waves.flat().map(f => f.id))]) { const fig = el("figure", `sheet-foe${E.FOES[id].boss ? " is-boss" : ""}`); fig.append(foeArt(id), el("figcaption", null, E.FOES[id].name)); foes.append(fig); }
      box.append(foes, el("p", "sheet-sub", `มอนสเตอร์ Lv ${stage.lv} · 3 คลื่น`), el("p", "sheet-reward", kind === "exp" ? `รางวัล: EXP ${fmt(stage.xp)} ต่อการ์ด + ● ${fmt(stage.coins)} + 💎 ${stage.gems} + 🪽 ${stage.wings}` : `รางวัล: ● ${fmt(stage.coins)} + EXP ${fmt(stage.xp)} ต่อการ์ด + 💎 ${stage.gems} + 🪽 ${stage.wings}`));
      const go = button(done ? "secondary-button" : "primary-button", done ? `ผ่านแล้ววันนี้ ✓ · มาใหม่ใน ${untilMidnight()}` : "เข้าด่าน ⚔", () => startBattle(stage));
      go.disabled = done;
      const actions = el("div", "title-actions sheet-actions");
      actions.append(go);
      box.append(actions);
      grid.append(box);
    }
    grid.append(raidBox());
    panel.append(grid);
  }

  // ---- The dragon raid ----
  // Any number of runs; a day pays for its best: a run scoring more than
  // the day's best so far pays the difference in coins.
  const raidToday = () => {
    const c = cards();
    if (c.raid?.day !== today()) c.raid = { day: today(), best: 0, paid: 0, top: c.raid?.top || 0 };
    return c.raid;
  };
  // coins for 1,000 points, shown with a decimal when small
  const perThousand = (stage) => { const v = stage.rate * 1000; return v < 10 ? v.toFixed(1) : fmt(v); };
  function raidBox() {
    const on = E.halloweenOn(today());
    const stage = E.raid(bestStage(), { pumpkin: on }), r = raidToday(), dragon = stage.waves[0][0].id;
    const box = el("section", `dungeon-box is-raid${on ? " is-pumpkin" : ""}`);
    box.append(el("span", "dungeon-icon", on ? "🎃" : "🐉"), el("h3", null, stage.name), el("p", "sheet-text", `ตี${E.FOES[dragon].name}ให้ได้มากที่สุดใน ${stage.time} วินาที ทุกความเสียหายคือคะแนน ได้ทองตามคะแนน มังกรล้มแล้วจะฟื้นขึ้นมาแกร่งกว่าเดิม`));
    const foes = el("div", "sheet-foes");
    const fig = el("figure", "sheet-foe is-boss");
    fig.append(foeArt(dragon), el("figcaption", null, E.FOES[dragon].name));
    foes.append(fig);
    box.append(foes, el("p", "sheet-sub", `มังกร Lv ${stage.lv} · ⏱ ${stage.time} วินาที · ทุก 1,000 คะแนน = ● ${perThousand(stage)}`));
    if (on) box.append(el("p", "raid-candy-note", `🎃 ช่วงฮาโลวีน: ได้ลูกอม 🍬 ${E.HALLOWEEN.raidPerPhase} ต่อระยะที่ตีได้ (คิดรอบดีที่สุดของวัน)`));
    box.append(el("p", "sheet-reward", r.best ? `วันนี้: คะแนนสูงสุด ${fmt(r.best)} · ได้ทองแล้ว ● ${fmt(r.paid)}` : "วันนี้ยังไม่ได้ตีมังกร"));
    if (r.top) box.append(el("p", "sheet-sub", `🏆 สถิติสูงสุด ${fmt(r.top)} คะแนน`));
    box.append(el("p", "raid-note", "ตีได้ไม่จำกัดรอบ · ทองต่อวันคิดจากรอบที่ได้คะแนนสูงสุด ตีใหม่ได้คะแนนมากกว่าเดิมรับส่วนต่างเพิ่ม"));
    const ranking = el("div", "raid-ranking");
    box.append(ranking);
    drawRanking(ranking);
    const actions = el("div", "title-actions sheet-actions");
    actions.append(button("primary-button raid-go", r.best ? "ตีมังกรอีกรอบ ⚔" : "ตีมังกร ⚔", () => goRaid()));
    box.append(actions);
    return box;
  }

  // ---- The weekly ranking (server: server/src/raid.js) ----
  // Signed in, a run is ranked: the server deals its seed and team (as last
  // synced), the page plays it and sends its turns back, and the server
  // replays them for the score. Without an account, or when the server
  // can't be reached, the run is the page's own and still pays coins.
  const account = () => window.PupaAccount;
  const signedIn = () => Boolean(account()?.state?.user);
  const RANK_FRESH_MS = 30000;
  let ranking = null, rankingAt = 0, rankingLoad = null;
  const RAID_WHY = { too_many_runs: "วันนี้ตีจัดอันดับครบ 40 รอบแล้ว", no_team: "ทีมยังไม่ได้บันทึกขึ้นคลาวด์", timeout: "เซิร์ฟเวอร์ตอบช้า", old_rules: "ต้องอัปเดตเกมก่อน (รีเฟรชหน้า)" };
  const THAI_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const thaiDay = (ymd, add = 0) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + add); return `${d.getUTCDate()} ${THAI_MONTHS[d.getUTCMonth()]}`; };
  function timeLeft(ms) {
    const mins = Math.max(0, Math.ceil(ms / 60000)), days = Math.floor(mins / 1440), hours = Math.floor(mins % 1440 / 60);
    return days ? `${days} วัน ${hours} ชม.` : `${hours} ชม. ${mins % 60} นาที`;
  }
  function loadRanking(force = false) {
    if (!signedIn()) return Promise.resolve(null);
    if (!force && ranking && Date.now() - rankingAt < RANK_FRESH_MS) return Promise.resolve(ranking);
    rankingLoad = rankingLoad || account().raidBoard().then(out => {
      ranking = out; rankingAt = Date.now();
      // last week's place paid on the server: show it and bring the gems down
      if (out.reward) { rewardSheet(out.reward); account().sync(); }
      return out;
    }).finally(() => { rankingLoad = null; });
    return rankingLoad;
  }
  function drawRanking(node) {
    node.replaceChildren(el("b", "raid-ranking-title", "🏆 อันดับตีมังกรประจำสัปดาห์"));
    if (!account()?.state?.available) { node.append(el("p", "raid-ranking-line", "การจัดอันดับใช้ได้เมื่อเชื่อมต่อเซิร์ฟเวอร์")); return; }
    if (!signedIn()) {
      node.append(el("p", "raid-ranking-line", "เข้าสู่ระบบเพื่อร่วมจัดอันดับ ชิงเพชรสูงสุด 💎 3,000 ทุกสัปดาห์"));
      node.append(button("secondary-button raid-signin", "เข้าสู่ระบบด้วย Google", () => account().signIn()));
      return;
    }
    const fill = (out) => {
      node.replaceChildren(el("b", "raid-ranking-title", `🏆 อันดับประจำสัปดาห์ · ปิดใน ${timeLeft(out.endsAt - Date.now())}`));
      node.append(el("p", "raid-ranking-line", out.me ? `คุณ: อันดับ #${out.me.rank} · ${fmt(out.me.score)} คะแนน` : "สัปดาห์นี้คุณยังไม่มีคะแนน ตีมังกรเพื่อขึ้นอันดับ"));
      const list = el("ol", "raid-top");
      for (const p of out.top.slice(0, 3)) {
        const li = el("li", p.me ? "is-me" : null);
        li.append(el("span", "raid-top-rank", `#${p.rank}`), el("span", "raid-top-name", p.name), el("b", null, fmt(p.score)));
        list.append(li);
      }
      if (out.top.length) node.append(list);
      node.append(button("secondary-button raid-board-open", "ดูอันดับทั้งหมด ›", () => rankingSheet(out)));
    };
    if (ranking) fill(ranking);
    else node.append(el("p", "raid-ranking-line", "กำลังโหลดอันดับ…"));
    loadRanking().then(out => { if (out && node.isConnected) fill(out); }).catch(() => { if (node.isConnected && !ranking) node.replaceChildren(el("b", "raid-ranking-title", "🏆 อันดับตีมังกรประจำสัปดาห์"), el("p", "raid-ranking-line", "โหลดอันดับไม่ได้ ลองใหม่ภายหลัง")); });
  }
  function rankingSheet(out) {
    const parts = [el("h3", "sheet-title", "🏆 อันดับตีมังกรประจำสัปดาห์"), el("p", "sheet-sub", `${thaiDay(out.week)} – ${thaiDay(out.week, 6)} · ปิดใน ${timeLeft(out.endsAt - Date.now())}`)];
    const list = el("ol", "raid-board");
    for (const p of out.top) {
      const li = el("li", p.me ? "is-me" : null);
      li.append(el("span", "raid-top-rank", `#${p.rank}`), el("span", "raid-top-name", p.name), el("small", null, `ระยะ ${p.phase}`), el("b", null, fmt(p.score)));
      list.append(li);
    }
    if (!out.top.length) list.append(el("li", "raid-board-empty", "ยังไม่มีใครตีมังกรสัปดาห์นี้ เป็นคนแรกเลย!"));
    if (out.me && !out.top.some(p => p.me)) {
      const li = el("li", "is-me");
      li.append(el("span", "raid-top-rank", `#${out.me.rank}`), el("span", "raid-top-name", "คุณ"), el("small", null, `ระยะ ${out.me.phase}`), el("b", null, fmt(out.me.score)));
      list.append(li);
    }
    parts.push(list);
    const prizes = el("ul", "raid-prizes");
    let from = 1;
    for (const p of out.prizes) {
      prizes.append(el("li", null, `${p.upTo == null ? "ร่วมตี" : from === p.upTo ? `อันดับ ${from}` : `อันดับ ${from}–${p.upTo}`} · 💎 ${fmt(p.gems)}`));
      from = (p.upTo || 0) + 1;
    }
    parts.push(el("b", "raid-prizes-title", "รางวัลเมื่อจบสัปดาห์"), prizes);
    parts.push(el("p", "raid-note", `คิดคะแนนสูงสุดของสัปดาห์ (จันทร์–อาทิตย์ เวลาไทย) เซิร์ฟเวอร์เล่นรอบซ้ำเพื่อตรวจคะแนนทุกรอบ · รางวัลเข้าเมื่อเปิดหน้านี้ในสัปดาห์ถัดไป · ตีจัดอันดับได้วันละ 40 รอบ (เหลือวันนี้ ${out.runsLeft})`));
    openSheet(parts);
  }
  function rewardSheet(reward) {
    openSheet([el("span", "moon-icon", "🏆"), el("h3", "sheet-title", "รางวัลอันดับตีมังกร"), el("p", "sheet-sub", `สัปดาห์ ${thaiDay(reward.week)} – ${thaiDay(reward.week, 6)}`), el("p", "raid-total", `อันดับ #${reward.rank}`), el("p", "sheet-reward", `${fmt(reward.score)} คะแนน · ได้รับ 💎 ${fmt(reward.gems)}`)]);
    [523, 659, 784, 1047].forEach((note, n) => tone(note, .12, "triangle", .05, n * .1));
    announce(`รางวัลอันดับตีมังกร อันดับ ${reward.rank} ได้เพชร ${reward.gems}`);
  }
  // The raid box's button: a ranked run when signed in, else the page's own.
  async function goRaid() {
    const local = (why = "") => { startBattle(E.raid(bestStage(), { pumpkin: E.halloweenOn(today()) })); if (battle?.raid) battle.raid.why = why; };
    if (!signedIn()) { local(); return; }
    const go = body.querySelector(".raid-go");
    if (go) { go.disabled = true; go.textContent = "กำลังเตรียมรอบจัดอันดับ…"; }
    let run = null, why = "";
    try {
      // the server fields the team as last synced: sync first (a sleeping
      // server can be slow to wake; the run is then dealt from the last sync)
      await Promise.race([account().sync(), wait(8000)]);
      run = await account().raidStart();
    } catch (error) {
      why = RAID_WHY[error.code] || "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้";
    }
    // (gone elsewhere meanwhile: no run)
    if (!isShown || battle || tab !== "daily") return;
    // a server on other rules than this page would not score the run the same
    if (run && run.rules !== E.RAID_RULES) { run = null; why = RAID_WHY.old_rules; }
    if (run) startBattle(E.raid(run.best, { pumpkin: run.pumpkin }), run);
    else local(why);
  }

  function finishRaid(v) {
    const r = raidToday(), stage = v.stage, b = v.state;
    const score = Math.round(v.raid.score), coins = E.raidCoins(stage, score);
    const pay = Math.max(0, coins - r.paid);
    const record = score > r.top;
    r.best = Math.max(r.best, score);
    r.paid += pay;
    r.top = Math.max(r.top, score);
    // Halloween: the pumpkin dragon pays candy too, by the day's best run
    let candy = 0;
    if (stage.pumpkin && E.halloweenOn(today())) {
      const ev = eventToday();
      candy = Math.max(0, E.raidCandy(stage, score) - ev.raid);
      ev.raid += candy;
      ev.earned += candy;
    }
    questTick("dungeon");
    save().coins += pay;
    store(); showCoins();
    v.busy = true;
    const box = el("div", "message-card battle-card raid-card");
    const why = v.raid.quit ? "จบรอบ" : b.result === "lost" ? "ทีมล้มหมด!" : "หมดเวลา!";
    box.append(el("span", "moon-icon", stage.pumpkin ? "🎃" : "🐉"), el("h2", null, why));
    const total = el("p", "raid-total");
    total.append(el("small", null, "คะแนน"), el("b", null, fmt(score)));
    box.append(total, el("p", null, `มังกรระยะที่ ${b.raid.phase} · ${b.turn} เทิร์น`));
    box.append(el("p", "end-reward battle-reward", pay ? `ได้รับ ● ${fmt(pay)}${pay < coins ? ` (คะแนนรอบนี้ = ● ${fmt(coins)} รับส่วนต่างจากรอบก่อนวันนี้)` : ""}` : coins ? `รอบนี้ = ● ${fmt(coins)} ไม่เกินรอบที่ดีที่สุดวันนี้ (● ${fmt(r.paid)}) จึงไม่ได้ทองเพิ่ม` : "ยังไม่มีคะแนน ลองใหม่ได้เลย"));
    if (candy) box.append(el("p", "event-candy", `🎃 ได้ลูกอม 🍬 +${candy}`));
    box.append(el("p", null, record ? "🏆 สถิติใหม่!" : `วันนี้สูงสุด ${fmt(r.best)} · สถิติ ${fmt(r.top)}`));
    // the ranking: a ranked run's turns go to the server for its score
    const ranked = v.raid.ranked;
    const rankLine = el("p", "raid-rank-line", ranked ? "🏆 กำลังส่งคะแนนจัดอันดับ…" : v.raid.why ? `รอบนี้ไม่ได้จัดอันดับ · ${v.raid.why}` : signedIn() ? "" : "เข้าสู่ระบบเพื่อร่วมจัดอันดับประจำสัปดาห์");
    if (rankLine.textContent) box.append(rankLine);
    if (ranked) {
      account().raidFinish({ runId: ranked.runId, turns: v.raid.turns, shown: v.raid.shown }).then(out => {
        rankingAt = 0;
        rankLine.textContent = `🏆 คะแนนจัดอันดับ ${fmt(out.score)} · อันดับ #${out.rank} สัปดาห์นี้${out.best > out.score ? ` (ดีที่สุด ${fmt(out.best)})` : ""}`;
        announce(`อันดับ ${out.rank} สัปดาห์นี้`);
      }).catch(error => { rankLine.textContent = `ส่งคะแนนจัดอันดับไม่สำเร็จ${RAID_WHY[error.code] ? ` · ${RAID_WHY[error.code]}` : ""}`; });
    }
    const actions = el("div", "title-actions");
    actions.append(button("primary-button", "ตีอีกรอบ", () => { battle = null; tab = "daily"; showHub(); goRaid(); }));
    actions.append(button("secondary-button", "กลับ", () => { battle = null; tab = "daily"; showHub(); }));
    box.append(actions);
    v.result.replaceChildren(box);
    v.result.hidden = false;
    freshen(v.result);
    hint("");
    if (pay) [523, 659, 784, 1047].forEach((note, n) => tone(note, .12, "triangle", .05, n * .1));
    announce(`ได้ ${fmt(score)} คะแนน${pay ? ` ได้รับ ${fmt(pay)} เหรียญ` : ""}`);
    actions.querySelector("button")?.focus();
  }

  // ---- Halloween (E.HALLOWEEN) ----
  // cards.event: candy earned, what the shop took, and today's candy from
  // battles, today's gift and today's raid candy (reset each day).
  const eventToday = () => {
    const c = cards();
    if (c.event?.id !== E.HALLOWEEN.id) c.event = { id: E.HALLOWEEN.id, earned: 0, bought: {}, day: today(), battle: 0, gift: false, raid: 0 };
    if (c.event.day !== today()) Object.assign(c.event, { day: today(), battle: 0, gift: false, raid: 0 });
    return c.event;
  };
  const featured = () => E.CARDS[E.HALLOWEEN.card];
  // what each offer is called, and its picture or icon
  function offerLook(item) {
    const g = item.give, name = featured().name;
    if (g.card) return { icon: portrait(E.HALLOWEEN.card), name: cards().units[g.card] ? `การ์ด${name} (มีแล้ว: ได้เศษ ×30)` : `การ์ด${name} · SSS` };
    if (g.shards) return { icon: portrait(E.HALLOWEEN.card), name: `เศษการ์ด${name} ×${g.shards}` };
    if (g.item) return { icon: "🎁", name: "กล่องไอเทมมหากาพย์ขึ้นไป" };
    if (g.wings) return { icon: "🪽", name: `ปีกอัพดาว ×${g.wings}` };
    if (g.gems) return { icon: "💎", name: `เพชร ${fmt(g.gems)}` };
    if (g.dust) return { icon: "✧", name: `ผลึกดาว ×${g.dust}` };
    if (g.coins) return { icon: "●", name: `เหรียญ ${fmt(g.coins)}` };
    return { icon: "⛏", name: `แร่ ×${g.ore}` };
  }
  // The strip across the hub while the event (or its shop) is on.
  function eventBanner() {
    if (!E.halloweenShopOpen(today())) return null;
    const H = E.HALLOWEEN, ev = eventToday(), on = E.halloweenOn(today());
    const box = button("event-banner", null, () => eventSheet(), "เปิดเทศกาลฮาโลวีน");
    const art = el("span", "event-art");
    art.append(foeArt("pumpkindragon"));
    const text = el("span", "event-text");
    text.append(el("b", null, "🎃 เทศกาลฮาโลวีน"), el("small", null, on ? `ชนะการต่อสู้ได้ลูกอม · ถึง ${thaiDay(H.to)}` : `แลกของได้ถึง ${thaiDay(H.shop)}`));
    box.append(art, text, el("span", "event-candy-count", `🍬 ${fmt(E.candyLeft(ev))}`), el("span", "event-go", on && !ev.gift ? "รับลูกอม!" : "แลกของ ›"));
    if (on && !ev.gift) box.classList.add("has-gift");
    return box;
  }
  // note: what was just bought, shown at the top
  function eventSheet(note = "") {
    const H = E.HALLOWEEN, ev = eventToday(), on = E.halloweenOn(today()), left = E.candyLeft(ev);
    const parts = [el("h3", "sheet-title", "🎃 เทศกาลฮาโลวีน"), el("p", "sheet-sub", `${thaiDay(H.from)} – ${thaiDay(H.to)} · แลกของได้ถึง ${thaiDay(H.shop)}`)];
    if (note) parts.push(el("p", "event-got", note));
    const total = el("p", "raid-total");
    total.append(el("small", null, "ลูกอมที่มี"), el("b", null, `🍬 ${fmt(left)}`));
    parts.push(total);
    const how = el("ul", "event-how");
    how.append(
      el("li", null, `ชนะการต่อสู้ในศึกการ์ด (ด่าน หอคอย ลานประลอง ด่านประจำวัน) ได้ 🍬 ${H.win} · บอส 🍬 ${H.boss} · วันละไม่เกิน ${H.dayCap} (วันนี้ ${ev.battle}/${H.dayCap})`),
      el("li", null, `ตีมังกรฟักทองในด่านประจำวัน ได้ 🍬 ${H.raidPerPhase} ต่อระยะที่ตีได้ คิดจากรอบที่ดีที่สุดของวัน (วันนี้ได้แล้ว ${ev.raid})`),
      el("li", null, `ลูกอมประจำวัน 🍬 ${H.gift} กดรับได้วันละครั้ง`)
    );
    parts.push(how);
    const gift = button("primary-button", ev.gift ? "รับลูกอมวันนี้แล้ว ✓" : `รับลูกอมวันนี้ 🍬 ${H.gift}`, () => {
      const e = eventToday();
      if (e.gift || !E.halloweenOn(today())) return;
      e.gift = true;
      e.earned += H.gift;
      store();
      [659, 784, 988].forEach((note, n) => tone(note, .1, "triangle", .05, n * .08));
      announce(`ได้ลูกอม ${H.gift}`);
      // (the hub redraws its strip; the sheet goes first, showHub keeps no sheet)
      closeSheet(true);
      showHub();
      eventSheet();
    });
    gift.disabled = ev.gift || !on;
    const actions = el("div", "title-actions sheet-actions");
    actions.append(gift);
    parts.push(actions, el("b", "event-shop-title", "ร้านแลกของ"));
    const shop = el("div", "event-shop");
    for (const item of E.HALLOWEEN_SHOP) {
      const look = offerLook(item), have = ev.bought[item.key] || 0;
      const row = el("div", `event-offer${item.key === "card" ? " is-featured" : ""}`);
      const icon = el("span", "event-offer-icon");
      if (typeof look.icon === "string") icon.textContent = look.icon; else icon.append(look.icon);
      const words = el("span", "event-offer-text");
      words.append(el("b", null, look.name), el("small", null, `แลกได้อีก ${item.limit - have}/${item.limit}`));
      const buy = button("shop-buy", `🍬 ${fmt(item.price)}`, () => buyEvent(item), `แลก ${look.name} ด้วยลูกอม ${item.price}`);
      buy.disabled = have >= item.limit || left < item.price || !E.halloweenShopOpen(today());
      row.append(icon, words, buy);
      shop.append(row);
    }
    parts.push(shop);
    openSheet(parts);
  }
  function buyEvent(item) {
    const ev = eventToday(), c = cards(), g = item.give, name = featured().name;
    if (!E.halloweenShopOpen(today()) || (ev.bought[item.key] || 0) >= item.limit || E.candyLeft(ev) < item.price) return;
    ev.bought[item.key] = (ev.bought[item.key] || 0) + 1;
    let got = offerLook(item).name;
    if (g.card) {
      if (c.units[g.card]) { c.shards[g.card] = (c.shards[g.card] || 0) + 30; got = `เศษการ์ด${name} ×30`; }
      else {
        c.units[g.card] = 1;
        if (save().shop && !save().shop.owned.includes(g.card)) save().shop.owned.push(g.card);
        got = `การ์ด${name} (SSS)`;
      }
    } else if (g.shards) c.shards[E.HALLOWEEN.card] = (c.shards[E.HALLOWEEN.card] || 0) + g.shards;
    else if (g.item) {
      const loot = grantLoot(1, 2, g.item);
      got = loot.items.length ? `ไอเทม${E.ITEM_RARITY[loot.items[0].r - 1].name} (${E.GEAR_SLOTS[loot.items[0].s].name})` : `กระเป๋าเต็ม: ได้แร่ ⛏ ${loot.ore}`;
    } else if (g.wings) c.wings += g.wings;
    else if (g.gems) addGems(g.gems);
    else if (g.dust) c.dust += g.dust;
    else if (g.coins) save().coins += g.coins;
    else if (g.ore) c.ore += g.ore;
    store(); showCoins();
    [523, 659, 784, 1047].forEach((note, n) => tone(note, .1, "triangle", .05, n * .07));
    announce(`แลกได้ ${got}`);
    closeSheet(true);
    showHub();
    eventSheet(`🎃 แลกได้ ${got}`);
  }
  // Halloween: a battle won drops candy (the raid pays its own); returns
  // the line for its result card, or "".
  function treat(v) {
    const H = E.HALLOWEEN;
    if (v.stage.raid || v.state.result !== "won" || !E.halloweenOn(today())) return "";
    const ev = eventToday(), n = Math.min(E.winCandy(v.stage), Math.max(0, H.dayCap - ev.battle));
    if (!n) return `🎃 ลูกอมจากการต่อสู้วันนี้ครบ ${H.dayCap} แล้ว`;
    ev.battle += n;
    ev.earned += n;
    store();
    return `🎃 ได้ลูกอม 🍬 +${n} (วันนี้ ${ev.battle}/${H.dayCap})`;
  }

  // Over the field: the clock counting down, the score and its coins.
  function raidHud(v) {
    const r = v.raid;
    const hud = el("div", "raid-hud");
    hud.setAttribute("aria-hidden", "true");
    r.clock = el("b", "raid-clock");
    const bar = el("span", "raid-time");
    r.fill = el("i");
    bar.append(r.fill);
    r.points = el("span", "raid-points");
    r.coins = el("small", "raid-coins");
    hud.append(r.clock, bar, r.points, r.coins);
    r.hud = hud;
    drawRaid(v);
    return hud;
  }
  function drawRaid(v) {
    const r = v.raid, total = v.stage.time * 1000;
    if (!r?.hud) return;
    const left = r.end ? Math.max(0, r.end - performance.now()) : total;
    const sec = Math.ceil(left / 1000);
    r.clock.textContent = `⏱ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
    r.fill.style.width = `${left / total * 100}%`;
    r.points.textContent = `คะแนน ${fmt(r.score)}`;
    r.coins.textContent = `≈ ● ${fmt(E.raidCoins(v.stage, r.score))}`;
    r.hud.classList.toggle("is-low", r.end > 0 && sec <= 10);
    if (sec !== r.sec) {
      r.sec = sec;
      if (r.end && sec <= 5 && sec > 0) tone(880, .05, "square", .04);
      if (r.end && (sec === 30 || sec === 10)) announce(`เหลือ ${sec} วินาที`);
    }
  }
  // The clock starts after the opening call and runs in real time.
  function startRaidClock(v) {
    const r = v.raid;
    r.end = performance.now() + v.stage.time * 1000;
    const tick = () => {
      if (battle !== v || v.token.stopped || r.over) return;
      drawRaid(v);
      if (performance.now() < r.end) { r.timer = setTimeout(tick, 100); return; }
      endRaid(v);
    };
    tick();
  }
  const stopRaidClock = (v) => clearTimeout(v.raid.timer);
  // Time is up, or the player ended the run: a turn waiting on the player
  // gives way, and the battle stops at the next thing it would show.
  function endRaid(v) {
    const r = v.raid;
    if (r.over) return;
    r.over = true;
    stopRaidClock(v);
    if (v.go) { const go = v.go; v.go = null; go([]); }
  }
  function finishDungeon(v) {
    const b = v.state, stage = v.stage, c = cards(), won = b.result === "won";
    let loot = null;
    const xp = won ? stage.xp : E.stageXp({ num: 1 }, false);
    const ups = shareXp(c.team.filter(Boolean), xp);
    if (won) {
      if (c.dungeon.day !== today()) c.dungeon = { day: today(), exp: false, coin: false };
      c.dungeon[stage.dungeon] = true;
      questTick("dungeon"); questTick("win");
      save().coins += stage.coins;
      addGems(stage.gems);
      cards().dust += stage.dust || 0;
      cards().wings += stage.wings || 0;
      cards().ore += stage.ore || 0;
      loot = grantLoot(2, Math.min(2, bestStage() / 80));
    }
    store(); showCoins();
    v.busy = true;
    const box = el("div", "message-card battle-card");
    box.append(el("span", "moon-icon", won ? E.DUNGEONS[stage.dungeon].icon : "☾"), el("h2", null, won ? "ผ่านด่านประจำวัน!" : "พ่ายแพ้…"));
    box.append(el("p", "end-reward battle-reward", won ? `ได้รับ 💎 ${stage.gems} · ✧ ผลึกดาว ${stage.dust} · 🪽 ${stage.wings} · ⛏ แร่ ${stage.ore} · ● ${fmt(stage.coins)} · EXP ${fmt(xp)} ต่อการ์ด` : `ได้ EXP ${xp} ต่อการ์ด · ลองใหม่ได้วันนี้`));
    if (hasLoot(loot)) box.append(lootRow(loot));
    if (ups.length) box.append(el("p", "battle-ups", `เลเวลอัป! ${ups.join(" · ")}`));
    if (won) box.append(el("p", null, `ด่านนี้รับรางวัลได้อีกครั้งพรุ่งนี้ (อีก ${untilMidnight()})`));
    const actions = el("div", "title-actions");
    if (!won) actions.append(button("primary-button", "ลองอีกครั้ง", () => { battle = null; startBattle(stage); }));
    actions.append(button(won ? "primary-button" : "secondary-button", "กลับ", () => { battle = null; tab = "daily"; showHub(); }));
    box.append(actions);
    v.result.replaceChildren(box);
    v.result.hidden = false;
    freshen(v.result);
    hint("");
    if (won) [523, 659, 784, 1047].forEach((note, n) => tone(note, .12, "triangle", .05, n * .1));
    announce(won ? `ผ่าน${stage.name} ได้ ${stage.coins} เหรียญ และ EXP ${xp}` : "พ่ายแพ้ ลองใหม่ได้");
    actions.querySelector("button")?.focus();
  }

  // ---- Arena: ten against ten ----
  function renderArena(panel) {
    const c = cards(), tier = E.arenaTier(c.arena);
    const team = E.arenaTeam(c);
    const own = c.arenaPick.length > 0;
    panel.append(el("p", "cards-intro", `${own ? `ทีมที่จัดเอง ${team.length} ใบ` : `จัดอัตโนมัติ · การ์ดที่แรงที่สุด ${team.length} ใบ ตัวป้องกันยืนหน้า`} · สู้อัตโนมัติทั้งหมด · ชนะแล้วขึ้นชั้นต่อไป`));
    const box = el("section", "arena-box");
    box.append(el("h3", "sheet-title", `ชั้น ${tier.num}${tier.boss ? " · มีบอส" : ""}`), el("p", "sheet-sub", `มอนสเตอร์ 10 ตัว Lv ${tier.lv} · รางวัล 💎 ${tier.gems} · ● ${tier.coins} · EXP ${tier.xp} ต่อการ์ด`));
    const foes = el("div", "sheet-foes");
    for (const f of tier.waves[0]) { const fig = el("figure", `sheet-foe${E.FOES[f.id].boss ? " is-boss" : ""}`); fig.append(foeArt(f.id), el("figcaption", null, E.FOES[f.id].name)); foes.append(fig); }
    const mine = el("div", "arena-team");
    for (const t of team) mine.append(cardTile(t.id, () => cardSheet(t.id), t.row === "front" ? "is-front" : ""));
    const go = button("primary-button", "เริ่มประลอง ⚔", () => startBattle(tier));
    const edit = button("secondary-button", "จัดทีมประลอง ✎", () => arenaSheet());
    box.append(foes, el("p", "sheet-sub", `ทีมของคุณ ${team.length}/10 · พลังรวม ${fmt(E.teamPowerOf(team))}`), mine, el("div", "title-actions sheet-actions"));
    box.querySelector(".sheet-actions").append(edit, go);
    panel.append(box);
  }

  // Choose the arena ten: tap a card below to bring it in or send it out,
  // tap one in the team to move it between the front (up to 4) and back rows.
  function arenaSheet() {
    const c = cards();
    if (!c.arenaPick.length) {
      // start from what the automatic choice would field
      const auto = E.arenaTeam({ ...c, arenaPick: [] });
      c.arenaPick = auto.map(t => t.id);
      c.arenaFront = auto.filter(t => t.row === "front").map(t => t.id);
    }
    const save2 = () => { store(); arenaSheet(); };
    const rows = el("div", "arena-rows");
    for (const [label, front] of [["แถวหน้า", true], ["แถวหลัง", false]]) {
      const ids = c.arenaPick.filter(id => c.arenaFront.includes(id) === front);
      const row = el("div", "cards-row");
      row.append(el("b", "cards-row-label", front ? `${label} ${ids.length}/${E.ARENA_FRONT}` : `${label} ${ids.length}`));
      const grid = el("div", "arena-team");
      grid.dataset.drop = front ? "front" : "back";
      for (const id of ids) {
        const tile = cardTile(id, () => {
          if (front) c.arenaFront = c.arenaFront.filter(x => x !== id);
          else if (c.arenaFront.length < E.ARENA_FRONT) c.arenaFront.push(id);
          else { tone(150, .12, "square", .05); announce(`แถวหน้าเต็มแล้ว ${E.ARENA_FRONT} ใบ`); return; }
          tone(660, .06, "triangle", .04); save2();
        });
        tile.dataset.card = id; tile.dataset.drop = "card";
        grid.append(tile);
      }
      row.append(grid);
      rows.append(row);
    }
    const pool = el("div", "card-pool arena-pool");
    pool.dataset.drop = "out";
    const owned = Object.keys(c.units).filter(id => E.CARDS[id]).sort((a, b) => E.cardPower(c, b) - E.cardPower(c, a));
    for (const id of owned) {
      const inTeam = c.arenaPick.includes(id);
      const tile = cardTile(id, () => {
        if (inTeam) { c.arenaPick = c.arenaPick.filter(x => x !== id); c.arenaFront = c.arenaFront.filter(x => x !== id); }
        else if (c.arenaPick.length < E.ARENA_SIZE) c.arenaPick.push(id);
        else { tone(150, .12, "square", .05); announce(`ทีมประลองเต็ม ${E.ARENA_SIZE} ใบแล้ว แตะการ์ดในทีมเพื่อเอาออก`); return; }
        tone(587, .06, "triangle", .04); save2();
      }, inTeam ? "in-arena" : "");
      tile.dataset.card = id;
      pool.append(tile);
    }
    const actions = el("div", "title-actions sheet-actions");
    actions.append(
      button("secondary-button", "จัดอัตโนมัติ", () => { c.arenaPick = []; c.arenaFront = []; store(); tone(523, .06, "triangle", .04); announce("ใช้ทีมประลองอัตโนมัติ"); closeSheet(); }),
      button("primary-button", "เสร็จ ✓", () => closeSheet())
    );
    const power = E.teamPowerOf(c.arenaPick.map(powerEntry));
    openSheet([el("h3", "sheet-title", "จัดทีมประลอง"), el("p", "sheet-sub", `${c.arenaPick.length}/${E.ARENA_SIZE} ใบ · พลังรวม ${fmt(power)} · ลากการ์ดไปวางในแถวหรือทับการ์ดในทีมเพื่อใส่ แทนที่ หรือสลับ · ลากกลับลงด้านล่างเพื่อเอาออก (แตะก็ได้เหมือนเดิม)`), rows, el("h3", "shop-heading", "การ์ดทั้งหมด (✓ = อยู่ในทีม)"), pool, actions]);
    dragCards(sheet.querySelector(".cards-sheet-box"), (id, node, target) => arenaDrop(id, target));
  }
  // A card dropped in the arena team: on a team card it takes that card's
  // place (or the two trade places, rows too, when both are in the team);
  // on a row it joins that row; on the card list it leaves the team.
  function arenaDrop(id, target) {
    const c = cards(), pick = c.arenaPick, front = c.arenaFront, def = E.CARDS[id];
    const inTeam = pick.includes(id), isFront = front.includes(id), kind = target.dataset.drop;
    const no = (text) => { tone(150, .12, "square", .05); announce(text); };
    let said = "";
    if (kind === "card") {
      const other = target.dataset.card, otherFront = front.includes(other);
      if (other === id) return;
      if (inTeam) {
        const a = pick.indexOf(id), b = pick.indexOf(other);
        [pick[a], pick[b]] = [pick[b], pick[a]];
        if (isFront !== otherFront) c.arenaFront = front.map(x => x === id ? other : x === other ? id : x);
        said = `สลับ${def.name}กับ${E.CARDS[other].name}`;
      } else {
        pick[pick.indexOf(other)] = id;
        if (otherFront) c.arenaFront = front.map(x => x === other ? id : x);
        said = `ใส่${def.name}แทน${E.CARDS[other].name}`;
      }
    } else if (kind === "front" || kind === "back") {
      const toFront = kind === "front";
      if (inTeam && isFront === toFront) return;
      if (!inTeam && pick.length >= E.ARENA_SIZE) return no(`ทีมประลองเต็ม ${E.ARENA_SIZE} ใบแล้ว วางทับการ์ดในทีมเพื่อแทนที่`);
      if (toFront && front.length >= E.ARENA_FRONT) return no(`แถวหน้าเต็มแล้ว ${E.ARENA_FRONT} ใบ วางทับการ์ดแถวหน้าเพื่อสลับ`);
      if (!inTeam) pick.push(id);
      if (toFront) front.push(id); else c.arenaFront = front.filter(x => x !== id);
      said = `${def.name} ${toFront ? "ไปแถวหน้า" : "ไปแถวหลัง"}`;
    } else if (kind === "out") {
      if (!inTeam) return;
      c.arenaPick = pick.filter(x => x !== id); c.arenaFront = front.filter(x => x !== id);
      said = `เอา${def.name}ออกจากทีมประลอง`;
    } else return;
    store(); tone(660, .08, "triangle", .05); announce(said);
    arenaSheet();
  }

  // Pays every five-stage group that has just reached full stars; returns
  // the gems given. `show` opens a panel saying so.
  function showWingGift() {
    if (!wingGift) return false;
    const n = wingGift;
    wingGift = 0;
    store();
    [659, 880, 1175].forEach((note, i) => tone(note, .12, "triangle", .05, i * .08));
    announce(`ชดเชยปีกอัพดาว ${n} ชิ้น`);
    openSheet([el("h3", "sheet-title", "🪽 ชดเชยปีกอัพดาว"), el("p", "sheet-reward", `ได้รับ 🪽 ${fmt(n)}`), el("p", "sheet-sub", `จากด่านบอสและชั้นลานประลองที่ผ่านไปแล้วก่อนมีปีกอัพดาว (ด่านบอสละ 🪽 2 · ลานประลองทุก 5 ชั้น 🪽 2) ใช้อัปดาวแดงได้เลย`)]);
    return true;
  }
  function payStarBonus(show) {
    const c = cards(), due = E.dueStarBonus(c.stars, c.starPaid);
    if (!due.length) return 0;
    const gems = due.length * E.STAR_BONUS;
    c.starPaid = [...c.starPaid, ...due].sort((a, b) => a - b);
    addGems(gems);
    c.wings += due.length * E.STAR_WINGS;
    store(); showCoins();
    const ranges = due.map(n => `ด่าน ${(n - 1) * E.STAR_GROUP + 1}–${n * E.STAR_GROUP}`);
    announce(`ดาวครบ ${ranges.join(", ")} ได้รับ ${gems} เพชร`);
    [784, 988, 1175, 1568].forEach((note, i) => tone(note, .14, "triangle", .06, i * .09));
    if (show) openSheet([el("h3", "sheet-title", "🌟 โบนัสดาวครบ!"), el("p", "sheet-reward", `ได้รับ 💎 ${fmt(gems)} + 🪽 ${due.length * E.STAR_WINGS}`), el("p", "sheet-sub", `เก็บครบ 15 ดาวใน ${ranges.join(" · ")} · ทุก 5 ด่านที่ได้ดาวครบ รับ 💎 ${E.STAR_BONUS}`)]);
    return gems;
  }

  // ---- Quests ----
  // Daily quests (reset at midnight, a chest for finishing them all) and
  // achievements (milestones, each paid once). Both pay gems.
  function quest() { const c = cards(); c.quest = E.questFor(c.quest, today()); return c.quest; }
  function questTick(key, n = 1) { const q = quest(); q.counts[key] = (q.counts[key] || 0) + n; }
  const chestReady = () => { const q = quest(); return !q.claimed.includes("chest") && E.DAILY_QUESTS.every(d => q.claimed.includes(d.id)); };
  function questsReady() {
    const q = quest(), c = cards();
    return E.DAILY_QUESTS.some(d => E.questDone(q, d) && !q.claimed.includes(d.id)) || chestReady() || E.ACHIEVEMENTS.some(a => !c.achv.includes(a.id) && E.achvProgress(c, a)[2]);
  }
  // Pays one quest if it is ready; returns what it gave, or null.
  function payQuest(kind, id) {
    const c = cards(), q = quest();
    let gems = 0, wings = 0, text = "";
    if (kind === "daily") {
      const d = E.DAILY_QUESTS.find(x => x.id === id);
      if (!d || q.claimed.includes(id) || !E.questDone(q, d)) return null;
      q.claimed.push(id); gems = d.gems; text = d.text;
    } else if (kind === "chest") {
      if (!chestReady()) return null;
      q.claimed.push("chest"); gems = E.QUEST_CHEST.gems; wings = E.QUEST_CHEST.wings; text = "หีบเควสรายวัน";
    } else {
      const a = E.ACHIEVEMENTS.find(x => x.id === id);
      if (!a || c.achv.includes(id) || !E.achvProgress(c, a)[2]) return null;
      c.achv.push(id); gems = a.gems; text = a.text;
    }
    addGems(gems); c.wings += wings;
    return { gems, wings, text };
  }
  // Every quest ready now, the chest last since the others may open it.
  function claimAllQuests() {
    const got = [];
    for (const d of E.DAILY_QUESTS) got.push(payQuest("daily", d.id));
    got.push(payQuest("chest"));
    for (const a of E.ACHIEVEMENTS) got.push(payQuest("achv", a.id));
    const paid = got.filter(Boolean);
    if (!paid.length) { tone(150, .12, "square", .05); return; }
    const gems = paid.reduce((n, r) => n + r.gems, 0), wings = paid.reduce((n, r) => n + r.wings, 0);
    store(); showCoins();
    [659, 784, 988, 1319, 1568].forEach((note, i) => tone(note, .1, "triangle", .05, i * .07));
    announce(`รับรางวัลเควส ${paid.length} รายการ ได้ ${gems} เพชร${wings ? ` และปีก ${wings}` : ""}`);
    showHub();
    const list = el("ul", "end-goals");
    for (const r of paid) list.append(el("li", "is-done", `✓ ${r.text} · 💎 ${r.gems}${r.wings ? ` 🪽 ${r.wings}` : ""}`));
    openSheet([el("h3", "sheet-title", "📜 รับรางวัลเควสทั้งหมด"), el("p", "sheet-reward", `ได้รับ 💎 ${fmt(gems)}${wings ? ` + 🪽 ${wings}` : ""} จาก ${paid.length} เควส`), list]);
  }
  function claimQuest(kind, id) {
    const r = payQuest(kind, id);
    if (!r) return;
    const { gems, wings, text } = r;
    store(); showCoins();
    [659, 784, 988, 1319].forEach((note, i) => tone(note, .1, "triangle", .05, i * .07));
    announce(`รับรางวัลเควส ${text} ได้ ${gems} เพชร${wings ? ` และปีก ${wings}` : ""}`);
    showHub();
  }
  function questRow(text, have, need, reward, state, onClaim) {
    const row = el("div", `quest-row is-${state}`);
    const info = el("div", "quest-info");
    const bar = el("i", "quest-bar");
    bar.style.setProperty("--fill", `${Math.round(100 * Math.min(1, have / need))}%`);
    info.append(el("b", null, text), bar, el("small", null, `${fmt(Math.min(have, need))} / ${fmt(need)}`));
    const btn = button(state === "ready" ? "shop-buy quest-claim" : "shop-equip quest-claim", state === "done" ? "รับแล้ว ✓" : state === "ready" ? `รับ ${reward}` : reward, onClaim);
    btn.disabled = state !== "ready";
    row.append(info, btn);
    return row;
  }
  function renderQuests(panel) {
    const c = cards(), q = quest();
    // claim everything ready at once
    const ready = E.DAILY_QUESTS.filter(d => E.questDone(q, d) && !q.claimed.includes(d.id)).length + (!q.claimed.includes("chest") && E.DAILY_QUESTS.every(d => q.claimed.includes(d.id) || E.questDone(q, d)) ? 1 : 0) + E.ACHIEVEMENTS.filter(a => !c.achv.includes(a.id) && E.achvProgress(c, a)[2]).length;
    const all = el("div", "title-actions quest-all");
    const allBtn = button("primary-button", ready ? `รับทั้งหมด (${ready})` : "ยังไม่มีรางวัลให้รับ", () => claimAllQuests());
    allBtn.disabled = !ready;
    all.append(allBtn);
    panel.append(all);
    panel.append(el("h3", "shop-heading", "📜 เควสรายวัน"), el("p", "cards-intro", `ทำเควสรับเพชร · รีเซ็ตใน ${untilMidnight()} · ทำครบทุกข้อเปิดหีบ 💎 ${E.QUEST_CHEST.gems} + 🪽 ${E.QUEST_CHEST.wings}`));
    const daily = el("div", "quest-list");
    for (const d of E.DAILY_QUESTS) {
      const have = q.counts[d.key] || 0, state = q.claimed.includes(d.id) ? "done" : have >= d.need ? "ready" : "todo";
      daily.append(questRow(d.text, have, d.need, `💎 ${d.gems}`, state, () => claimQuest("daily", d.id)));
    }
    const doneCount = E.DAILY_QUESTS.filter(d => q.claimed.includes(d.id)).length;
    daily.append(questRow("🎁 หีบเควสรายวัน · ทำเควสวันนี้ครบทุกข้อ", doneCount, E.DAILY_QUESTS.length, `💎 ${E.QUEST_CHEST.gems} 🪽 ${E.QUEST_CHEST.wings}`, q.claimed.includes("chest") ? "done" : chestReady() ? "ready" : "todo", () => claimQuest("chest")));
    panel.append(daily);
    panel.append(el("h3", "shop-heading", "🏆 ภารกิจความสำเร็จ"), el("p", "cards-intro", "รับได้ครั้งเดียว ทำสำเร็จไปแล้วก่อนหน้านี้ก็กดรับได้เลย"));
    const order = { ready: 0, todo: 1, done: 2 };
    const rows = E.ACHIEVEMENTS.map(a => { const [have, need, ok] = E.achvProgress(c, a); return { a, have, need, state: c.achv.includes(a.id) ? "done" : ok ? "ready" : "todo" }; });
    // the next milestone of each kind, those ready, then those paid
    const kind = (a) => a.id.replace(/\d+$/, "");
    const shown = rows.filter(r => r.state !== "todo" || !rows.some(o => o.state === "todo" && kind(o.a) === kind(r.a) && o.need < r.need));
    shown.sort((x, y) => order[x.state] - order[y.state]);
    const list = el("div", "quest-list");
    for (const r of shown) list.append(questRow(r.a.text, r.have, r.need, `💎 ${r.a.gems}`, r.state, () => claimQuest("achv", r.a.id)));
    panel.append(list);
  }

  // ---- Stage map ----
  // Each chapter is a painted map (its battle backdrop, alive) with the ten
  // stages as points along a winding path; cleared paths glow, the team
  // stands on the next stage. Arrows turn to the other chapters.
  const MAP_PATH = [[7, 72], [17, 44], [28, 66], [38, 34], [48, 58], [58, 28], [67, 62], [77, 38], [86, 66], [94, 36]];
  let mapChapter = 0;        // the chapter on the map (0 = the next stage's)
  let mapShow = null;        // its backdrop
  const stopMap = () => { mapShow?.destroy(); mapShow = null; };
  const chapterOf = (num) => E.CHAPTERS.findIndex(ch => num >= ch.from && num <= ch.to) + 1;
  function renderStages(panel) {
    const next = E.STAGES.find(stage => isOpen(stage.num) && !isCleared(stage.num));
    const last = E.CHAPTERS.length;
    const nextChapter = next ? chapterOf(next.num) : last;
    if (!mapChapter) mapChapter = nextChapter;
    const chapter = E.CHAPTERS[mapChapter - 1];
    const list = E.STAGES.filter(s => s.num >= chapter.from && s.num <= chapter.to);
    const got = list.reduce((sum, s) => sum + (cards().stars[s.num] || 0), 0);
    const chapterOpen = isOpen(chapter.from);

    // chapter switcher
    const bar = el("div", "map-bar");
    const prev = button("map-turn", "◀", () => { mapChapter = Math.max(1, mapChapter - 1); showHub(); tone(523, .05, "triangle", .04); }, "บทก่อนหน้า");
    const fwd = button("map-turn", "▶", () => { mapChapter = Math.min(last, mapChapter + 1); showHub(); tone(587, .05, "triangle", .04); }, "บทถัดไป");
    prev.disabled = mapChapter <= 1; fwd.disabled = mapChapter >= last;
    const title = el("div", "map-title");
    title.append(el("b", null, chapter.name), el("span", null, `★ ${got}/${list.length * 3} · พลังทีม ${fmt(teamPower())}${next ? ` · ด่านถัดไป ${next.num}` : " · ผ่านครบทุกด่านแล้ว!"}`));
    bar.append(prev, title, fwd);
    // the star bonus of each five-stage group in this chapter
    const groups = el("div", "star-groups");
    for (const n of E.starGroups().filter(n => (n - 1) * E.STAR_GROUP + 1 >= chapter.from && n * E.STAR_GROUP <= chapter.to)) {
      const have = E.groupStars(cards().stars, n), paid = cards().starPaid.includes(n);
      const chip = el("span", `star-group${paid ? " is-paid" : ""}`, `${(n - 1) * E.STAR_GROUP + 1}–${n * E.STAR_GROUP} ★${have}/15 · ${paid ? "รับแล้ว ✓" : `💎 ${E.STAR_BONUS}`}`);
      chip.title = `เก็บครบ 15 ดาวในด่าน ${(n - 1) * E.STAR_GROUP + 1}–${n * E.STAR_GROUP} รับ ${E.STAR_BONUS} เพชร`;
      groups.append(chip);
    }
    const dots = el("div", "map-dots");
    E.CHAPTERS.forEach((ch, n) => {
      const dot = button(`map-dot${n + 1 === mapChapter ? " is-on" : ""}${isOpen(ch.from) ? "" : " is-locked"}`, String(n + 1), () => { mapChapter = n + 1; showHub(); }, ch.name);
      dots.append(dot);
    });

    // the map
    const scroller = el("div", "map-scroll");
    const map = el("div", `stage-map${chapterOpen ? "" : " is-locked"}`);
    map.style.setProperty("--accent", ["#ff8fc0", "#5fe0d0", "#ff8a4c", "#9fdcff", "#c48bff", "#ffd76a", "#8ff0ff", "#5affd2", "#ffb86b", "#7dffb0", "#ff5a78", "#fff078", "#6ffff0", "#ffb04a", "#c9a8ff", "#9fc8ff"][mapChapter - 1] || "#ffd76a");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("map-lines");
    const pos = (n) => MAP_PATH[n % MAP_PATH.length];
    for (let n = 0; n < list.length - 1; n++) {
      const [x1, y1] = pos(n), [x2, y2] = pos(n + 1);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      // a gentle curve between two points
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + (n % 2 ? 6 : -6);
      line.setAttribute("d", `M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`);
      line.setAttribute("vector-effect", "non-scaling-stroke");
      line.classList.add(isCleared(list[n].num) ? (isCleared(list[n + 1].num) ? "is-done" : "is-open") : "is-locked");
      svg.append(line);
    }
    map.append(svg);
    list.forEach((stage, n) => {
      const [x, y] = pos(n);
      const openStage = isOpen(stage.num), done = isCleared(stage.num), here = next && next.num === stage.num;
      const node = button(`map-node${done ? " is-cleared" : openStage ? " is-next" : " is-locked"}${stage.boss ? " is-boss" : ""}`, null, () => stageSheet(stage));
      node.style.left = `${x}%`; node.style.top = `${y}%`;
      node.disabled = !openStage;
      node.setAttribute("aria-label", `ด่าน ${stage.num} ${stage.name}${done ? ` ผ่านแล้ว ${cards().stars[stage.num]} ดาว` : openStage ? " เล่นได้" : " ล็อกอยู่"}${stage.boss ? " มีบอส" : ""}`);
      const ring = el("span", "map-ring");
      ring.append(el("b", null, openStage ? (stage.boss ? "👑" : String(stage.num)) : "🔒"));
      node.append(ring, el("span", "map-name", `${stage.num} · ${stage.name}`));
      if (done) node.append(el("span", "map-stars", stars(cards().stars[stage.num])));
      else if (openStage) node.append(el("span", "map-prize", `💎${stage.gems}${stage.wings ? ` 🪽${stage.wings}` : ""}`));
      if (here) {
        // the team leader stands on the next stage
        const lead = cards().team.find(Boolean);
        const marker = el("span", "map-marker");
        if (lead) marker.append(portrait(lead));
        node.append(marker);
      }
      map.append(node);
    });
    if (!chapterOpen) map.append(el("p", "map-lock", `🔒 ผ่านด่าน ${chapter.from - 1} เพื่อเปิดบทนี้`));
    scroller.append(map);
    panel.append(bar, dots, groups, scroller);
    // the living backdrop, once the map is on the page
    requestAnimationFrame(() => {
      if (!map.isConnected) return;
      stopMap();
      mapShow = window.PupaCardsFx?.create(map, { chapter: mapChapter, map: true }) || null;
      // bring the next stage into view on narrow screens
      const target = map.querySelector(".map-node.is-next") || map.querySelector(".map-node.is-cleared:last-of-type");
      if (target && scroller.scrollWidth > scroller.clientWidth) scroller.scrollLeft = Math.max(0, target.offsetLeft - scroller.clientWidth / 2);
    });
  }

  // ---- Formations (แผนการยืน, E.FORMATIONS) ----
  const ROW_NAMES = { front: "แถวหน้า", middle: "แถวกลาง", back: "แถวหลัง" };
  // a formation's bonus, as words: "ป้องกัน +6% · พลังชีวิต +3%"
  const formText = (gives) => Object.entries(gives).filter(([, v]) => v > 0).map(([stat, v]) => `${E.GEAR_STAT_NAMES[stat]} +${stat === "spd" ? v : pct(v)}`).join(" · ");
  // the 3x3 field in small, front row on top, its open cells lit
  function miniForm(form) {
    const box = el("span", `form-mini is-${form.style}`);
    box.setAttribute("aria-hidden", "true");
    for (let cell = 0; cell < 9; cell++) box.append(el("i", form.cells.includes(cell) ? "is-on" : ""));
    return box;
  }
  function formSheet(note = "") {
    const c = cards(), best = bestStage(), using = E.formOf(c).id;
    const parts = [el("h3", "sheet-title", "📐 แผนการยืน"), el("p", "sheet-sub", `ทุกแผนเพิ่มค่าให้การ์ดทั้งทีม 5 ใบ อัปได้ถึง Lv ${E.FORM_MAX} · ใช้ในด่าน หอคอย และด่านประจำวัน (ลานประลองจัดแถวแยก)`)];
    if (note) parts.push(el("p", "event-got", note));
    parts.push(el("p", "form-wallet", `มี ● ${fmt(save().coins)} · ⛏ แร่ ${fmt(c.ore || 0)}`));
    const list = el("div", "form-list");
    for (const form of E.FORMATIONS) {
      const open = E.formOpen(form.id, best), lv = E.formLevel(c, form.id), on = form.id === using;
      const row = el("div", `form-card is-${form.style}${on ? " is-on" : ""}${open ? "" : " is-locked"}`);
      const words = el("div", "form-card-text");
      const style = E.FORM_STYLES[form.style];
      words.append(el("b", null, `${form.icon} ${form.name}`), el("span", `form-style is-${form.style}`, `${style.icon} ${style.name}`), el("small", "form-lv", open ? `Lv ${lv}/${E.FORM_MAX}` : `🔒 ผ่านด่าน ${form.unlock}`));
      const rows = E.ROWS.map(key => form.cells.filter(cell => E.ROWS[Math.floor(cell / 3)] === key).length);
      words.append(el("p", "form-desc", `${form.text} · หน้า ${rows[0]} กลาง ${rows[1]} หลัง ${rows[2]}`));
      words.append(el("p", "form-gives", `ทั้งทีม ${formText(E.formBonus(form.id, lv))}`));
      if (open && lv < E.FORM_MAX) words.append(el("p", "form-next", `Lv ${lv + 1}: ${formText(E.formBonus(form.id, lv + 1))}`));
      else if (open) words.append(el("p", "form-next is-max", `เลเวลสูงสุดแล้ว (Lv ${E.FORM_MAX})`));
      const actions = el("div", "form-actions");
      if (open) {
        const use = button(`shop-buy${on ? " is-owned" : ""}`, on ? "ใช้อยู่ ✓" : "ใช้แผนนี้", () => useForm(form.id), on ? `${form.name} ใช้อยู่` : `ใช้${form.name}`);
        use.disabled = on;
        actions.append(use);
        if (lv < E.FORM_MAX) {
          const cost = E.formCost(lv);
          const up = button("shop-buy form-up", `อัป ● ${fmt(cost.coins)} ⛏ ${cost.ore}`, () => upForm(form.id, 1), `อัป${form.name}เป็นเลเวล ${lv + 1} ใช้ ${cost.coins} เหรียญ แร่ ${cost.ore}`);
          up.disabled = save().coins < cost.coins || (c.ore || 0) < cost.ore;
          const five = button("shop-buy form-up", "×5", () => upForm(form.id, 5), `อัป${form.name} 5 เลเวล`);
          five.disabled = up.disabled;
          actions.append(up, five);
        }
      }
      row.append(miniForm(form), words, actions);
      list.append(row);
    }
    parts.push(list);
    openSheet(parts, "form-sheet");
  }
  function useForm(id) {
    const c = cards();
    if (!E.formOpen(id, bestStage())) return;
    c.form = id;
    store();
    [587, 784].forEach((note, i) => tone(note, .06, "triangle", .04, i * .05));
    const form = E.formOf(c);
    announce(`ใช้${form.name} พลังทีม ${fmt(teamPower())}`);
    closeSheet(true);
    showHub();
    formSheet(`ใช้${form.name}แล้ว การ์ดย้ายไปยืนตามแผนใหม่`);
  }
  function upForm(id, times) {
    const c = cards();
    let coins = save().coins, done = 0;
    for (; done < times; done++) {
      const left = E.upgradeForm(c, id, coins);
      if (left == null) break;
      coins = left;
    }
    if (!done) { tone(150, .12, "square", .05); return; }
    save().coins = coins;
    store(); showCoins();
    [659, 784, 988].forEach((note, i) => tone(note, .08, "triangle", .05, i * .05));
    const form = E.FORMATIONS.find(f => f.id === id), lv = E.formLevel(c, id);
    announce(`${form.name} เลเวล ${lv}`);
    closeSheet(true);
    showHub();
    formSheet(`${form.icon} ${form.name} อัปเป็น Lv ${lv} แล้ว`);
  }

  function renderTeam(panel) {
    const c = cards();
    // the formation's 3x3 field: its five open cells hold the team's slots
    const form = E.formOf(c), lv = E.formLevel(c, form.id);
    const formBar = button("form-bar", null, () => formSheet(), `แผนการยืน ${form.name} เลเวล ${lv} แตะเพื่อเปลี่ยนหรืออัปแผน`);
    const words = el("span", "form-bar-text");
    words.append(el("b", null, `${form.icon} ${form.name} · Lv ${lv}`), el("small", null, `${E.FORM_STYLES[form.style].icon} ${E.FORM_STYLES[form.style].name} · ทั้งทีม ${formText(E.formBonus(form.id, lv))}`));
    formBar.append(miniForm(form), words, el("span", "form-bar-go", "เปลี่ยน/อัป ›"));
    const formation = el("div", "cards-formation is-grid");
    E.ROWS.forEach((rowKey, r) => {
      const label = ROW_NAMES[rowKey];
      const row = el("div", "cards-row");
      row.append(el("span", "cards-row-label", label));
      const slots = el("div", "cards-slots");
      const open = [0, 1, 2].map(lane => form.cells.indexOf(r * 3 + lane));
      if (open.every(n => n < 0)) { row.classList.add("is-shut"); slots.append(el("span", "cards-cell-off is-row", "แผนนี้ไม่ใช้แถวนี้")); }
      else for (const slot of open) {
        if (slot < 0) { const off = el("span", "cards-cell-off"); off.setAttribute("aria-hidden", "true"); slots.append(off); continue; }
        const id = c.team[slot];
        let node;
        if (id) { node = cardTile(id, () => cardSheet(id), "in-team"); node.dataset.card = id; }
        else node = button("cards-empty", "+", () => { tab = "team"; announce("ลากการ์ดด้านล่างมาวางที่ช่องนี้ หรือแตะการ์ดแล้วกดใส่ทีม"); tone(587, .05, "triangle", .04); }, `ช่องว่าง${label}`);
        node.dataset.slot = slot;
        node.dataset.drop = "slot";
        slots.append(node);
      }
      row.append(slots);
      formation.append(row);
    });
    const sum = el("p", "cards-intro", `พลังทีม ${fmt(teamPower())} · แถวหน้าโดนตีบ่อยที่สุด แถวกลางรองลงมา ให้ตัวป้องกันยืนหน้า · ลากการ์ดไปวางในช่องทีมเพื่อใส่หรือสลับตัว`);
    const bonds = bondStrip(c.team);
    const head = el("div", "cards-sort-head");
    head.append(el("h3", "shop-heading", `การ์ดทั้งหมด ${Object.keys(c.units).length}/${E.CARD_IDS.length}`));
    const grid = el("div", "cards-grid");
    grid.dataset.drop = "out";
    const sorter = el("div", "cards-sort");
    sorter.setAttribute("role", "group");
    sorter.setAttribute("aria-label", "เรียงการ์ด");
    const fill = () => {
      for (const id of sortedCards(c, E.CARD_IDS)) {
        const tile = cardTile(id, () => cardSheet(id));
        if (c.units[id]) tile.dataset.card = id;
        grid.append(tile);
      }
    };
    const chips = () => sorter.replaceChildren(...CARD_SORTS.map(([key, icon, label]) => {
      const on = cardSort.key === key;
      const chip = button(`cards-sort-chip${on ? " is-on" : ""}`, `${icon} ${label}${on ? (cardSort.up ? " ▲" : " ▼") : ""}`, () => {
        // the chosen one again turns the order round
        setCardSort(key, on ? !cardSort.up : false);
        tone(587, .04, "triangle", .03);
        chips();
        grid.replaceChildren();
        fill();
      }, `เรียงตาม${label}${on ? (cardSort.up ? " จากน้อยไปมาก" : " จากมากไปน้อย") : ""}`);
      chip.setAttribute("aria-pressed", String(on));
      return chip;
    }));
    chips();
    fill();
    head.append(sorter);
    panel.append(setStrip(() => showHub()), formBar, formation, sum, bonds, head, grid);
    teamDrag(panel);
  }

  // How the cards are laid out: by grade (ระดับ), level or power, the highest first
  // unless turned round; cards not yet owned always come last.
  const CARD_SORTS = [["grade", "💎", "ระดับ"], ["level", "⬆", "เลเวล"], ["power", "⚔", "พลังต่อสู้"]];
  const SORT_KEY = "super-pupa-card-sort";
  let cardSort = (() => {
    try {
      const [key, dir] = String(localStorage.getItem(SORT_KEY) || "").split(":");
      if (CARD_SORTS.some(s => s[0] === key)) return { key, up: dir === "up" };
    } catch { /* no storage: the default order */ }
    return { key: "grade", up: false };
  })();
  function setCardSort(key, up) {
    cardSort = { key, up };
    try { localStorage.setItem(SORT_KEY, `${key}:${up ? "up" : "down"}`); } catch { /* kept for this visit only */ }
  }
  function sortedCards(c, ids) {
    const pow = {};
    for (const id of ids) pow[id] = c.units[id] ? E.cardPower(c, id) : 0;
    const by = {
      grade: (a, b) => E.CARDS[b].rarity - E.CARDS[a].rarity || (c.awake[b] || 0) - (c.awake[a] || 0) || (c.units[b] || 0) - (c.units[a] || 0) || pow[b] - pow[a],
      level: (a, b) => (c.units[b] || 0) - (c.units[a] || 0) || pow[b] - pow[a] || E.CARDS[b].rarity - E.CARDS[a].rarity,
      power: (a, b) => pow[b] - pow[a] || E.CARDS[b].rarity - E.CARDS[a].rarity
    }[cardSort.key];
    return ids.map((id, n) => ({ id, n })).sort((x, y) => {
      const a = x.id, b = y.id, ha = c.units[a] ? 1 : 0, hb = c.units[b] ? 1 : 0;
      if (ha !== hb) return hb - ha;
      // locked cards stay highest grade first
      if (!ha) return E.CARDS[b].rarity - E.CARDS[a].rarity || x.n - y.n;
      return (cardSort.up ? -by(a, b) : by(a, b)) || x.n - y.n;
    }).map(o => o.id);
  }

  // Dragging cards about: a [data-card] in `panel` can be picked up and
  // dropped on any [data-drop] element; onDrop(id, node, target) decides
  // what that means. A mouse drags as soon as it moves; a finger holds
  // still for a moment first, so swiping still scrolls.
  let carry = null, carryWait = 0, carryDropped = false;
  function dragCards(panel, onDrop) {
    panel.addEventListener("pointerdown", (event) => {
      if (event.button > 0 || carry) return;
      const node = event.target.closest("[data-card]");
      if (!node || !panel.contains(node)) return;
      carry = { id: node.dataset.card, node, panel, onDrop, x: event.clientX, y: event.clientY, touch: event.pointerType !== "mouse" };
      if (carry.touch) carryWait = setTimeout(() => { if (carry && !carry.ghost) carryBegin(carry); }, 260);
    });
    // a drop is not also a tap that opens the card
    panel.addEventListener("click", (event) => { if (carryDropped) { event.stopPropagation(); event.preventDefault(); } }, true);
    panel.addEventListener("contextmenu", (event) => { if (carry) event.preventDefault(); });
    if (dragCards.ready) return;
    dragCards.ready = true;
    window.addEventListener("pointermove", (event) => {
      if (!carry) return;
      if (!carry.ghost) {
        if (Math.hypot(event.clientX - carry.x, event.clientY - carry.y) <= 8) return;
        // a finger that moves before the hold scrolls instead
        if (carry.touch) { clearTimeout(carryWait); carry = null; return; }
        carry.x = event.clientX; carry.y = event.clientY; carryBegin(carry);
      }
      carryMove(event.clientX, event.clientY);
    });
    window.addEventListener("pointerup", (event) => carryFinish(event.clientX, event.clientY));
    window.addEventListener("pointercancel", () => { clearTimeout(carryWait); carryDrop(); carry = null; });
    // while a card is held, the finger moves it instead of scrolling the page
    window.addEventListener("touchmove", (event) => { if (carry?.ghost) event.preventDefault(); }, { passive: false });
  }
  const dropAt = (x, y) => {
    const target = document.elementFromPoint(x, y)?.closest("[data-drop]");
    return target && carry?.panel.contains(target) && target !== carry.node ? target : null;
  };
  function carryMark(target) {
    carry.panel.querySelectorAll(".is-drop, .is-drop-out").forEach(n => n.classList.remove("is-drop", "is-drop-out"));
    target?.classList.add(target.dataset.drop === "out" ? "is-drop-out" : "is-drop");
  }
  function carryBegin(drag) {
    const box = drag.node.getBoundingClientRect();
    const ghost = drag.node.cloneNode(true);
    ghost.classList.add("drag-ghost");
    Object.assign(ghost.style, { width: `${box.width}px`, height: `${box.height}px` });
    document.body.append(ghost);
    drag.ghost = ghost; drag.dx = drag.x - box.left; drag.dy = drag.y - box.top;
    drag.node.classList.add("is-dragging");
    tone(523, .05, "triangle", .04);
    carryMove(drag.x, drag.y);
  }
  function carryMove(x, y) {
    if (!carry?.ghost) return;
    carry.px = x; carry.py = y;
    carry.ghost.style.transform = `translate(${x - carry.dx}px, ${y - carry.dy}px) rotate(-3deg) scale(1.06)`;
    carryMark(dropAt(x, y));
    // held near the top or bottom edge, the list scrolls toward it
    const box = carryScroller(carry.panel)?.getBoundingClientRect();
    // (faster the closer to the edge)
    carry.scroll = !box ? 0 : y < box.top + 64 ? -(1 + (box.top + 64 - y) / 32) : y > box.bottom - 64 ? 1 + (y - box.bottom + 64) / 32 : 0;
    if (carry.scroll && !carry.scrolling) { carry.scrolling = true; carry.lastFrame = performance.now(); requestAnimationFrame(carryScroll); }
  }
  const carryScroller = (node) => {
    for (let n = node; n; n = n.parentElement) if (n.scrollHeight > n.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(n).overflowY)) return n;
    return null;
  };
  function carryScroll(now) {
    const drag = carry;
    if (!drag?.ghost || !drag.scroll) { if (drag) drag.scrolling = false; return; }
    const dt = Math.min(.1, (now - drag.lastFrame) / 1000); drag.lastFrame = now;
    const box = carryScroller(drag.panel);
    if (box) box.scrollTop += drag.scroll * 300 * dt;
    carryMark(dropAt(drag.px, drag.py));
    requestAnimationFrame(carryScroll);
  }
  // Take the ghost away (true if there was one, i.e. a drag happened).
  function carryDrop() {
    if (!carry?.ghost) return false;
    carry.ghost.remove(); carry.node.classList.remove("is-dragging"); carryMark(null);
    return true;
  }
  function carryFinish(x, y) {
    clearTimeout(carryWait);
    if (!carry) return;
    const target = dropAt(x, y), drag = carry, dragged = carryDrop();
    carry = null;
    if (!dragged) return;
    carryDropped = true; setTimeout(() => { carryDropped = false; }, 0);
    if (target) drag.onDrop(drag.id, drag.node, target);
  }

  // The team tab: drop on a slot to put the card there (taking the place of
  // the card in it, or trading places when both are in the team); drop a
  // team card back on the card list to take it out.
  function teamDrag(panel) {
    dragCards(panel, (id, node, target) => {
      const team = cards().team, def = E.CARDS[id];
      if (target.dataset.drop === "slot") {
        const to = Number(target.dataset.slot), from = team.indexOf(id);
        if (from === to) return;
        const other = team[to];
        if (from >= 0) [team[from], team[to]] = [team[to], team[from]];
        else team[to] = id;
        store(); tone(660, .08, "triangle", .05);
        announce(other ? (from >= 0 ? `สลับ${def.name}กับ${E.CARDS[other].name}` : `ใส่${def.name}แทน${E.CARDS[other].name}`) : `ใส่${def.name}ในทีมแล้ว`);
        showHub();
      } else if (target.dataset.drop === "out" && node.dataset.slot != null) {
        if (team.filter(Boolean).length <= 1) { tone(150, .12, "square", .05); announce("ทีมต้องมีการ์ดอย่างน้อย 1 ใบ"); return; }
        team[Number(node.dataset.slot)] = "";
        store(); tone(440, .08, "triangle", .05); announce(`ถอด${def.name}ออกจากทีม`);
        showHub();
      }
    });
  }



  // A small card: picture, rarity, role, name and level.
  // A holographic card: a rainbow foil and a glare that follow the finger
  // or pointer, and a tilt toward it. Rarer cards shine more (cards.css).
  const stillMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  function holo(node) {
    node.classList.add("holo");
    node.append(el("span", "holo-foil"), el("span", "holo-glare"));
    const move = (event) => {
      const box = node.getBoundingClientRect();
      if (!box.width) return;
      const x = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)), y = Math.min(1, Math.max(0, (event.clientY - box.top) / box.height));
      node.style.setProperty("--mx", `${Math.round(x * 100)}%`);
      node.style.setProperty("--my", `${Math.round(y * 100)}%`);
      if (!stillMotion()) {
        node.style.setProperty("--ry", `${((x - .5) * 22).toFixed(1)}deg`);
        node.style.setProperty("--rx", `${((.5 - y) * 22).toFixed(1)}deg`);
      }
      node.classList.add("is-tilting");
    };
    const leave = () => {
      node.classList.remove("is-tilting");
      for (const key of ["--rx", "--ry"]) node.style.removeProperty(key);
    };
    node.addEventListener("pointermove", move);
    node.addEventListener("pointerdown", move);
    node.addEventListener("pointerleave", leave);
    node.addEventListener("pointercancel", leave);
    return node;
  }
  // the frame's corner ornaments (drawn by cards.css)
  function cardDeco() {
    const deco = el("span", "card-deco");
    deco.setAttribute("aria-hidden", "true");
    deco.append(el("i"));
    return deco;
  }
  function cardTile(id, onPick, extra = "") {
    const def = E.CARDS[id], lv = cards().units[id];
    const tile = button(`tcard r${def.rarity}${lv ? "" : " is-locked"}${cards().team.includes(id) ? " is-picked" : ""} ${extra}`, null, onPick);
    tile.setAttribute("aria-label", `${def.name} ${E.ROLES[def.role].name} ระดับ ${gradeOf(id)}${lv ? ` เลเวล ${lv} พลังต่อสู้ ${fmt(E.cardPower(cards(), id))}` : " ยังไม่มี"}${cards().awake?.[id] ? (cards().awake[id] > E.MAX_AWAKE ? ` ปลุกพลังขั้น 2 ดาวทอง ${cards().awake[id] - E.MAX_AWAKE}` : ` ดาวแดง ${cards().awake[id]}`) : ""}`);
    const art = el("span", "tcard-art");
    art.append(portrait(id));
    const awake = cards().awake?.[id] || 0;
    tile.append(art, gradeBadge(id, "tcard-rare grade"), el("span", "tcard-role", E.ROLES[def.role].icon), el("b", "tcard-name", def.name), el("small", "tcard-lv", lv ? `Lv ${lv}` : "🔒"));
    if (lv) tile.append(el("small", "tcard-power", `⚔ ${fmt(E.cardPower(cards(), id))}`));
    if (awake) { const st = redStars(awake); st.classList.add("tcard-stars"); tile.append(st); }
    if (awake) tile.classList.add(`awake-${awake}`);
    if (awake > E.MAX_AWAKE) tile.classList.add("is-awake2");
    tile.append(cardDeco());
    return holo(backdrop(tile, id));
  }

  // ---- Detail panels ----
  // `fresh` is false when the same sheet is drawn again in place (a card
  // after wearing an item), which must take quick taps.
  function openSheet(content, kind = "", fresh = true) {
    closeSheet(true);
    sheet = el("div", "cards-sheet");
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    // its kind is set before it is shown, so the page is laid out only once
    const box = el("div", `cards-sheet-box cards-scroll${kind ? ` ${kind}` : ""}`);
    const x = button("icon-button cards-sheet-close", "✕", () => closeSheet(), "ปิด");
    box.append(x, ...content);
    sheet.append(box);
    sheet.addEventListener("click", (event) => { if (event.target === sheet) closeSheet(); });
    frame.append(sheet);
    if (fresh) freshen(sheet);
    x.focus({ preventScroll: true });
  }
  function closeSheet(quiet) {
    if (!sheet) return;
    sheet.remove();
    sheet = null;
    if (!quiet) { showHub(); freshen(body); }
  }

  // Card bonds: the ones active in the team, as chips with their bonus.
  function bondStrip(ids) {
    const box = el("div", "bond-strip");
    const active = E.activeBonds(ids);
    box.append(el("b", null, "🔗 ความสัมพันธ์"));
    if (!active.length) box.append(el("span", "bond-none", "ลงการ์ดที่มีความสัมพันธ์กันพร้อมกัน เพื่อเพิ่มพลังโจมตี (ดูได้ที่หน้าการ์ด)"));
    for (const bond of active) {
      const chip = el("span", "bond-chip", `${bond.icon} ${bond.name} · โจมตี +${Math.round(bond.atk * 100)}%`);
      chip.title = bond.members.map(m => E.CARDS[m].name).join(" · ");
      box.append(chip);
    }
    return box;
  }
  // On a card's sheet: every bond the card is in, who else is in it, and
  // whether it is active in the team now.
  function bondSheet(id) {
    const c = cards(), team = c.team.filter(Boolean);
    const box = el("div", "sheet-bonds");
    box.append(el("b", null, "🔗 ความสัมพันธ์ · ลงพร้อมกันอย่างน้อย 2 ใบ สมาชิกทุกใบโจมตีแรงขึ้น"));
    for (const bond of E.bondsOf(id)) {
      const on = team.includes(id) && E.activeBonds(team).some(b => b.id === bond.id);
      const row = el("div", `bond-row${on ? " is-on" : ""}`);
      row.append(el("span", "bond-name", `${bond.icon} ${bond.name}`), el("span", "bond-atk", `+${Math.round(bond.atk * 100)}%`));
      const who = el("span", "bond-members");
      for (const m of bond.ids) {
        const face = el("span", `bond-face${c.units[m] ? "" : " is-missing"}${team.includes(m) ? " is-team" : ""}`);
        face.append(portrait(m));
        face.title = E.CARDS[m].name;
        who.append(face);
      }
      row.append(who);
      if (on) row.append(el("em", null, "ทำงานอยู่"));
      box.append(row);
    }
    return box;
  }

  let sheetTab = "skills"; // the card sheet's open tab, kept between cards
  let gearSlot = 0;        // the gear piece picked on the card sheet
  let artCache = null;     // the sheet's picture, kept while its card is redrawn
  const gearArt = (n) => `assets/gear-${E.GEAR_SLOTS[n].key}.webp`;
  const pct = (v) => `${(v * 100).toFixed(1).replace(/\.0$/, "")}%`;
  // what a piece gives, in words: "โจมตี +3% · คริติคอล +1.1%"
  const gearText = (n, tier, lv) => Object.entries(E.gearGives(n, tier, lv)).map(([stat, v]) => `${E.GEAR_STAT_NAMES[stat]} ${stat === "spd" ? `+${v.toFixed(1)}` : `+${pct(v)}`}`).join(" · ");
  // the gear around the picture: attack on the left, defence on the right
  const GEAR_SIDES = [[0, 6, 4, 5], [1, 2, 7, 3]];
  const gearCanUp = (c, id, n) => {
    const g = E.gearOf(c, id, n), cost = E.enhanceCost(g.lv, g.tier);
    return Boolean(c.units[id]) && g.lv < g.cap && (c.ore || 0) >= cost.ore && save().coins >= cost.coins;
  };
  const gearCanReforge = (c, id, n) => {
    const g = E.gearOf(c, id, n), cost = E.reforgeCost(g.tier);
    return Boolean(c.units[id]) && g.tier < E.GEAR_TIERS.length && g.lv >= g.cap && (c.ore || 0) >= cost.ore && (c.dust || 0) >= cost.dust && save().coins >= cost.coins;
  };
  const awakeReady = (c, id) => {
    const cost = c.units[id] && E.awakeCost(c, id);
    return Boolean(cost) && cost.lv >= cost.lvNeed && cost.dust >= cost.fromDust && cost.wings >= cost.wingsNeed && save().coins >= cost.coins;
  };
  // what a card is good at, in a few words, from its role and skills
  function cardTags(id) {
    const def = E.CARDS[id], tags = [E.ROLES[def.role].name];
    const has = new Set(def.skills.flatMap(s => [s.target === "all" ? "all" : "", s.heal ? "heal" : "", s.shield ? "shield" : "", s.drain ? "drain" : "", ...(s.fx || []).map(f => f.k)]));
    if ((def.crit || 0) >= .25) tags.push("คริติคอล");
    for (const [k, word] of [["all", "โจมตีหมู่"], ["heal", "ฮีล"], ["shield", "โล่"], ["taunt", "ยั่วยุ"], ["drain", "ดูดเลือด"], ["stun", "สตัน"], ["burn", "ไฟลวก"], ["defDown", "ทำลายเกราะ"], ["atkUp", "บัฟพลัง"], ["cleanse", "ล้างสถานะ"]]) if (has.has(k)) tags.push(word);
    if (def.from === "pet") tags.push("สัตว์เลี้ยง");
    return tags.slice(0, 6);
  }
  function gearIcon(n, tier, lv) {
    const icon = el("span", `gear-icon t${tier}`), img = el("img");
    img.src = gearArt(n); img.alt = ""; img.draggable = false;
    icon.append(img);
    if (lv != null) icon.append(el("b", "gear-lv", String(lv)));
    return icon;
  }
  function gearSlotButton(c, id, n) {
    const g = E.gearOf(c, id, n), slot = E.GEAR_SLOTS[n];
    const pick = button(`gear-slot${n === gearSlot ? " is-on" : ""}`, null, () => {
      gearSlot = n;
      if (sheetTab !== "enhance" && sheetTab !== "reforge") sheetTab = "item";
      tone(587, .04, "triangle", .03);
      cardSheet(id);
    }, `${slot.name} ขั้น${E.GEAR_TIERS[g.tier - 1].name} เลเวล ${g.lv}/${g.cap}`);
    pick.append(gearIcon(n, g.tier, g.lv));
    const worn = wornItem(c, id, n);
    if (worn) pick.append(el("i", `gear-gem t${worn.r}`));
    if (gearCanReforge(c, id, n)) pick.append(el("i", "codex-dot"));
    return pick;
  }
  // ---- Items in the card book ----
  const wornItem = (c, id, n) => (c.items || []).find(it => it.o === id && it.s === n) || null;
  const statText = (stat, v) => `${E.GEAR_STAT_NAMES[stat]} ${stat === "spd" ? `+${v.toFixed(1)}` : `+${pct(v)}`}`;
  // the card's power were it to wear this item
  const powerWith = (c, id, item) => E.cardPower({ ...c, items: c.items.map(it => (it === item ? { ...it, o: id } : it.o === id && it.s === item.s ? { ...it, o: "" } : it)) }, id);
  function itemTile(item, actions = [], note = null) {
    const row = el("div", `item-row t${item.r}`);
    const icon = el("span", `gear-icon t${item.r}`), img = el("img");
    img.src = gearArt(item.s); img.alt = ""; img.draggable = false;
    icon.append(img);
    const info = el("div", "item-info"), parts = E.itemParts(item);
    info.append(el("b", null, itemName(item)), el("span", "item-main", parts.main.map(([stat, v]) => statText(stat, v)).join(" · ")));
    if (parts.extras.length) info.append(el("span", "item-extra", parts.extras.map(([stat, v]) => statText(stat, v)).join(" · ")));
    if (note) info.append(note);
    const act = el("div", "item-acts");
    act.append(...actions);
    row.append(icon, info, act);
    return row;
  }
  function salvage(ids, id) {
    const c = cards(), ore = E.salvageItems(c, ids);
    if (!ore) return;
    c.gone = [...(c.gone || []), ...ids].slice(-300);
    store();
    [392, 330].forEach((note, i) => tone(note, .08, "triangle", .05, i * .06));
    announce(`ย่อยไอเทม ได้แร่ ${ore}`);
    cardSheet(id);
  }
  // the picked slot: the item worn there, and the bag's items for it
  function itemPane(c, id) {
    const n = gearSlot, slot = E.GEAR_SLOTS[n], g = E.gearOf(c, id, n);
    const box = el("div", "gear-pane item-pane");
    const worn = wornItem(c, id, n);
    box.append(el("p", "item-title", `ช่อง${slot.name} · เสริมแกร่ง Lv ${g.lv}/${g.cap} (${gearText(n, g.tier, g.lv)})`));
    if (worn) box.append(itemTile(worn, [button("codex-chip", "ถอด", () => { if (!E.unequipItem(cards(), worn.i)) return; store(); tone(440, .08, "triangle", .05); cardSheet(id); }, `ถอด${itemName(worn)}`)], el("small", "item-on", "ใส่อยู่")));
    else box.append(el("p", "gear-note", c.units[id] ? `ยังไม่ได้ใส่${slot.name} · ไอเทมดรอปจากการชนะด่าน หอคอย ลานประลอง ด่านประจำวัน และล่าอัตโนมัติ` : "ได้การ์ดนี้ก่อน จึงใส่ไอเทมได้"));
    const items = c.items || [];
    const bag = items.filter(it => it.s === n && it !== worn).sort((a, b) => E.itemScore(b) - E.itemScore(a));
    box.append(el("p", "item-title", `ในกระเป๋า: ${slot.name} ${bag.length} ชิ้น · กระเป๋า ${items.length}/${E.BAG_SIZE}`));
    const now = c.units[id] ? E.cardPower(c, id) : 0;
    const list = el("div", "item-list");
    for (const item of bag.slice(0, 40)) {
      const wear = button("codex-chip is-gold", "ใส่", () => {
        if (!E.equipItem(cards(), item.i, id)) return;
        store(); [659, 880].forEach((note, i) => tone(note, .08, "triangle", .05, i * .06));
        announce(`ใส่${itemName(item)}ให้${E.CARDS[id].name}`);
        cardSheet(id, { worn: true });
      }, `ใส่${itemName(item)}`);
      wear.disabled = !c.units[id];
      const acts = [wear];
      if (!item.o) acts.push(button("codex-chip", `ย่อย ⛏${E.SALVAGE_ORE[item.r - 1]}`, () => salvage([item.i], id), `ย่อย${itemName(item)}เป็นแร่ ${E.SALVAGE_ORE[item.r - 1]}`));
      const note = el("small", "item-note");
      if (c.units[id]) { const d = powerWith(c, id, item) - now; note.append(el("em", d >= 0 ? "item-up" : "item-down", `พลัง ${d >= 0 ? "+" : ""}${fmt(d)}`)); }
      if (item.o) note.append(` · ใส่อยู่กับ${E.CARDS[item.o].name}`);
      list.append(itemTile(item, acts, note));
    }
    if (!bag.length) list.append(el("p", "gear-total", `ยังไม่มี${slot.name}ในกระเป๋า`));
    box.append(list);
    const junk = items.filter(it => !it.o && it.r <= 2);
    if (junk.length) box.append(button("codex-btn is-small item-junk", `ย่อยไอเทมธรรมดาและดีที่ไม่ได้ใส่ ${junk.length} ชิ้น · ⛏ ${junk.reduce((sum, it) => sum + E.SALVAGE_ORE[it.r - 1], 0)}`, () => salvage(junk.map(it => it.i), id)));
    return box;
  }
  // the picked piece: enhance it a level at a time, up to its tier's cap
  function gearPane(c, id) {
    const n = gearSlot, slot = E.GEAR_SLOTS[n], g = E.gearOf(c, id, n), tier = E.GEAR_TIERS[g.tier - 1];
    const box = el("div", "gear-pane");
    const head = el("div", "gear-head"), name = el("div", "gear-name");
    name.append(el("b", null, `${slot.name} · ขั้น${tier.name}`), el("span", null, `Lv ${g.lv}/${g.cap} · ${gearText(n, g.tier, g.lv)}`));
    head.append(gearIcon(n, g.tier, g.lv), name);
    box.append(head);
    if (!c.units[id]) { box.append(el("p", "gear-note", "ได้การ์ดนี้ก่อน จึงเสริมแกร่งอุปกรณ์ได้")); return box; }
    if (g.lv < g.cap) {
      const cost = E.enhanceCost(g.lv, g.tier);
      name.append(el("p", "gear-next", `Lv ${g.lv + 1}: ${gearText(n, g.tier, g.lv + 1)}`));
      const row = el("div", "gear-buy");
      const one = button("codex-btn", `เสริมแกร่ง · ⛏ ${cost.ore} ● ${fmt(cost.coins)}`, () => enhance(id, n, 1));
      one.disabled = !gearCanUp(c, id, n);
      const ten = button("codex-btn is-small", "×10", () => enhance(id, n, 10), `เสริมแกร่ง${slot.name} 10 ครั้ง`);
      ten.disabled = one.disabled;
      row.append(one, ten);
      head.append(row);
    } else box.append(el("p", "gear-note", g.tier < E.GEAR_TIERS.length ? `ถึงขีดจำกัดของขั้น${tier.name}แล้ว · หลอมล้างเพื่อเปิดถึง Lv ${g.cap + E.GEAR_STEP}` : "อุปกรณ์ชิ้นนี้เต็มขั้นตำนานแล้ว"));
    const all = E.gearBonus(c, id);
    box.append(el("p", "gear-total", `ทั้งชุด: พลังชีวิต +${pct(all.hp)} · โจมตี +${pct(all.atk)} · ป้องกัน +${pct(all.def)} · ความเร็ว +${all.spd.toFixed(1)} · คริติคอล +${pct(all.crit)}`));
    box.append(el("p", "gear-have", `มี ⛏ แร่ ${fmt(c.ore || 0)} · ● ${fmt(save().coins)} · แร่ได้จากการชนะด่าน หอคอย ลานประลอง ด่านประจำวัน และล่าอัตโนมัติ`));
    return box;
  }
  // reforging: a piece at its cap moves up a tier, which opens more levels
  function reforgePane(c, id) {
    const n = gearSlot, slot = E.GEAR_SLOTS[n], g = E.gearOf(c, id, n), tier = E.GEAR_TIERS[g.tier - 1], next = E.GEAR_TIERS[g.tier];
    const box = el("div", "gear-pane");
    const flow = el("div", "gear-flow");
    flow.append(gearIcon(n, g.tier, g.cap));
    if (next) flow.append(el("span", "gear-arrow", "»"), gearIcon(n, g.tier + 1, g.cap + E.GEAR_STEP));
    const info = el("div", "gear-name");
    info.append(el("b", null, next ? `หลอมล้าง${slot.name}: ขั้น${tier.name} → ขั้น${next.name}` : `${slot.name} ขั้น${tier.name} (สูงสุด)`), el("span", null, next ? `ขีดจำกัดเลเวล: ${g.cap} → ${g.cap + E.GEAR_STEP} · พลังต่อเลเวล ×${tier.mult} → ×${next.mult}` : "หลอมล้างครบทุกขั้นแล้ว"));
    flow.append(info);
    box.append(flow);
    if (next && c.units[id]) {
      const cost = E.reforgeCost(g.tier);
      if (g.lv < g.cap) box.append(el("p", "gear-note", `ต้องเสริมแกร่งให้ถึง Lv ${g.cap} ก่อน (ตอนนี้ Lv ${g.lv})`));
      const go = button("codex-btn gear-go", `หลอมล้าง · ⛏ ${cost.ore} ✧ ${cost.dust} ● ${fmt(cost.coins)}`, () => reforge(id, n));
      go.disabled = !gearCanReforge(c, id, n);
      flow.append(go);
    } else if (!c.units[id]) box.append(el("p", "gear-note", "ได้การ์ดนี้ก่อน จึงหลอมล้างอุปกรณ์ได้"));
    box.append(el("p", "gear-have", `มี ⛏ แร่ ${fmt(c.ore || 0)} · ✧ ผลึกดาว ${fmt(c.dust)} · ● ${fmt(save().coins)}`));
    return box;
  }
  // red stars: shards of this card (or star dust), star-up wings and coins
  function awakePane(c, id) {
    const def = E.CARDS[id], at = c.awake[id] || 0, cost = E.awakeCost(c, id), cap = E.capFor(at);
    const box = el("div", "sheet-awake");
    const second = at >= E.MAX_AWAKE && E.maxAwake(id) > E.MAX_AWAKE;
    if (second) box.classList.add("is-second");
    const title = el("b", null, second ? "ปลุกพลังขั้น 2 " : "อัปดาว (อเวค) ");
    title.append(redStars(at, E.MAX_AWAKE));
    box.append(title, el("span", null, `เศษ${def.name} ${fmt(c.shards[id] || 0)} · ผลึกดาว ${fmt(c.dust)} · 🪽 ปีกอัพดาว ${fmt(c.wings)} · ดาวละ: เลเวลสูงสุด +10 และพลัง +${Math.round((second ? E.AWAKE2_BONUS : E.AWAKE_BONUS) * 100)}%${second ? " · ดาวแดงกลายเป็นดาวทองทีละดวง" : ""}`));
    if (cost) {
      const flowText = el("small", "awake-flow", `ขีดจำกัดเลเวล: ${cap} → ${E.capFor(cost.star)} · โบนัสพลัง: +${Math.round(E.awakeBonus(at) * 100)}% → +${Math.round(E.awakeBonus(cost.star) * 100)}%`);
      const up = button("shop-buy", `${cost.second ? `ดาวทอง ${cost.star - E.MAX_AWAKE}` : `★${cost.star}`} · เศษ ${cost.need} 🪽 ${cost.wingsNeed} ● ${fmt(cost.coins)}`, () => awakenCard(id));
      up.disabled = !awakeReady(c, id);
      up.setAttribute("aria-label", `อัปดาว${def.name}เป็นดาวแดง ${cost.star} ดวง ใช้เศษ ${cost.fromShards}${cost.fromDust ? ` ผลึกดาว ${cost.fromDust}` : ""} ปีกอัพดาว ${cost.wingsNeed} และ ${cost.coins} เหรียญ`);
      box.append(up, flowText);
      if (up.disabled) box.append(el("small", "awake-why", `ยังอัปดาวไม่ได้: ${[cost.lv < cost.lvNeed ? `เลเวลยังไม่เต็ม (${cost.lv}/${cost.lvNeed})` : "", cost.dust < cost.fromDust ? "เศษ/ผลึกดาวไม่พอ" : "", cost.wings < cost.wingsNeed ? "ปีกอัพดาวไม่พอ" : "", save().coins < cost.coins ? "เหรียญไม่พอ" : ""].filter(Boolean).join(" · ")}`));
      if (cost.lv < cost.lvNeed) box.append(el("small", "awake-lv", `ต้องอัปเลเวลให้เต็ม Lv ${cost.lvNeed} ก่อน จึงอัปดาวได้ (ตอนนี้ Lv ${cost.lv})`));
      if (cost.fromDust) box.append(el("small", null, cost.dust >= cost.fromDust ? `ใช้ผลึกดาวแทน ${cost.fromDust}` : `เศษไม่พอ ขาด ${cost.fromDust - cost.dust}`));
      if (cost.wings < cost.wingsNeed) {
        box.append(el("small", null, `ปีกอัพดาวไม่พอ ขาด ${cost.wingsNeed - cost.wings} · ได้จากด่านบอส ด่านประจำวัน ลานประลอง รางวัลวันที่ 7 โบนัสดาวครบ หรือสุ่มได้ S/SSS ซ้ำ`));
        const buyWing = button("shop-buy wing-buy", `แลกปีก 🪽1 · 💎 ${E.WING_PRICE}`, () => buyWings(id));
        buyWing.disabled = (save().gems || 0) < E.WING_PRICE;
        box.append(buyWing);
      }
    } else box.append(el("span", "sheet-max", E.maxAwake(id) > E.MAX_AWAKE ? "ปลุกพลังขั้น 2 เต็มแล้ว" : "ดาวแดงเต็มแล้ว · ปลุกพลังขั้น 2 ได้เฉพาะการ์ด S และ SSS"));
    return box;
  }
  function costumePane(c, id) {
    const own = c.outfit[id];
    const row = el("div", "sheet-costume");
    const look = el("img", "costume-look");
    look.src = costumeArt(id);
    look.alt = COSTUME_NAME[id];
    row.append(look, el("b", null, `คอสตูม · ${COSTUME_NAME[id]}`), el("span", null, `ชุดใหม่ทั้งชุด และเพิ่มพลังชีวิต โจมตี ป้องกัน +${Math.round(E.COSTUME_BONUS * 100)}% เมื่อสวม`));
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
    } else row.append(button("shop-equip", own === 2 ? "ถอดชุด" : "สวมชุด", () => { c.outfit[id] = own === 2 ? 1 : 2; if (own !== 2) delete c.hallo[id]; store(); tone(660, .08, "triangle", .05); cardSheet(id); }));
    if (!E.hasHallo(id)) return row;
    // the Halloween costume, a gift to S and SSS cards: one costume at a time
    const box = el("div", "costume-list");
    const hallo = el("div", "sheet-costume is-halloween");
    const pic = el("img", "costume-look");
    pic.src = halloArt(id);
    pic.alt = HALLO_NAME[id];
    const on = c.hallo[id] === 1;
    hallo.append(pic, el("b", null, `🎃 ${HALLO_NAME[id]}`), el("span", null, `ของขวัญฮาโลวีนสำหรับการ์ดระดับ S ขึ้นไป ใส่ได้ฟรี เพิ่มพลังชีวิต โจมตี ป้องกัน +${Math.round(E.COSTUME_BONUS * 100)}% เท่าชุดคอสตูม (ใส่ได้ทีละชุด)`));
    hallo.append(button("shop-equip", on ? "ถอดชุด" : "สวมชุด", () => {
      if (on) delete c.hallo[id];
      else { c.hallo[id] = 1; if (c.outfit[id] === 2) c.outfit[id] = 1; }
      store(); tone(660, .08, "triangle", .05); cardSheet(id);
    }));
    box.append(hallo, row);
    return box;
  }
  // The card book: on a wide screen the owned cards in a list on the left,
  // the open card on the right (stars, its picture between its six pieces
  // of gear, level, power and stats, and tabs below).
  function codexList(c, id) {
    const list = el("div", "codex-list cards-scroll");
    const ids = sortedCards(c, Object.keys(c.units).filter(k => E.CARDS[k]));
    for (const k of ids) {
      const def = E.CARDS[k], lv = c.units[k], cap = E.capFor(c.awake[k]);
      const need = lv < cap ? E.xpNeed(lv) : 0, have = c.xp[k] || 0;
      const row = button(`codex-card r${def.rarity}${k === id ? " is-on" : ""}`, null, () => { tone(587, .04, "triangle", .03); cardSheet(k); }, `${def.name} เลเวล ${lv}`);
      const face = backdrop(el("span", "codex-face"), k);
      face.append(portrait(k), el("span", "codex-role", E.ROLES[def.role].icon));
      const bar = el("span", "codex-bar");
      bar.style.setProperty("--fill", `${need ? Math.min(100, Math.floor(100 * have / need)) : 100}%`);
      bar.append(el("i"), el("small", null, need ? `${fmt(have)}/${fmt(need)}` : "MAX"));
      row.append(face, el("b", "codex-lvnum", String(lv)), el("strong", "codex-card-name", def.name), el("span", "codex-card-tags", cardTags(k).slice(0, 3).join("/")), bar);
      if (awakeReady(c, k)) row.append(el("i", "codex-dot"));
      list.append(row);
    }
    return list;
  }
  // the parts of the card book that scroll on their own
  const SHEET_SCROLLERS = [".cards-sheet-box", ".codex-detail", ".codex-pane"];
  function cardSheet(id, { worn = false } = {}) {
    const c = cards(), def = E.CARDS[id], lv = c.units[id], owned = Boolean(lv);
    // redrawing the same card keeps its picture (and 3D model) and scroll
    const same = sheet?.dataset.card === id;
    const listTop = sheet?.querySelector(".codex-list")?.scrollTop;
    const samePane = same && sheet.dataset.pane === `${sheetTab}:${gearSlot}`;
    const tops = same ? SHEET_SCROLLERS.map(sel => sheet.querySelector(sel)?.scrollTop || 0) : null;
    const look = skinOf(id) || "plain";
    let art = same && artCache?.id === id && artCache.look === look ? artCache.node : null;
    if (!art) {
      art = backdrop(el("div", `sheet-art r${def.rarity}`), id);
      art.append(portrait(id), cardDeco());
      if (MODELS_3D[id] && !wearing(id) && window.PupaCards3D) {
        art.classList.add("is-3d");
        window.PupaCards3D.mount(art, MODELS_3D[id]);
        art.append(el("span", "badge-3d", "3D"));
      } else holo(art);
      artCache = { id, look, node: art };
    }
    const detail = el("div", "codex-detail");
    const stars = el("div", "codex-stars");
    stars.append(redStars(c.awake[id] || 0, E.MAX_AWAKE));
    if ((c.awake[id] || 0) > E.MAX_AWAKE) stars.append(el("small", null, `ปลุกพลังขั้น 2 · ดาวทอง ${c.awake[id] - E.MAX_AWAKE}/${E.MAX_AWAKE2 - E.MAX_AWAKE}`));
    const stage = el("div", "codex-stage");
    const left = el("div", "gear-col"), right = el("div", "gear-col");
    GEAR_SIDES[0].forEach(n => left.append(gearSlotButton(c, id, n)));
    GEAR_SIDES[1].forEach(n => right.append(gearSlotButton(c, id, n)));
    stage.append(left, art, right);
    const title = el("h3", "codex-title");
    title.append(el("span", `codex-grade grade-${gradeOf(id).toLowerCase()}`, gradeOf(id)), el("span", "codex-name", def.name));
    const team = el("div", "codex-team");
    if (owned) {
      const slot = c.team.indexOf(id);
      if (slot >= 0) {
        const form = E.formOf(c), to = nextRow(form, slot);
        team.append(el("span", "codex-in", `ในทีม · ${ROW_NAMES[E.formCell(form, slot).row]}`), ...(to ? [button("codex-chip", `ย้ายไป${ROW_NAMES[to]}`, () => moveRow(id))] : []), button("codex-chip", "ถอดจากทีม", () => setTeam(id, false)));
      }
      else team.append(button("codex-chip is-gold", "ใส่ทีม", () => setTeam(id, true)));
    } else team.append(el("span", "codex-in", "🔒 ได้จากการสุ่มการ์ดเท่านั้น"), button("codex-chip is-gold", "🎴 ไปสุ่มการ์ด", () => { tab = "pulls"; closeSheet(); }));
    // level, power, EXP and the stats with gear (gear's share in green)
    const cap = E.capFor(c.awake[id]);
    const base = E.cardStats(id, lv || 1), bonus = E.cardBonus(c, id);
    const now = E.boosted(base, bonus, E.gearBonus(c, id)), bare = E.boosted(base, bonus);
    const info = el("div", "codex-panel");
    const lvRow = el("div", "codex-row");
    lvRow.append(el("span", "codex-label", "อัปเลเวล:"), el("span", "codex-pill", owned ? `${lv}/${cap}${lv >= cap ? (c.awake[id] || 0) < E.maxAwake(id) ? " (เต็ม · อัปดาวเพื่อไปต่อ)" : " (สูงสุดแล้ว)" : ""}` : "ยังไม่มีการ์ดนี้"));
    if (owned && lv < cap) {
      const cost = E.levelCost(lv);
      const up = button("codex-up", "⬆", () => levelUp(id), `อัปเลเวล${def.name}เป็นเลเวล ${lv + 1} ใช้ ${cost} เหรียญ`);
      up.disabled = save().coins < cost;
      lvRow.append(up, el("small", "codex-cost", `● ${fmt(cost)}`));
    }
    const pair = el("div", "codex-row codex-pair");
    pair.append(el("span", "codex-label", "เลเวล:"), el("b", "codex-num", String(lv || 0)), el("span", "codex-label", "พลังต่อสู้:"), el("b", "codex-num", fmt(owned ? E.cardPower(c, id) : E.power(id, 1))));
    const need = owned && lv < cap ? E.xpNeed(lv) : 0, have = c.xp[id] || 0;
    const xpRow = el("div", "codex-row");
    const bar = el("span", "codex-bar is-big");
    bar.style.setProperty("--fill", `${need ? Math.min(100, Math.floor(100 * have / need)) : owned ? 100 : 0}%`);
    bar.append(el("i"));
    xpRow.append(el("span", "codex-label", "EXP:"), bar, el("b", "codex-pct", need ? `${fmt(have)}/${fmt(need)}` : owned ? "MAX" : "-"));
    const table = el("dl", "codex-stats");
    for (const [key, label] of [["hp", "พลังชีวิต"], ["atk", "โจมตี"], ["def", "ป้องกัน"], ["spd", "ความเร็ว"], ["crit", "คริติคอล"]]) {
      const crit = key === "crit", extra = crit ? Math.round((now.crit - bare.crit) * 100) : now[key] - bare[key];
      const dd = el("dd", null, crit ? `${Math.round(now.crit * 100)}%` : fmt(now[key]));
      if (extra > 0) dd.append(el("small", "stat-up", crit ? `+${extra}%` : `+${fmt(extra)}`));
      table.append(el("dt", null, label), dd);
    }
    info.append(lvRow, pair, xpRow, table);
    if (def.passive) info.append(el("p", "codex-passive", `ติดตัว · ${def.passive.text}`));
    // the rest sits behind tabs, one at a time, so the sheet fits the screen
    const panes = [["item", "ไอเทม", () => [itemPane(c, id)]], ["skills", "สกิล", () => def.skills.map((skill, n) => {
      const row = el("div", "sheet-skill");
      row.append(el("span", "sheet-skill-icon", skill.icon), el("b", null, `สกิล ${n + 1} · ${skill.name}`), el("p", null, E.describe(skill)));
      return row;
    })]];
    if (E.bondsOf(id).length) panes.push(["bonds", "ความสัมพันธ์", () => [bondSheet(id)]]);
    if (owned) panes.push(["costume", "คอสตูม", () => [costumePane(c, id)]]);
    panes.push(["story", "ประวัติ", () => [el("p", "codex-story", def.text)]]);
    const big = [["awake", "อัปดาว", () => [owned ? awakePane(c, id) : el("p", "gear-note", "ได้การ์ดนี้ก่อน จึงอัปดาวได้")]], ["enhance", "เสริมแกร่ง", () => [gearPane(c, id)]], ["reforge", "หลอมล้าง", () => [reforgePane(c, id)]]];
    const every = [...panes, ...big];
    if (!every.some(([key]) => key === sheetTab)) sheetTab = "skills";
    const chips = el("div", "sheet-tabs codex-chips"), pane = el("div", "sheet-pane codex-pane"), actions = el("div", "codex-actions");
    chips.setAttribute("role", "tablist");
    const buttons = [];
    let openedAt = 0;
    const pick = (key) => {
      sheetTab = key;
      openedAt = performance.now();
      for (const t of buttons) { const on = t.dataset.key === key; t.classList.toggle("is-on", on); t.setAttribute("aria-selected", String(on)); }
      pane.replaceChildren(...every.find(([k]) => k === key)[2]());
    };
    for (const [key, label] of panes) {
      const t = button("sheet-tab", label, () => { pick(key); tone(587, .04, "triangle", .03); });
      t.dataset.key = key; t.setAttribute("role", "tab");
      chips.append(t); buttons.push(t);
    }
    // a gold button opens its pane; pressed again with the pane open, it
    // does what the pane offers (star up, enhance the picked piece, reforge)
    const act = {
      awake: () => (awakeReady(c, id) ? (awakenCard(id), true) : false),
      enhance: () => (gearCanUp(c, id, gearSlot) ? (enhance(id, gearSlot, 1), true) : false),
      reforge: () => (gearCanReforge(c, id, gearSlot) ? (reforge(id, gearSlot), true) : false)
    };
    for (const [key, label] of big) {
      const t = button("codex-btn codex-big", label, () => {
        if (sheetTab === key && performance.now() - openedAt > 400) {
          if (act[key]()) return;
          tone(150, .12, "square", .05);
          pane.classList.remove("is-nudge"); void pane.offsetWidth; pane.classList.add("is-nudge");
          announce(key === "awake" ? "ยังอัปดาวไม่ได้ ดูเงื่อนไขในกรอบด้านบน" : key === "enhance" ? "ยังเสริมแกร่งไม่ได้ ดูเงื่อนไขในกรอบด้านบน" : "ยังหลอมล้างไม่ได้ ดูเงื่อนไขในกรอบด้านบน");
          return;
        }
        pick(key); tone(587, .04, "triangle", .03);
      });
      t.dataset.key = key; t.setAttribute("role", "tab");
      if ((key === "awake" && awakeReady(c, id)) || (key === "reforge" && E.GEAR_SLOTS.some((_, n) => gearCanReforge(c, id, n)))) t.append(el("i", "codex-dot"));
      actions.append(t); buttons.push(t);
    }
    pick(sheetTab);
    team.prepend(el("p", "codex-tags", cardTags(id).join(" / ")));
    detail.append(stars, stage, title, team, info, chips, pane, actions);
    const book = el("div", "codex");
    book.append(codexList(c, id), detail);
    openSheet([book], "is-codex", !same);
    sheet.dataset.card = id;
    const list = sheet.querySelector(".codex-list");
    if (listTop != null) list.scrollTop = listTop;
    else list.querySelector(".is-on")?.scrollIntoView({ block: "center" });
    sheet.dataset.pane = `${sheetTab}:${gearSlot}`;
    if (tops) SHEET_SCROLLERS.forEach((sel, k) => {
      const node = sheet.querySelector(sel);
      if (node && (sel !== ".codex-pane" || samePane)) node.scrollTop = tops[k];
    });
    // a piece just put on: glide back up to it so it shows it took
    const on = worn && sheet.querySelector(".item-pane .item-on")?.closest(".item-row");
    if (on) {
      on.classList.add("is-new");
      on.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function enhance(id, n, times = 1) {
    const c = cards();
    let coins = save().coins, done = 0;
    for (; done < times; done++) {
      const left = E.enhanceGear(c, id, n, coins);
      if (left == null) break;
      coins = left;
    }
    if (!done) { tone(150, .12, "square", .05); return; }
    save().coins = coins;
    store(); showCoins();
    [659, 784, 988].forEach((note, i) => tone(note, .08, "triangle", .05, i * .05));
    announce(`${E.GEAR_SLOTS[n].name}ของ${E.CARDS[id].name} เลเวล ${E.gearOf(c, id, n).lv}`);
    cardSheet(id);
  }
  function reforge(id, n) {
    const c = cards(), left = E.reforgeGear(c, id, n, save().coins);
    if (left == null) { tone(150, .12, "square", .05); return; }
    save().coins = left;
    store(); showCoins();
    [523, 659, 784, 1047, 1319].forEach((note, i) => tone(note, .12, "triangle", .06, i * .08));
    announce(`${E.GEAR_SLOTS[n].name}ของ${E.CARDS[id].name} หลอมล้างเป็นขั้น${E.GEAR_TIERS[E.gearOf(c, id, n).tier - 1].name}`);
    cardSheet(id);
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

  // The formation's next row back from a slot's (the back row's next is
  // the front), or null when the formation has one row only.
  function nextRow(form, slot) {
    const rows = E.ROWS.filter(row => form.cells.some((_, n) => E.formCell(form, n).row === row));
    const at = rows.indexOf(E.formCell(form, slot).row);
    return rows.length > 1 ? rows[(at + 1) % rows.length] : null;
  }
  // Swap the card into the next row, trading places if that row is full.
  function moveRow(id) {
    const c = cards(), team = c.team, from = team.indexOf(id), form = E.formOf(c), row = nextRow(form, from);
    if (from < 0 || !row) return;
    const range = [0, 1, 2, 3, 4].filter(n => E.formCell(form, n).row === row);
    const to = range.find(n => !team[n]) ?? range[0];
    [team[from], team[to]] = [team[to], team[from]];
    store();
    tone(587, .06, "triangle", .04);
    cardSheet(id);
  }

  function buyWings(id) {
    if ((save().gems || 0) < E.WING_PRICE) { tone(150, .12, "square", .05); return; }
    save().gems -= E.WING_PRICE;
    cards().wings += 1;
    store(); showCoins();
    tone(880, .1, "triangle", .05);
    announce(`แลกปีกอัพดาว 1 ชิ้น มีแล้ว ${cards().wings} ชิ้น`);
    cardSheet(id);
  }
  function awakenCard(id) {
    const c = cards(), left = E.awaken(c, id, save().coins);
    if (left == null) { tone(150, .12, "square", .05); return; }
    save().coins = left;
    E.giveXp(c, id, 0); // XP waiting at the old cap counts now
    store(); showCoins();
    [523, 659, 784, 1047, 1319].forEach((note, i) => tone(note, .12, "triangle", .06, i * .08));
    announce(c.awake[id] > E.MAX_AWAKE ? `${E.CARDS[id].name} ปลุกพลังขั้น 2 ดาวทอง ${c.awake[id] - E.MAX_AWAKE} ดวง เลเวลสูงสุด ${E.capFor(c.awake[id])}` : `${E.CARDS[id].name} อัปเป็นดาวแดง ${c.awake[id]} ดวง เลเวลสูงสุด ${E.capFor(c.awake[id])}`);
    cardSheet(id);
  }

  function levelUp(id) {
    const c = cards(), lv = c.units[id], cost = E.levelCost(lv);
    if (lv >= E.capFor(c.awake[id]) || save().coins < cost) { tone(150, .12, "square", .05); return; }
    save().coins -= cost;
    c.units[id] = lv + 1;
    questTick("level");
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
      ? `รางวัลผ่านครั้งแรก: ● ${stage.coins} + 💎 ${stage.gems}${stage.dust ? ` + ✧ ผลึกดาว ${stage.dust}` : ""}${stage.wings ? ` + 🪽 ปีกอัพดาว ${stage.wings}` : ""}`
      : `รางวัลเล่นซ้ำ: ● ${stage.repeat}`;
    parts.push(reward, el("p", "sheet-goals", `★ ชนะ · ★ ไม่มีการ์ดล้ม · ★ ชนะภายใน ${stage.par} เทิร์น`));
    const team = el("div", "sheet-team");
    const favs = E.favsOf(stage);
    for (const id of c.team) {
      if (!id) { team.append(el("span", "cards-empty is-flat", "–")); continue; }
      const tile = cardTile(id, () => { tab = "team"; cardSheet(id); });
      if (favs.includes(id)) tile.append(el("span", "tcard-fav", "⭐ แนะนำ"));
      team.append(tile);
    }
    const boost = E.favAtk(c.team, stage);
    parts.push(el("p", "sheet-sub", `ทีมของคุณ · พลังทีม ${fmt(teamPower())}${boost ? ` · ⭐ โจมตี +${pct(boost)} ในด่านนี้` : ""}`), setStrip(() => stageSheet(stage), true), team);
    const fav = favStrip(stage, () => stageSheet(stage));
    if (fav) parts.push(fav);
    const actions = el("div", "title-actions sheet-actions");
    actions.append(button("primary-button", "เริ่มต่อสู้ ⚔", () => startBattle(stage)), button("secondary-button", "จัดทีม", () => { tab = "team"; closeSheet(); }));
    parts.push(actions);
    openSheet(parts);
  }

  // ---- Battle ----
  // ranked: a ranked raid run from the server ({ runId, seed, team, ... }),
  // fought with its team and seed so the server can replay it
  function startBattle(stage, ranked = null) {
    const c = cards();
    if (!c.team.some(Boolean)) return;
    if (stage.dungeon && doneToday(stage.dungeon)) { tone(150, .12, "square", .05); announce("ด่านนี้ผ่านแล้ววันนี้ มาใหม่พรุ่งนี้"); return; }
    closeSheet(true);
    stopMap();
    mapChapter = 0; // back from battle, the map follows the next stage
    const team = ranked ? ranked.team : stage.arena ? E.arenaTeam(c) : E.fielded(c);
    const state = E.createBattle({ team, stage, seed: ranked ? ranked.seed : (Date.now() ^ (Math.random() * 1e9)) >>> 0 });
    battle = { stage, state, queue: [], token: {}, go: null, hint: "", busy: false, quitArmed: 0, raid: stage.raid ? { score: 0, end: 0, over: false, quit: false, sec: -1, shown: 0, turns: [], ranked, why: "" } : null };
    frame.classList.add("is-battle");
    frame.classList.toggle("is-arena", Boolean(stage.arena));
    buildBattle();
    tone(392, .1, "triangle", .05); tone(523, .12, "triangle", .05, .1);
    announce((stage.arena ? `เริ่ม${stage.name}` : stage.raid ? `เริ่มตีมังกร ${stage.time} วินาที` : `เริ่มด่าน ${stage.num} ${stage.name}`) + (state.bonds.length ? ` · ความสัมพันธ์ ${state.bonds.map(b => b.name).join(" ")}` : "") + (state.favs?.atk ? ` · ตัวละครแนะนำ โจมตี +${Math.round(state.favs.atk * 100)}%` : ""));
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
    // the raid keeps a pace of its own, the same for everyone
    fast.hidden = Boolean(v.raid);
    top.append(v.title, v.wave, auto, fast, quit);
    const field = el("div", "battle-field");
    v.foeSide = el("div", "battle-side is-foes");
    v.heroSide = el("div", "battle-side is-heroes");
    field.append(v.heroSide, v.foeSide);
    v.banner = el("div", "battle-banner");
    v.banner.setAttribute("aria-hidden", "true");
    v.cutin = el("div", "battle-cutin");
    v.cutin.setAttribute("aria-hidden", "true");
    v.finale = el("div", "battle-finale");
    v.finale.setAttribute("aria-hidden", "true");
    field.append(v.banner, v.cutin, v.finale);
    if (v.raid) field.append(raidHud(v));
    if (v.state.bonds?.length || v.state.favs?.atk) {
      const strip = el("div", "battle-bonds");
      if (v.state.favs?.atk) strip.append(el("span", "is-fav", `⭐ ตัวแนะนำ ×${Math.round(v.state.favs.atk / E.FAV_ATK)} · โจมตี +${Math.round(v.state.favs.atk * 100)}%`));
      for (const bond of v.state.bonds || []) strip.append(el("span", null, `${bond.icon} ${bond.name} +${Math.round(bond.atk * 100)}%`));
      field.append(strip);
    }
    v.hintLine = el("p", "battle-hint");
    v.hintLine.setAttribute("aria-live", "polite");
    v.bar = el("div", "battle-bar");
    v.result = el("div", "battle-result");
    v.result.hidden = true;
    view.append(top, field, v.hintLine, v.bar, v.result);
    body.replaceChildren(view);
    freshen(view);
    v.tiles = { hero: [], foe: [] };
    stopShow();
    show = window.PupaCardsFx?.create(field, { chapter: v.stage.scene || (v.stage.tower ? v.stage.chapter : Math.min(16, Math.ceil(v.stage.num / 10))) }) || null;
    show?.follow(() => [...v.tiles.hero, ...v.tiles.foe].filter(Boolean).map(tile => ({ el: tile, stun: tile.status?.includes("stun"), burn: tile.status?.includes("burn"), taunt: tile.status?.includes("taunt") })));
    drawSide("hero");
    drawSide("foe");
    drawTop();
    drawBar();
  }

  function drawTop() {
    const v = battle, b = v.state;
    v.title.textContent = v.stage.raid ? `${v.stage.pumpkin ? "🎃" : "🐉"} ด่านประจำวัน · ตีมังกร${v.raid?.ranked ? " · 🏆 จัดอันดับ" : ""}` : v.stage.tower ? `🗼 ${v.stage.name}` : v.stage.arena ? `⚔ ${v.stage.name} · 10 vs 10` : v.stage.dungeon ? `${E.DUNGEONS[v.stage.dungeon].icon} ด่านประจำวัน · ${v.stage.name}` : `ด่าน ${v.stage.num} · ${v.stage.name}`;
    v.wave.textContent = b.raid ? `ระยะที่ ${b.raid.phase} · เทิร์น ${Math.max(1, b.turn)}` : `คลื่น ${b.wave + 1}/${b.waves.length} · เทิร์น ${Math.max(1, b.turn)}`;
    v.auto.setAttribute("aria-pressed", String(cards().auto));
    v.fast.setAttribute("aria-pressed", String(cards().fast));
  }

  // Where each fighter stands, as a share of the field: heroes on the
  // left facing right, monsters on the right, front rows near the middle.
  // y is where the feet touch the ground.
  // (a formation's middle row between; its lanes top to bottom, see E.formCell)
  const STAND_X = { hero: { front: 37, middle: 26, back: 15 }, foe: { front: 63, middle: 74, back: 85 } };
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
    for (const row of ["back", "middle", "front"]) {
      const inRow = list.filter(u => u && u.row === row);
      // a formation's lanes, if every card in the row has one
      const lanes = inRow.length && inRow.length <= 3 && inRow.every(u => u.lane != null);
      inRow.forEach((u, n) => {
        const i = list.indexOf(u);
        const tile = side === "foe" ? button("unit is-foe", null, () => setFocus(i)) : el("div", "unit");
        if (u.boss) tile.classList.add("is-boss");
        const crowd = inRow.length > 3;
        const y = lanes ? standAt(3, u.lane) : crowd ? standAt(Math.ceil(inRow.length / 2), Math.floor(n / 2)) + (n % 2) * 4 : standAt(inRow.length, n);
        const shift = lanes ? (u.lane === 1 ? 3 : -3) * (row === "middle" ? 0 : 1) : crowd ? (n % 2 ? 6 : -6) : inRow.length > 2 ? (n % 2 ? 3 : -3) : 0;
        tile.style.left = `${STAND_X[side][row] + (shift || 0) * (side === "hero" ? 1 : -1)}%`;
        if (crowd) tile.classList.add("is-crowd");
        tile.style.top = `${y}%`;
        tile.style.zIndex = String(Math.round(y));
        tile.style.setProperty("--depth", String(.82 + y / 500));
        const art = el("span", "unit-art");
        art.append(side === "foe" ? foeArt(u.id) : portrait(u.id));
        const head = el("span", "unit-head");
        const hp = el("span", "unit-hp");
        hp.append(el("i", "unit-hp-lag"), el("i", "unit-hp-fill"), el("i", "unit-hp-shield"));
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
    // the health just lost lingers a moment as a pale chunk
    tile.querySelector(".unit-hp-lag").style.width = `${fill * 100}%`;
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
    // a raid runs until its clock stops, then goes on to its results
    const running = v.raid ? !v.raid.over && v.state.phase !== "done" : v.state.phase !== "done";
    if (running && Date.now() - v.quitArmed > 2500) {
      v.quitArmed = Date.now();
      v.quit.textContent = v.raid ? "จบรอบ?" : "ออกจริง?";
      setTimeout(() => { if (battle === v) v.quit.textContent = "ออก"; }, 2500);
      tone(330, .08, "square", .04);
      announce(v.raid ? "กดอีกครั้งเพื่อจบรอบ รับทองตามคะแนนที่ทำได้" : "กดออกอีกครั้งเพื่อยอมแพ้และกลับ");
      return;
    }
    // the raid: the run ends here and is paid for its score
    if (v.raid && running) { v.raid.quit = true; endRaid(v); return; }
    if (v.raid && v.result.hidden) return;
    v.token.stopped = true;
    battle = null;
    tab = v.stage.tower ? "tower" : v.stage.arena ? "arena" : v.stage.dungeon || v.stage.raid ? "daily" : "stages";
    showHub();
  }

  // How long each thing shows: the engine's numbers, which the server
  // also uses to replay a ranked raid run within its clock.
  const speed = () => (battle?.raid ? E.RAID_PACE : cards().fast ? .45 : 1);
  const DELAY = E.EVENT_DELAY;

  async function runBattle(v) {
    const b = v.state;
    // the opening call: a warning when a boss is waiting
    const bossFirst = b.foes.some(u => u?.boss);
    if (v.raid) banner(`⏱ ตีมังกรให้ได้มากที่สุดใน ${v.stage.time} วินาที!`, "boss");
    else banner(bossFirst ? "⚠ บอสปรากฏตัว!" : "เริ่มต่อสู้!", bossFirst ? "boss" : "start");
    await wait((bossFirst ? 1100 : 750) * speed());
    if (v.raid && !v.raid.over && !v.token.stopped) startRaidClock(v);
    while (b.phase !== "done" && !v.token.stopped && !v.raid?.over) {
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
        // (the raid's clock gets no pause here: the server's replay has none)
        await wait((v.raid ? 0 : 350) * speed());
        if (v.token.stopped) return;
        queue = cards().auto ? E.autoQueue(b) : await new Promise(resolve => { v.go = resolve; drawBar(); });
      } else {
        hint("เทิร์นของคุณ · แตะสกิลตามลำดับที่อยากใช้ แตะมอนสเตอร์เพื่อเล็งเป้า แล้วกด ลุย!");
        queue = await new Promise(resolve => { v.go = resolve; drawBar(); });
      }
      if (v.token.stopped) return;
      if (v.raid?.over) break;
      v.busy = true;
      v.queue = queue;
      drawBar();
      // the raid keeps its turns, for a ranked run's replay on the server
      if (v.raid) v.raid.turns.push({ q: queue.map(({ i, s }) => ({ i, s })), f: b.focus });
      await play(v, E.heroTurn(b, queue, b.focus));
    }
    if (v.token.stopped) return;
    if (v.raid) { stopRaidClock(v); await finale(v, true, v.raid.quit ? "จบรอบ" : b.result === "lost" ? "ทีมล้มหมด!" : "หมดเวลา!"); }
    else await finale(v, b.result === "won");
    if (!v.token.stopped && battle === v) finish(v);
  }

  // The battle's last word, big across the field, before the results.
  async function finale(v, won, text) {
    if (!v.finale) return;
    v.finale.replaceChildren(el("b", null, text || (won ? "ชัยชนะ!" : "พ่ายแพ้…")));
    hint(text || (won ? "ชนะแล้ว!" : "แพ้แล้ว ลองจัดทีมใหม่ดูนะ"));
    v.finale.className = `battle-finale ${won ? "is-won" : "is-lost"}`;
    void v.finale.offsetWidth;
    v.finale.classList.add("is-on");
    if (won) { show?.confetti(); [523, 659, 784, 1047].forEach((note, n) => tone(note, .14, "triangle", .05, n * .09)); }
    else [392, 330, 262].forEach((note, n) => tone(note, .18, "triangle", .04, n * .14));
    await wait(1300 * speed());
    v.finale.classList.remove("is-on");
  }

  // A big skill: the fighter's picture and the skill's name sweep across
  // the field. Returns how long it runs.
  const CUTIN_MS = E.CUTIN_MS;
  function cutIn(v, u, side, skill) {
    if (!v.cutin || calm()) return 0;
    const art = el("span", "cutin-art");
    art.append(side === "foe" ? foeArt(u.id) : portrait(u.id));
    const words = el("span", "cutin-words");
    words.append(el("small", null, side === "foe" ? "สกิลบอส" : `สกิลพิเศษ · ${u.name}`), el("b", null, `${skill.icon ? `${skill.icon} ` : ""}${skill.name}`));
    v.cutin.replaceChildren(el("span", "cutin-band"), art, words);
    const time = CUTIN_MS * speed();
    v.cutin.style.setProperty("--time", `${Math.round(time)}ms`);
    v.cutin.className = `battle-cutin is-${side}${side === "hero" && skinOf(u.id) === "halloween" ? " is-halloween" : ""}`;
    void v.cutin.offsetWidth;
    v.cutin.classList.add("is-on");
    setTimeout(() => v.cutin.classList.remove("is-on"), time);
    return time;
  }
  const calm = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

  // Animate what happened, one event at a time.
  async function play(v, events) {
    // spooky: the one acting wears its Halloween costume (cards-fx.js draws it so)
    let look = "slash", spooky = false;
    for (const [index, ev] of events.entries()) {
      // the raid: only what is shown before time runs out counts
      if (v.token.stopped || v.raid?.over) return;
      if (v.raid) v.raid.shown++;
      const side = ev.side, tile = side ? v.tiles[side]?.[ev.i] : null;
      if (v.raid && side === "foe" && (ev.t === "hit" || ev.t === "burn")) { v.raid.score += ev.v; drawRaid(v); }
      switch (ev.t) {
        case "turn": drawTop(); break;
        case "act": {
          const u = (side === "hero" ? v.state.heroes : v.state.foes)[ev.i];
          const skill = ev.s >= 0 ? u?.skills?.[ev.s] : null;
          spooky = side === "hero" && Boolean(u) && skinOf(u.id) === "halloween";
          // a hero's second skill and every boss skill get the full show
          const big = !v.stage.arena && E.bigAct(v.state, ev);
          let held = big ? cutIn(v, u, side, skill) : 0;
          if (held) tone(side === "hero" ? 659 : 196, .16, "sawtooth", .03);
          // a raid holds as long unseen (reduced motion), to keep its clock
          else if (big && v.raid) held = CUTIN_MS * speed();
          if (held) { await wait(held * E.CUTIN_HOLD); if (v.token.stopped) return; }
          if (tile) { tile.classList.remove("is-acting"); void tile.offsetWidth; tile.classList.add("is-acting"); }
          if (ev.name && !held) banner(ev.name, side, skill?.icon);
          if (u && tile && show) {
            // everyone this action reaches, up to the next action
            look = lookOf(u, ev.s);
            const reached = [];
            for (const next of events.slice(index + 1)) {
              if (["act", "skip", "turn", "status", "wave", "end"].includes(next.t)) break;
              const node = v.tiles[next.side]?.[next.i];
              if (node && next.side !== side && !reached.includes(node)) reached.push(node);
            }
            show.cast(tile, reached, look, side, { skill: ev.s >= 0, big, spooky });
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
          if (tile) { tile.classList.remove("is-hit", "is-crit-hit"); void tile.offsetWidth; tile.classList.add("is-hit"); if (ev.crit) tile.classList.add("is-crit-hit"); }
          if (tile) show?.impact(tile, look, ev.crit, (side === "hero" ? v.state.heroes : v.state.foes)[ev.i]?.boss, spooky);
          pop(tile, fmt(ev.v), ev.crit ? "is-crit" : "is-dmg", ev.crit ? "คริติคอล!" : null);
          tone(ev.crit ? 180 : 140, .07, "square", ev.crit ? .06 : .04);
          if (ev.ko) { tone(110, .25, "sawtooth", .05); const u = (side === "hero" ? v.state.heroes : v.state.foes)[ev.i]; if (u) announce(`${u.name} ล้มแล้ว`); }
          break;
        case "heal": paintUnit(side, ev.i, ev.u); if (tile) show?.heal(tile, look === "leaf", spooky); if (ev.v > 0) { pop(tile, `+${fmt(ev.v)}`, "is-heal"); tone(880, .08, "sine", .04); } break;
        case "shield": paintUnit(side, ev.i, ev.u); if (tile) show?.shield(tile, spooky); pop(tile, "เกราะ", "is-shield"); break;
        case "fx": paintUnit(side, ev.i, ev.u); if (tile && ["atkUp", "defUp", "defDown"].includes(ev.k)) show?.buff(tile, ev.k === "defDown", spooky); if (ev.k === "stun") pop(tile, "มึนงง", "is-miss"); else if (ev.k === "cleanse") pop(tile, "ล้างสถานะ", "is-heal"); break;
        case "burn": paintUnit(side, ev.i, ev.u); if (tile) show?.impact(tile, "fire", false, false); pop(tile, `🔥${fmt(ev.v)}`, "is-burn"); break;
        case "status": paintUnit(side, ev.i, ev.u); break;
        case "rise":
          drawSide("foe"); drawTop(); show?.wave();
          if (v.tiles.foe[ev.i]) v.tiles.foe[ev.i].classList.add("is-arriving");
          banner(`🐉 มังกรฟื้นคืนชีพ! ระยะที่ ${ev.n} · แกร่งขึ้น`, "boss");
          announce(`มังกรฟื้นคืนชีพ ระยะที่ ${ev.n}`);
          [262, 330, 392, 523].forEach((note, n) => tone(note, .14, "sawtooth", .035, n * .07));
          break;
        case "wave":
          drawSide("foe"); drawTop(); show?.wave();
          v.tiles.foe.forEach((node, n) => { if (node) { node.style.animationDelay = `${n * 70}ms`; node.classList.add("is-arriving"); setTimeout(() => node.classList.remove("is-arriving"), 1000); } });
          if (v.state.foes.some(u => u?.boss)) { banner(`⚠ คลื่นที่ ${ev.n}/${ev.total} · บอสปรากฏตัว!`, "boss"); await wait(500 * speed()); }
          else banner(`คลื่นที่ ${ev.n}/${ev.total}`, "wave");
          announce(`มอนสเตอร์คลื่นที่ ${ev.n} มาแล้ว`);
          [392, 523, 659].forEach((note, n) => tone(note, .1, "triangle", .05, n * .08));
          break;
        default: break;
      }
      await wait(((DELAY[ev.t] ?? 100) + (ev.t === "hit" && ev.crit ? E.CRIT_DELAY : 0)) * speed());
    }
    if (!v.token.stopped && battle === v) {
      // settle every card on its final numbers
      drawSide("hero");
      if (v.state.phase !== "done") drawSide("foe");
      drawTop();
    }
  }

  // A number jumping off a fighter. Hits in a row fan out rather than
  // pile up on each other.
  const POP_SPREAD = [[0, 0], [20, -10], [-20, -18], [10, -28]];
  function pop(tile, text, kind, label) {
    if (!tile) return;
    const n = el("span", `unit-pop ${kind}`);
    if (label) n.append(el("small", null, label));
    n.append(el("b", null, text));
    const now = performance.now();
    tile.pops = now - (tile.popAt || 0) < 700 ? ((tile.pops || 0) + 1) % POP_SPREAD.length : 0;
    tile.popAt = now;
    const [dx, dy] = POP_SPREAD[tile.pops];
    n.style.setProperty("--dx", `${dx + Math.round((Math.random() - .5) * 10)}px`);
    n.style.setProperty("--dy", `${dy}px`);
    tile.append(n);
    setTimeout(() => n.remove(), 1400);
  }
  function banner(text, side, icon) {
    const v = battle;
    if (!v) return;
    v.banner.replaceChildren(...(icon ? [el("i", null, icon)] : []), el("span", null, text));
    v.banner.className = `battle-banner is-${side}`;
    void v.banner.offsetWidth;
    v.banner.classList.add("is-on");
  }

  // ---- Result ----
  function finish(v) {
    const line = treat(v);
    finishBattle(v);
    const card = line && v.result.querySelector(".message-card");
    if (card) card.insertBefore(el("p", "event-candy", line), card.querySelector(".title-actions"));
  }
  function finishBattle(v) {
    const b = v.state, stage = v.stage, c = cards();
    const won = b.result === "won";
    if (stage.arena) { finishArena(v); return; }
    if (stage.tower) { finishTower(v); return; }
    if (stage.dungeon) { finishDungeon(v); return; }
    if (stage.raid) { finishRaid(v); return; }
    const got = E.starsFor(b, stage);
    const first = won && !isCleared(stage.num);
    let coins = 0, gems = 0, ore = 0, loot = null;
    const xp = E.stageXp(stage, won);
    const ups = shareXp(c.team.filter(Boolean), xp);
    store();
    if (won) {
      coins = first ? stage.coins : stage.repeat;
      if (c.team.includes("pupa")) coins = Math.round(coins * (1 + E.CARDS.pupa.passive.coins));
      if (first) { gems = stage.gems; addGems(gems); c.dust += stage.dust || 0; c.wings += stage.wings || 0; }
      ore = E.stageOre(stage, first);
      c.ore += ore;
      const want = E.stageLoot(stage, first);
      loot = grantLoot(want.count + (Math.random() < want.chance ? 1 : 0), want.luck);
      c.stars[stage.num] = Math.max(c.stars[stage.num] || 0, got);
      questTick("win");
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
      box.append(el("p", "end-reward battle-reward", `ได้รับ ${gems ? `💎 ${gems} · ` : ""}${first && stage.dust ? `✧ ผลึกดาว ${stage.dust} · ` : ""}${first && stage.wings ? `🪽 ${stage.wings} · ` : ""}⛏ แร่ ${ore} · ● ${fmt(coins)}${c.team.includes("pupa") ? " (รวมโบนัส Pupa)" : ""} · EXP ${xp} ต่อการ์ด`));
      if (hasLoot(loot)) box.append(lootRow(loot));
      if (ups.length) box.append(el("p", "battle-ups", `เลเวลอัป! ${ups.join(" · ")}`));
      if (gems) [659, 784, 988, 1319].forEach((note, n) => tone(note, .14, "triangle", .06, .3 + n * .09));
    } else box.append(el("p", null, `${b.turn >= E.MAX_TURNS ? `⏱ หมดเวลา ${E.MAX_TURNS} เทิร์น · ` : ""}ได้ EXP ${xp} ต่อการ์ด${ups.length ? ` · เลเวลอัป! ${ups.join(" · ")}` : ""} · ลองอัปเลเวลการ์ด เปลี่ยนทีม หรือเรียงลำดับสกิลใหม่ แล้วมาลองอีกครั้ง`));
    const actions = el("div", "title-actions");
    const next = E.STAGES[stage.num];
    if (won && next && isOpen(next.num)) actions.append(button("primary-button", "ด่านต่อไป ▶", () => { battle = null; startBattle(next); }));
    actions.append(button(won ? "secondary-button" : "primary-button", "เล่นอีกครั้ง", () => { battle = null; startBattle(stage); }));
    if (!won) actions.append(button("secondary-button", "จัดทีม", () => { battle = null; tab = "team"; showHub(); }));
    actions.append(button("secondary-button", "กลับ", () => { battle = null; tab = "stages"; showHub(); }));
    const bonus = won ? payStarBonus(false) : 0;
    if (bonus) box.append(el("p", "battle-ups star-bonus-line", `🌟 ดาวครบ 5 ด่าน! ได้โบนัส 💎 ${fmt(bonus)} + 🪽 ${E.STAR_WINGS}`));
    box.append(actions);
    v.result.replaceChildren(box);
    v.result.hidden = false;
    freshen(v.result);
    hint("");
    game().tone(won ? 784 : 220, .2, "triangle", .06);
    if (won) [523, 659, 784, 1047].forEach((note, n) => tone(note, .12, "triangle", .05, n * .1));
    announce(won ? `ชนะด่าน ${stage.num} ได้ ${got} ดาว และ ${coins} เหรียญ${gems ? ` และ ${gems} เพชร` : ""}` : "พ่ายแพ้ ลองอีกครั้ง");
    actions.querySelector("button")?.focus();
  }

  // ---- The tower ----
  // A column of floors around the next one; the next floor can be fought,
  // cleared ones replayed for EXP and coins.
  function renderTower(panel) {
    const c = cards(), next = Math.min(E.TOWER_FLOORS, c.tower + 1), done = c.tower >= E.TOWER_FLOORS;
    panel.append(el("p", "cards-intro", `หอคอยบอส ${E.TOWER_FLOORS} ชั้น · ทุกชั้นมีบอส ทุก 10 ชั้นเป็นบอสใหญ่ · ใช้ทีม 5 ใบจากแท็บทีม · ผ่านแล้ว ${c.tower}/${E.TOWER_FLOORS} ชั้น`), setStrip(() => showHub(), true));
    const tower = el("div", "tower");
    const top = Math.min(E.TOWER_FLOORS, next + 4), bottom = Math.max(1, next - 3);
    for (let n = top; n >= bottom; n--) {
      const f = E.towerFloor(n), cleared = n <= c.tower, here = n === next && !done;
      const boss = f.waves[0][0].id;
      const row = el("div", `tower-floor${cleared ? " is-cleared" : here ? " is-next" : " is-locked"}${n % 10 === 0 ? " is-great" : ""}`);
      const art = el("span", "tower-boss"); art.append(foeArt(boss));
      const info = el("div", "tower-info");
      info.append(el("b", null, `ชั้น ${n}${f.zone ? ` · ${f.zone}` : ""}${n % 10 === 0 ? " · บอสใหญ่" : ""}`), el("span", null, `${E.FOES[boss].name} · Lv ${f.lv} · ${f.waves[0].length} ตัว`), el("small", null, cleared ? "ผ่านแล้ว ✓" : `รางวัลครั้งแรก: 💎 ${f.gems} · ✧ ${f.dust}${f.wings ? ` · 🪽 ${f.wings}` : ""} · ⛏ ${f.ore} · ● ${fmt(f.coins)}`));
      row.append(el("span", "tower-num", String(n)), art, info);
      if (here || cleared) {
        const go = button(here ? "primary-button tower-go" : "secondary-button tower-go", here ? "ท้าทาย ⚔" : "สู้อีกครั้ง", () => startBattle(E.towerFloor(n)));
        row.append(go);
      }
      tower.append(row);
    }
    if (done) panel.append(el("p", "sheet-reward", `🏆 พิชิตหอคอยครบ ${E.TOWER_FLOORS} ชั้นแล้ว!`));
    else {
      const fav = favStrip(E.towerFloor(next), () => showHub());
      if (fav) { fav.querySelector(".fav-head b").textContent = `⭐ ตัวละครแนะนำ ชั้น ${next}`; panel.append(fav); }
    }
    panel.append(tower);
  }
  function finishTower(v) {
    const b = v.state, floor = v.stage, c = cards(), won = b.result === "won";
    let loot = null;
    const first = won && floor.num > c.tower;
    const xp = Math.round(floor.xp * (won ? 1 : .3));
    const ups = shareXp(c.team.filter(Boolean), xp);
    if (won) {
      questTick("win");
      save().coins += first ? floor.coins : Math.round(floor.coins / 4);
      if (first) {
        addGems(floor.gems); c.dust += floor.dust; c.wings += floor.wings; c.ore += floor.ore; c.tower = floor.num;
        // a great boss drops two, rare or better
        loot = grantLoot(floor.num % 10 === 0 ? 2 : 1, Math.min(2.5, .5 + floor.num / 75), floor.num % 10 === 0 ? 3 : 1);
      }
    }
    store(); showCoins();
    v.busy = true;
    const box = el("div", "message-card battle-card");
    box.append(el("span", "moon-icon", won ? "🗼" : "☾"), el("h2", null, won ? `ผ่านหอคอยชั้น ${floor.num}!` : "พ่ายแพ้…"));
    box.append(el("p", "end-reward battle-reward", won ? (first ? `ได้รับ 💎 ${floor.gems} · ✧ ${floor.dust}${floor.wings ? ` · 🪽 ${floor.wings}` : ""} · ⛏ แร่ ${floor.ore} · ● ${fmt(floor.coins)} · EXP ${xp} ต่อการ์ด` : `ได้รับ ● ${fmt(Math.round(floor.coins / 4))} · EXP ${xp} ต่อการ์ด (รางวัลครั้งแรกรับไปแล้ว)`) : `ได้ EXP ${xp} ต่อการ์ด · อัปการ์ดหรือเปลี่ยนทีมแล้วลองใหม่`));
    if (hasLoot(loot)) box.append(lootRow(loot));
    if (ups.length) box.append(el("p", "battle-ups", `เลเวลอัป! ${ups.join(" · ")}`));
    const actions = el("div", "title-actions");
    if (won && floor.num < E.TOWER_FLOORS) actions.append(button("primary-button", `ชั้น ${floor.num + 1} ▶`, () => { battle = null; startBattle(E.towerFloor(floor.num + 1)); }));
    actions.append(button(won ? "secondary-button" : "primary-button", "สู้อีกครั้ง", () => { battle = null; startBattle(E.towerFloor(floor.num)); }));
    actions.append(button("secondary-button", "กลับ", () => { battle = null; tab = "tower"; showHub(); }));
    box.append(actions);
    v.result.replaceChildren(box);
    v.result.hidden = false;
    freshen(v.result);
    hint("");
    if (won) [523, 659, 784, 1047, 1319].forEach((note, n) => tone(note, .12, "triangle", .05, n * .1));
    announce(won ? `ผ่านหอคอยชั้น ${floor.num}` : "พ่ายแพ้ในหอคอย");
    actions.querySelector("button")?.focus();
  }

  function finishArena(v) {
    const b = v.state, tier = v.stage, c = cards(), won = b.result === "won";
    const xp = Math.round(tier.xp * (won ? 1 : .3));
    const ups = shareXp(b.heroes.filter(Boolean).map(u => u.id), xp);
    questTick("arena"); if (won) questTick("win");
    let loot = null;
    if (won) {
      save().coins += tier.coins; addGems(tier.gems); c.dust += tier.dust || 0; c.wings += tier.wings || 0; c.ore += tier.ore || 0; c.arena = Math.max(c.arena, tier.num + 1);
      loot = grantLoot(1, Math.min(2, tier.num / 40), tier.boss ? 2 : 1);
    }
    store(); showCoins();
    v.busy = true;
    const box = el("div", "message-card battle-card");
    box.append(el("span", "moon-icon", won ? "✦" : "☾"), el("h2", null, won ? `ผ่านชั้น ${tier.num}!` : "พ่ายแพ้…"));
    box.append(el("p", "end-reward battle-reward", `${won ? `ได้รับ 💎 ${tier.gems} · ✧ ${tier.dust}${tier.wings ? ` · 🪽 ${tier.wings}` : ""} · ⛏ แร่ ${tier.ore} · ● ${fmt(tier.coins)} · ` : ""}EXP ${xp} ต่อการ์ด`));
    if (hasLoot(loot)) box.append(lootRow(loot));
    if (ups.length) box.append(el("p", "battle-ups", `เลเวลอัป! ${ups.join(" · ")}`));
    const actions = el("div", "title-actions");
    if (won) actions.append(button("primary-button", `ชั้น ${tier.num + 1} ▶`, () => { battle = null; startBattle(E.arenaTier(tier.num + 1)); }));
    actions.append(button(won ? "secondary-button" : "primary-button", "สู้อีกครั้ง", () => { battle = null; startBattle(E.arenaTier(c.arena)); }));
    actions.append(button("secondary-button", "กลับ", () => { battle = null; tab = "arena"; showHub(); }));
    box.append(actions);
    v.result.replaceChildren(box);
    v.result.hidden = false;
    freshen(v.result);
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
  function openTeam() { tab = "team"; if (isShown) { closeSheet(true); if (!battle) showHub(); } else open(); }
  function openDaily() { tab = "daily"; if (isShown) { closeSheet(true); if (!battle) showHub(); } else open(); }
  // signing in (or out) on the daily tab redraws the ranking there
  window.addEventListener("pupa-account", () => {
    const node = isShown && !battle && tab === "daily" ? body.querySelector(".raid-ranking") : null;
    if (node && !account()?.state?.busy) drawRanking(node);
  });
  window.PupaCards = { open, openPulls, openTeam, openDaily, close, key, get isOpen() { return isShown; } };
  document.querySelectorAll("[data-open-cards]").forEach(node => game()?.onTap(node, open));
  // Test link: ?cards opens straight into the card battles.
  if (new URLSearchParams(location.search).has("cards")) setTimeout(() => open(), 400);
})();

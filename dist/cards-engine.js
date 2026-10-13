// Card battles (ศึกการ์ดแสงจันทร์): the cards, the monsters, the stages and
// the turn-by-turn rules. Nothing here touches the page, so the same file
// runs in the game (window.PupaCardsEngine) and in Node for the balance
// checks (require("./cards-engine.js")). cards.js draws it all.
//
// A battle is five cards against waves of monsters. Each hero turn the
// player picks skills in the order they should go off; every hero that was
// not given a skill makes a plain attack. Then each monster acts. Skills
// have cooldowns counted in the owner's turns. Slots 0-1 are the front row,
// 2-4 the back row: monsters hit the front row more often.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaCardsEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // A card's level cap: 30, and 10 more for each star it has been raised
  // (awakened) to: MAX_AWAKE red stars, then for S and SSS cards a second
  // awakening of five gold stars, up to MAX_AWAKE2 in all (see awaken below).
  const MAX_AWAKE = 5;
  const MAX_AWAKE2 = 10;
  const BASE_CAP = 30;
  const MAX_LEVEL = BASE_CAP + 10 * MAX_AWAKE2;
  const capFor = (awake = 0) => BASE_CAP + 10 * Math.max(0, Math.min(MAX_AWAKE2, awake));
  const TEAM_SIZE = 5;
  const MAX_TURNS = 99;
  const FRONT_SLOTS = 2;
  // Stats grow by a tenth of the level-1 value per level.
  const growth = (lv) => 1 + .1 * (lv - 1);
  // Coins to go from lv to lv + 1.
  const levelCost = (lv) => 5 * lv + 10;

  const ROLES = {
    attack: { name: "โจมตี", icon: "⚔", hp: 900, atk: 110, def: 45, spd: 100, crit: .15 },
    magic: { name: "เวทมนตร์", icon: "✦", hp: 780, atk: 122, def: 36, spd: 96, crit: .1 },
    defense: { name: "ป้องกัน", icon: "⛨", hp: 1350, atk: 72, def: 78, spd: 84, crit: .05 },
    support: { name: "สนับสนุน", icon: "✚", hp: 920, atk: 86, def: 50, spd: 106, crit: .05 },
    balance: { name: "สมดุล", icon: "◆", hp: 1020, atk: 96, def: 56, spd: 95, crit: .1 }
  };
  // Keeps fights short: about half a role's listed hp.
  const HP_SCALE = .5;
  // Card grades, rarity 1 to 6: D C B A S SSS. Rarer cards start stronger.
  const GRADES = { 1: "D", 2: "C", 3: "B", 4: "A", 5: "S", 6: "SSS" };
  const RARITY = { 1: 1, 2: 1.03, 3: 1.1, 4: 1.14, 5: 1.25, 6: 1.4 };

  // Skill fields: cd (turns between uses), first (turns to wait at the
  // start of a battle), target, power (damage as a share of ATK), hits (for
  // "random"), heal and shield (as a share of ATK), drain (share of the
  // damage healed back) and fx, effects put on the targets or, with on,
  // on "self" or "allies".
  // Targets: one, front, back, all, random (enemies); ally (the most hurt
  // friend), allies, self.
  // Effects: stun (skips a turn, with a chance), burn (damage at the end of
  // each of its turns), atkUp, defUp, defDown, taunt (single attacks must
  // aim at this one), cleanse (clears stun, burn and defDown).
  const CARDS = {
    pupa: {
      name: "Pupa", role: "balance", rarity: 2, art: "pupa", from: "hero",
      text: "ดักแด้ไหมชมพู ตัวเอกของสวนเชอร์รี่",
      passive: { coins: .15, text: "เสน่ห์เหรียญทอง: เหรียญรางวัลจากด่าน +15%" },
      skills: [
        { name: "ไหมชมพูพันรัด", icon: "🎀", cd: 3, target: "one", power: 1.5, fx: [{ k: "stun", chance: .6, turns: 1 }] },
        { name: "รังไหมแสงจันทร์", icon: "🌙", cd: 4, first: 1, target: "allies", shield: 1.2, fx: [{ k: "shield", turns: 2 }] }
      ]
    },
    jibjib: {
      name: "จิ๊บจิ๊บแมน", role: "attack", rarity: 2, art: "jibjib", from: "hero",
      text: "ลูกเจี๊ยบนักผจญภัย ผ้าพันคอแดงปลิวไสว",
      passive: { double: .3, text: "ปีกกระพือ: โจมตีปกติมีโอกาส 30% ตีซ้ำอีกครั้ง" },
      skills: [
        { name: "จิกรัว", icon: "🐤", cd: 3, target: "random", hits: 3, power: .7 },
        { name: "ปีกพายุ", icon: "🌪", cd: 4, first: 1, target: "all", power: .9 }
      ]
    },
    baitoey: {
      name: "ใบเตย", role: "support", rarity: 3, art: "baitoey", from: "hero",
      text: "สาวน้อยภูตใบไม้ ผมใบเตยปลิวตามลม",
      skills: [
        { name: "ใบเตยเยียวยา", icon: "🌿", cd: 3, target: "allies", heal: 1.3 },
        { name: "ม่านใบไม้ร่อน", icon: "🍃", cd: 5, first: 2, target: "allies", shield: 1.6, fx: [{ k: "shield", turns: 2 }, { k: "cleanse" }] }
      ]
    },
    ikuya: {
      name: "อิคุยะ", role: "attack", rarity: 4, art: "ikuya", from: "hero", crit: .3,
      text: "หนุ่มน้อยนักสู้ผมขาว ผ้าพันคอฟ้าคราม",
      passive: { text: "สายตานักสู้: โอกาสคริติคอล 30%" },
      skills: [
        { name: "หมัดคลื่นลม", icon: "💨", cd: 3, target: "front", power: 1.7 },
        { name: "พายุจันทร์เสี้ยว", icon: "🌙", cd: 5, first: 2, target: "all", power: 1.4, fx: [{ k: "defDown", v: .3, turns: 2 }] }
      ]
    },
    pangji: {
      name: "ปังจิ", role: "defense", rarity: 3, art: "pangji", from: "hero",
      text: "น้องซาลาเปาเนื้อนุ่ม ยิ้มหวานทั้งวัน",
      passive: { shield: .3, text: "ซาลาเปานุ่มนิ่ม: เริ่มการต่อสู้พร้อมเกราะ 30% ของพลังชีวิต" },
      skills: [
        { name: "ซาลาเปาตัวโต", icon: "🥟", cd: 4, target: "self", shield: 1.5, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }, { k: "defUp", v: .4, turns: 2 }] },
        { name: "ไอร้อนซาลาเปา", icon: "♨", cd: 5, first: 1, target: "all", power: .8, fx: [{ k: "stun", chance: .35, turns: 1 }] }
      ]
    },
    pupav2: {
      name: "Pupa V2", role: "magic", rarity: 5, art: "pupav2", from: "hero",
      text: "Pupa ร่างใหม่ ผมยาวสีกุหลาบ ชุดนักผจญภัยสีเขียว",
      skills: [
        { name: "สายฟ้าสีกุหลาบ", icon: "⚡", cd: 3, target: "one", power: 2.6, fx: [{ k: "stun", chance: .4, turns: 1 }] },
        { name: "พายุกุหลาบสายฟ้า", icon: "🌹", cd: 5, first: 2, target: "all", power: 1.7, fx: [{ k: "burn", power: .35, turns: 2 }] }
      ]
    },
    firefly: {
      name: "หิ่งห้อยน้อย", role: "support", rarity: 1, art: "firefly", from: "pet",
      text: "แสงอุ่น ๆ ที่คอยดูแลเพื่อน",
      skills: [
        { name: "แสงอุ่น", icon: "✨", cd: 3, target: "ally", heal: 2.6 },
        { name: "แสงนำทาง", icon: "💡", cd: 4, first: 1, target: "allies", fx: [{ k: "atkUp", v: .3, turns: 2 }] }
      ]
    },
    kitten: {
      name: "ลูกแมวเชอร์รี่", role: "attack", rarity: 1, art: "kitten", from: "pet",
      text: "ลูกแมวซนกรงเล็บคม",
      skills: [
        { name: "ข่วนเชอร์รี่", icon: "🐾", cd: 3, target: "one", power: 1.9 },
        { name: "ข่วนรัวพายุ", icon: "🍒", cd: 4, first: 1, target: "random", hits: 4, power: .65 }
      ]
    },
    minibat: {
      name: "ค้างคาวจิ๋ว", role: "magic", rarity: 3, art: "minibat", from: "pet",
      text: "ค้างคาวตัวน้อยผู้พิทักษ์ราตรี",
      skills: [
        { name: "เขี้ยวดูดพลัง", icon: "🦇", cd: 3, target: "one", power: 1.7, drain: .5 },
        { name: "คลื่นเสียงราตรี", icon: "🔊", cd: 4, first: 1, target: "back", power: 1.5, fx: [{ k: "defDown", v: .25, turns: 2 }] }
      ]
    },
    starsprite: {
      name: "ภูตดาว", role: "defense", rarity: 3, art: "starsprite", from: "pet",
      text: "ภูตดวงดาวผู้กางเกราะให้ทุกคน",
      skills: [
        { name: "เกราะดวงดาว", icon: "⭐", cd: 3, target: "allies", shield: 1.3, fx: [{ k: "shield", turns: 2 }] },
        { name: "ดาวตกคุ้มภัย", icon: "🌠", cd: 5, first: 1, target: "all", power: 1.1, fx: [{ k: "defUp", v: .3, turns: 2, on: "allies" }] }
      ]
    },
    dragon: {
      name: "มังกรน้อยเปลวแสง", role: "magic", rarity: 5, art: "dragon", from: "pet",
      text: "มังกรน้อยพ่นไฟสีทอง",
      skills: [
        { name: "ลมหายใจเพลิง", icon: "🔥", cd: 3, target: "front", power: 1.6, fx: [{ k: "burn", power: .4, turns: 2 }] },
        { name: "อัคคีมังกรสวรรค์", icon: "🐉", cd: 5, first: 2, target: "all", power: 1.9, fx: [{ k: "burn", power: .4, turns: 2 }] }
      ]
    }
  };
  // The second set: heroes and pets found only in card pulls.
  Object.assign(CARDS, {
    sakura: {
      name: "ซากุระ", role: "attack", rarity: 4, art: "sakura", from: "hero",
      text: "นินจาสาวแห่งดอกซากุระ ใบมีดคู่ไวดั่งลม",
      skills: [
        { name: "ใบมีดซากุระ", icon: "🌸", cd: 3, target: "random", hits: 4, power: .62 },
        { name: "พายุกลีบซากุระ", icon: "🌪", cd: 5, first: 2, target: "all", power: 1.3, fx: [{ k: "defDown", v: .2, turns: 2 }] }
      ]
    },
    chantra: {
      name: "จันทรา", role: "support", rarity: 5, art: "chantra", from: "hero",
      text: "นักบวชแห่งจันทร์เต็มดวง แสงของเธอรักษาทุกบาดแผล",
      skills: [
        { name: "แสงจันทร์โอบอุ้ม", icon: "🌕", cd: 3, target: "allies", heal: 1.6, fx: [{ k: "cleanse" }] },
        { name: "พรแห่งจันทร์เต็มดวง", icon: "✨", cd: 5, first: 1, target: "allies", shield: 1.2, fx: [{ k: "shield", turns: 2 }, { k: "atkUp", v: .35, turns: 2 }] }
      ]
    },
    thongkham: {
      name: "ทองคำ", role: "defense", rarity: 4, art: "thongkham", from: "hero",
      text: "อัศวินน้อยเกราะทอง โล่ใหญ่ของเขาไม่เคยแตก",
      passive: { shield: .2, text: "เกราะทองคำ: เริ่มการต่อสู้พร้อมเกราะ 20% ของพลังชีวิต" },
      skills: [
        { name: "โล่ทองคำ", icon: "🛡", cd: 4, target: "self", shield: 2, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }, { k: "defUp", v: .5, turns: 2 }] },
        { name: "ฟาดโล่สะท้าน", icon: "💥", cd: 4, first: 1, target: "front", power: 1.2, fx: [{ k: "stun", chance: .5, turns: 1 }] }
      ]
    },
    miu: {
      name: "มิว", role: "magic", rarity: 4, art: "miu", from: "hero",
      text: "แม่มดน้อยหูแมว ไม้กายสิทธิ์เรียกดาวได้",
      skills: [
        { name: "ดาวแมวเหมียว", icon: "⭐", cd: 3, target: "one", power: 2.3 },
        { name: "ฝนดาวตก", icon: "☄", cd: 5, first: 2, target: "all", power: 1.5, fx: [{ k: "burn", power: .3, turns: 2 }] }
      ]
    },
    ratri: {
      name: "ราตรี", role: "attack", rarity: 5, art: "ratri", from: "hero", crit: .35,
      text: "นักธนูเงาราตรี ศรเงินไม่เคยพลาดเป้า",
      passive: { text: "ตาเหยี่ยวราตรี: โอกาสคริติคอล 35%" },
      skills: [
        { name: "ศรเงาราตรี", icon: "🏹", cd: 3, target: "one", power: 2.8 },
        { name: "ฝนศรจันทร์ดับ", icon: "🌑", cd: 5, first: 2, target: "back", power: 1.8, fx: [{ k: "stun", chance: .3, turns: 1 }] }
      ]
    },
    moonrabbit: {
      name: "กระต่ายจันทร์", role: "support", rarity: 2, art: "moonrabbit", from: "pet",
      text: "กระต่ายขาวจากดวงจันทร์ พกโมจิมาแจกเพื่อน",
      skills: [
        { name: "โมจิพลังจันทร์", icon: "🍡", cd: 3, target: "ally", heal: 2.4 },
        { name: "กระโดดเชียร์", icon: "🐰", cd: 4, first: 1, target: "allies", fx: [{ k: "atkUp", v: .25, turns: 2 }] }
      ]
    },
    starowl: {
      name: "นกฮูกดาว", role: "magic", rarity: 3, art: "starowl", from: "pet",
      text: "นกฮูกขนดาวผู้รู้ทุกความลับของท้องฟ้า",
      skills: [
        { name: "ดวงตาดารา", icon: "👁", cd: 3, target: "one", power: 1.8, fx: [{ k: "defDown", v: .25, turns: 2 }] },
        { name: "คืนพันดาว", icon: "🌌", cd: 4, first: 1, target: "all", power: 1.2 }
      ]
    },
    phloeng: {
      name: "เพลิง", role: "attack", rarity: 5, art: "phloeng", from: "hero",
      text: "อัศวินสาวหอกเพลิง ไฟในใจไม่เคยมอด",
      passive: { text: "หัวใจเปลวเพลิง: โอกาสคริติคอล 25%" }, crit: .25,
      skills: [
        { name: "หอกเปลวสุริยะ", icon: "🔱", cd: 3, target: "front", power: 1.8, fx: [{ k: "burn", power: .35, turns: 2 }] },
        { name: "ทะเลเพลิงพิฆาต", icon: "🔥", cd: 5, first: 2, target: "all", power: 1.8, fx: [{ k: "burn", power: .45, turns: 2 }] }
      ]
    },
    mekha: {
      name: "เมฆา", role: "magic", rarity: 4, art: "mekha", from: "hero",
      text: "จอมเวทน้อยขี่เมฆ เรียกฟ้าผ่าได้ดั่งใจ",
      skills: [
        { name: "ฟ้าผ่าเมฆน้อย", icon: "⚡", cd: 3, target: "random", hits: 3, power: .85, fx: [{ k: "stun", chance: .2, turns: 1 }] },
        { name: "พายุเมฆคำราม", icon: "⛈", cd: 5, first: 2, target: "all", power: 1.4, fx: [{ k: "stun", chance: .25, turns: 1 }] }
      ]
    },
    fasai: {
      name: "ฟ้าใส", role: "support", rarity: 2, art: "fasai", from: "hero",
      text: "นักดนตรีสาวพิณจันทร์ เพลงของเธอปลุกพลังเพื่อน",
      skills: [
        { name: "บทเพลงเยียวยา", icon: "🎵", cd: 3, target: "allies", heal: 1.1 },
        { name: "ทำนองปลุกใจ", icon: "🎶", cd: 4, first: 1, target: "allies", fx: [{ k: "atkUp", v: .25, turns: 2 }, { k: "defUp", v: .2, turns: 2 }] }
      ]
    },
    silverwolf: {
      name: "หมาป่าเงิน", role: "attack", rarity: 5, art: "silverwolf", from: "pet", crit: .25,
      text: "ลูกหมาป่าขนเงิน หอนเรียกพลังจันทร์เต็มดวง",
      skills: [
        { name: "เขี้ยวเงิน", icon: "🐺", cd: 3, target: "one", power: 2.2, drain: .3 },
        { name: "หอนจันทร์เต็มดวง", icon: "🌕", cd: 5, first: 1, target: "all", power: 1.4, fx: [{ k: "atkUp", v: .2, turns: 2, on: "allies" }] }
      ]
    },
    chada: {
      name: "ชาดา", role: "attack", rarity: 5, art: "chada", from: "hero", crit: .3,
      text: "ซามูไรสาวดาบโลหิต ฟันเพียงครั้งเดียวไม่มีใครลุกขึ้น",
      passive: { text: "ดาบโลหิต: โอกาสคริติคอล 30%" },
      skills: [
        { name: "ดาบพระจันทร์แดง", icon: "🗡", cd: 3, target: "one", power: 2.5, drain: .25, fx: [{ k: "defDown", v: .25, turns: 2 }] },
        { name: "พันคมดาบโลหิต", icon: "🩸", cd: 5, first: 2, target: "random", hits: 5, power: .85, fx: [{ k: "burn", power: .3, turns: 2 }] }
      ]
    },
    anchan: {
      name: "อัญชัน", role: "balance", rarity: 5, art: "anchan", from: "hero", crit: .2,
      text: "ซามูไรแฝดดาบน้ำแข็ง ฟันได้ ป้องได้ ไม่มีจุดอ่อน",
      passive: { shield: .15, text: "ใจสงบดั่งน้ำ: เริ่มการต่อสู้พร้อมเกราะ 15% ของพลังชีวิต" },
      skills: [
        { name: "ดาบธาราสะท้าน", icon: "🌊", cd: 3, target: "front", power: 1.7, fx: [{ k: "stun", chance: .3, turns: 1 }] },
        { name: "ท่าตั้งรับวารี", icon: "❄", cd: 4, first: 1, target: "self", shield: 2, fx: [{ k: "shield", turns: 2 }, { k: "defUp", v: .4, turns: 2 }, { k: "atkUp", v: .35, turns: 2, on: "self" }] }
      ]
    },
    phayak: {
      name: "พยัคฆ์", role: "attack", rarity: 5, art: "phayak", from: "hero", crit: .25,
      text: "นักสู้หมัดเสือทอง ยิ่งสู้ยิ่งดุดัน",
      passive: { double: .25, text: "หมัดเสือคู่: โจมตีปกติมีโอกาส 25% ตีซ้ำอีกครั้ง" },
      skills: [
        { name: "กรงเล็บเสือทอง", icon: "🐯", cd: 3, target: "front", power: 1.9, fx: [{ k: "defDown", v: .3, turns: 2 }] },
        { name: "คำรามพยัคฆ์ทลายป่า", icon: "💥", cd: 5, first: 2, target: "all", power: 1.6, fx: [{ k: "atkUp", v: .3, turns: 2, on: "self" }, { k: "stun", chance: .2, turns: 1 }] }
      ]
    },
    wayu: {
      name: "วายุ", role: "defense", rarity: 5, art: "wayu", from: "hero",
      text: "แฝดเสือคราม ยืนขวางหน้าเพื่อนทุกครั้งที่ศัตรูบุก",
      passive: { shield: .25, text: "หนังเสือคราม: เริ่มการต่อสู้พร้อมเกราะ 25% ของพลังชีวิต" },
      skills: [
        { name: "ยืนหยัดเสือคราม", icon: "🐅", cd: 4, target: "self", shield: 2.2, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }, { k: "defUp", v: .5, turns: 2 }] },
        { name: "หมัดสวนลมกรด", icon: "🌀", cd: 4, first: 1, target: "front", power: 1.5, fx: [{ k: "stun", chance: .4, turns: 1 }, { k: "defDown", v: .2, turns: 2 }] }
      ]
    },
    sila: {
      name: "ศิลา", role: "defense", rarity: 5, art: "sila", from: "hero",
      text: "อัศวินโล่ศิลาจารึก กำแพงที่ไม่เคยพังทลาย",
      passive: { teamShield: .1, text: "กำแพงศิลา: เริ่มการต่อสู้ ทั้งทีมได้เกราะ 10% ของพลังชีวิต" },
      skills: [
        { name: "โล่ศิลาจารึก", icon: "🛡", cd: 4, target: "self", shield: 2.4, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }, { k: "defUp", v: .55, turns: 2 }] },
        { name: "ป้อมหินคุ้มกัน", icon: "🪨", cd: 5, first: 1, target: "allies", shield: 1.2, fx: [{ k: "shield", turns: 2 }, { k: "defUp", v: .25, turns: 2 }] }
      ]
    },
    seraphina: {
      name: "เซราฟิน่า", role: "support", rarity: 6, art: "seraphina", from: "hero",
      text: "นักบุญแห่งปีกศักดิ์สิทธิ์ แสงของเธอปกป้องทั้งกองทัพ",
      passive: { teamShield: .15, text: "ปีกศักดิ์สิทธิ์: เริ่มการต่อสู้ ทั้งทีมได้เกราะ 15% ของพลังชีวิต" },
      skills: [
        { name: "แสงปีกศักดิ์สิทธิ์", icon: "🪽", cd: 3, target: "allies", heal: 1.9, fx: [{ k: "cleanse" }, { k: "defUp", v: .25, turns: 2 }] },
        { name: "พรแห่งสวรรค์", icon: "✝", cd: 5, first: 1, target: "allies", shield: 1.6, fx: [{ k: "shield", turns: 2 }, { k: "atkUp", v: .45, turns: 2 }] }
      ]
    },
    asani: {
      name: "อัสนี", role: "attack", rarity: 6, art: "asani", from: "hero", crit: .35,
      text: "อัศวินมังกรสายฟ้าในตำนาน ดาบเดียวผ่าฟ้า",
      passive: { text: "สายเลือดมังกร: โอกาสคริติคอล 35%" },
      skills: [
        { name: "ดาบอัสนีบาต", icon: "⚔", cd: 3, target: "one", power: 2.8, fx: [{ k: "stun", chance: .4, turns: 1 }] },
        { name: "มังกรสายฟ้าคำราม", icon: "🐉", cd: 5, first: 2, target: "all", power: 2, fx: [{ k: "defDown", v: .3, turns: 2 }] }
      ]
    },
    phoenix: {
      name: "วิหคเพลิงทอง", role: "magic", rarity: 6, art: "phoenix", from: "pet",
      text: "นกเพลิงทองคำในตำนาน ฟื้นคืนจากเถ้าถ่านได้ทุกครั้ง",
      skills: [
        { name: "ขนนกเพลิงทอง", icon: "🪶", cd: 3, target: "random", hits: 4, power: .8, fx: [{ k: "burn", power: .35, turns: 2 }] },
        { name: "ปีกเพลิงนิรันดร์", icon: "🔥", cd: 5, first: 2, target: "all", power: 1.7, drain: .4, fx: [{ k: "burn", power: .5, turns: 2 }] }
      ]
    },
    vajira: {
      name: "วชิระ", role: "defense", rarity: 6, art: "vajira", from: "hero",
      text: "อัศวินผู้พิทักษ์เกราะเพชร ไม่มีใครผ่านโล่ของเขาไปได้",
      passive: { shield: .3, text: "เกราะเพชร: เริ่มการต่อสู้พร้อมเกราะ 30% ของพลังชีวิต" },
      skills: [
        { name: "ป้อมปราการเพชร", icon: "💎", cd: 4, target: "self", shield: 2.6, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }, { k: "defUp", v: .6, turns: 2 }] },
        { name: "โล่คริสตัลคุ้มภัย", icon: "🛡", cd: 5, first: 1, target: "allies", shield: 1.4, fx: [{ k: "shield", turns: 2 }, { k: "defUp", v: .3, turns: 2 }, { k: "cleanse" }] }
      ]
    },
    naphalai: {
      name: "นภาลัย", role: "magic", rarity: 6, art: "naphalai", from: "hero",
      text: "จอมเวทแห่งดวงดาว เรียกกลุ่มดาวลงมาถล่มศัตรู",
      passive: { text: "ม่านดารา: โอกาสคริติคอล 25%" }, crit: .25,
      skills: [
        { name: "ฝนดาวตก", icon: "☄", cd: 3, target: "all", power: 1.4, fx: [{ k: "stun", chance: .25, turns: 1 }] },
        { name: "สุริยคราสจักรวาล", icon: "🌌", cd: 5, first: 2, target: "all", power: 2.1, fx: [{ k: "defDown", v: .3, turns: 2 }, { k: "burn", power: .4, turns: 2 }] }
      ]
    },
    qilin: {
      name: "กิเลนทอง", role: "balance", rarity: 6, art: "qilin", from: "pet",
      text: "กิเลนทองคำในตำนาน นำโชคและพลังมาสู่ผู้เป็นนาย",
      skills: [
        { name: "เขากิเลนทะลวง", icon: "🦌", cd: 3, target: "one", power: 2.4, drain: .4, fx: [{ k: "defDown", v: .25, turns: 2 }] },
        { name: "เมฆมงคล", icon: "☁", cd: 5, first: 1, target: "allies", heal: 1.3, fx: [{ k: "atkUp", v: .4, turns: 2 }, { k: "cleanse" }] }
      ]
    }
  });
  const CARD_IDS = Object.keys(CARDS);
  const STARTER = ["pupa", "jibjib", "firefly"];
  const STARTER_TEAM = ["jibjib", "pupa", "firefly", "", ""];

  // Monsters from the platform levels. hp/atk/def scale the role's values.
  const FOES = {
    walker: { name: "เห็ดหนาม", role: "balance", art: "walker", skills: [{ name: "สปอร์หนาม", cd: 3, target: "one", power: 1.3, fx: [{ k: "burn", power: .3, turns: 2 }] }] },
    bat: { name: "ค้างคาวราตรี", role: "attack", art: "bat", spd: 112, skills: [{ name: "โฉบกัดแถวหลัง", cd: 3, target: "back", power: .9 }] },
    hopper: { name: "วุ้นกระโดด", role: "defense", art: "hopper", skills: [{ name: "กระแทกพื้น", cd: 4, target: "front", power: .9, fx: [{ k: "stun", chance: .3, turns: 1 }] }] },
    urchin: { name: "เม่นหนาม", role: "defense", art: "urchin", skills: [{ name: "ตั้งหนาม", cd: 4, target: "self", fx: [{ k: "taunt", turns: 2 }, { k: "defUp", v: .4, turns: 2 }] }] },
    spitter: { name: "ดอกพ่นเมล็ด", role: "magic", art: "spitter", skills: [{ name: "ฝนเมล็ด", cd: 3, target: "all", power: .7 }] },
    jelly: { name: "แมงกะพรุนเรืองแสง", role: "support", art: "jelly", skills: [{ name: "แสงเยียวยา", cd: 3, target: "allies", heal: 1.5 }] },
    crab: { name: "ปูก้ามใหญ่", role: "attack", art: "crab", skills: [{ name: "ก้ามหนีบ", cd: 3, target: "one", power: 2 }] },
    roller: { name: "ตัวกลิ้งหนาม", role: "defense", art: "roller", atk: 1.3, skills: [{ name: "กลิ้งบดขยี้", cd: 3, target: "front", power: 1.3 }] },
    swooper: { name: "นกโคมดิ่ง", role: "attack", art: "swooper", spd: 108, skills: [{ name: "ดิ่งพสุธา", cd: 3, target: "back", power: 1.2, fx: [{ k: "stun", chance: .25, turns: 1 }] }] },
    king: {
      name: "ราชาเห็ดหนาม", role: "balance", art: "king", boss: true, hp: 3.5, atk: 1.25, def: 1.2,
      skills: [
        { name: "เหยียบสะเทือนป่า", cd: 3, target: "all", power: 1.1, fx: [{ k: "stun", chance: .25, turns: 1 }] },
        { name: "สปอร์ราชา", cd: 4, first: 1, target: "all", power: .6, fx: [{ k: "burn", power: .45, turns: 2 }] }
      ]
    },
    queen: {
      name: "ราชินีค้างคาว", role: "magic", art: "queen", boss: true, hp: 3.5, atk: 1.2, def: 1.2, spd: 110,
      skills: [
        { name: "พายุปีกราตรี", cd: 3, target: "all", power: 1.2 },
        { name: "จุมพิตดูดพลัง", cd: 4, first: 1, target: "one", power: 2.6, drain: .6 }
      ]
    }
  };
  // Chapter 3: the same creatures, burning (hue turns their colours, as
  // the art is shared with the cool ones). Hotter skills, a little tougher.
  Object.assign(FOES, {
    lavashroom: { name: "เห็ดลาวา", role: "balance", art: "walker", hue: 100, hp: 1.1, skills: [{ name: "สปอร์ลาวา", cd: 3, target: "front", power: 1.1, fx: [{ k: "burn", power: .35, turns: 2 }] }] },
    firebat: { name: "ค้างคาวอัคคี", role: "attack", art: "bat", hue: 150, spd: 115, skills: [{ name: "โฉบเพลิง", cd: 3, target: "back", power: 1, fx: [{ k: "burn", power: .3, turns: 2 }] }] },
    magmacrab: { name: "ปูหินหลอมเหลว", role: "attack", art: "crab", hue: 20, def: 1.3, skills: [{ name: "ก้ามหินร้อน", cd: 3, target: "one", power: 2.2, fx: [{ k: "defDown", v: .2, turns: 2 }] }] },
    emberjelly: { name: "แมงกะพรุนถ่านแดง", role: "support", art: "jelly", hue: 160, skills: [{ name: "ไออุ่นฟื้นฟู", cd: 3, target: "allies", heal: 1.4, fx: [{ k: "atkUp", v: .2, turns: 2 }] }] },
    cinderroller: { name: "ตัวกลิ้งถ่านหิน", role: "defense", art: "roller", hue: 330, atk: 1.3, skills: [{ name: "กลิ้งถ่านเพลิง", cd: 3, target: "front", power: 1.3, fx: [{ k: "burn", power: .3, turns: 2 }] }] },
    flamespitter: { name: "ดอกไม้ไฟ", role: "magic", art: "spitter", hue: 180, skills: [{ name: "ฝนประกายไฟ", cd: 3, target: "all", power: .8, fx: [{ k: "burn", power: .25, turns: 2 }] }] },
    ashowl: { name: "นกโคมเถ้าถ่าน", role: "attack", art: "swooper", hue: 300, spd: 112, skills: [{ name: "ดิ่งเพลิงพสุธา", cd: 3, target: "back", power: 1.3, fx: [{ k: "stun", chance: .25, turns: 1 }] }] },
    lavaking: {
      name: "ราชาเห็ดลาวา", role: "balance", art: "king", hue: 100, boss: true, hp: 3.8, atk: 1.3, def: 1.25,
      skills: [
        { name: "ระเบิดภูเขาไฟ", cd: 3, target: "all", power: 1.2, fx: [{ k: "burn", power: .4, turns: 2 }] },
        { name: "เหยียบลาวาสะเทือน", cd: 4, first: 1, target: "front", power: 1.6, fx: [{ k: "stun", chance: .35, turns: 1 }] }
      ]
    },
    sunqueen: {
      name: "ราชินีสุริยะ", role: "magic", art: "queen", hue: 150, boss: true, hp: 3.8, atk: 1.25, def: 1.2, spd: 112,
      skills: [
        { name: "สุริยคราสลุกไหม้", cd: 3, target: "all", power: 1.3, fx: [{ k: "burn", power: .4, turns: 2 }] },
        { name: "จุมพิตเปลวตะวัน", cd: 4, first: 1, target: "one", power: 2.8, drain: .6 }
      ]
    }
  });
  // Chapter 4: frozen ones. Their skills freeze (stun) and crack armour.
  const FROST = "rgba(140,210,255,.9)";
  Object.assign(FOES, {
    frostshroom: { name: "เห็ดน้ำแข็ง", role: "balance", art: "walker", hue: 270, glow: FROST, tier: 1.3, hp: 1.15, skills: [{ name: "สปอร์เกล็ดหิมะ", cd: 3, target: "front", power: 1.1, fx: [{ k: "stun", chance: .25, turns: 1 }] }] },
    snowbat: { name: "ค้างคาวหิมะ", role: "attack", art: "bat", hue: 300, glow: FROST, tier: 1.3, spd: 116, skills: [{ name: "โฉบลมหนาว", cd: 3, target: "back", power: 1.05, fx: [{ k: "defDown", v: .2, turns: 2 }] }] },
    icecrab: { name: "ปูผลึกน้ำแข็ง", role: "attack", art: "crab", hue: 180, glow: FROST, tier: 1.3, def: 1.4, skills: [{ name: "ก้ามน้ำแข็ง", cd: 3, target: "one", power: 2.2, fx: [{ k: "stun", chance: .3, turns: 1 }] }] },
    frostjelly: { name: "แมงกะพรุนน้ำแข็ง", role: "support", art: "jelly", hue: 340, glow: FROST, tier: 1.3, skills: [{ name: "ม่านน้ำแข็ง", cd: 3, target: "allies", heal: 1.2, shield: .8, fx: [{ k: "shield", turns: 2 }] }] },
    glacierroller: { name: "ตัวกลิ้งธารน้ำแข็ง", role: "defense", art: "roller", hue: 170, glow: FROST, tier: 1.3, atk: 1.3, skills: [{ name: "กลิ้งหิมะถล่ม", cd: 3, target: "front", power: 1.35, fx: [{ k: "stun", chance: .2, turns: 1 }] }] },
    iceurchin: { name: "เม่นน้ำแข็ง", role: "defense", art: "urchin", hue: 340, glow: FROST, tier: 1.3, skills: [{ name: "หนามน้ำแข็ง", cd: 4, target: "self", fx: [{ k: "taunt", turns: 2 }, { k: "defUp", v: .5, turns: 2 }] }] },
    frostflower: { name: "ดอกไม้หิมะ", role: "magic", art: "spitter", hue: 330, glow: FROST, tier: 1.3, skills: [{ name: "พายุเกล็ดหิมะ", cd: 3, target: "all", power: .85, fx: [{ k: "defDown", v: .15, turns: 2 }] }] },
    blizzardbird: { name: "นกโคมพายุหิมะ", role: "attack", art: "swooper", hue: 170, glow: FROST, tier: 1.3, spd: 114, skills: [{ name: "ดิ่งพายุหิมะ", cd: 3, target: "back", power: 1.35, fx: [{ k: "stun", chance: .3, turns: 1 }] }] },
    frostking: {
      name: "ราชาเห็ดน้ำแข็ง", role: "balance", art: "king", hue: 270, glow: FROST, tier: 1.3, boss: true, hp: 4, atk: 1.3, def: 1.3,
      skills: [
        { name: "หิมะถล่มทลาย", cd: 3, target: "all", power: 1.2, fx: [{ k: "stun", chance: .25, turns: 1 }] },
        { name: "เกราะธารน้ำแข็ง", cd: 4, first: 1, target: "self", shield: 3, fx: [{ k: "shield", turns: 2 }, { k: "defUp", v: .4, turns: 2 }] }
      ]
    },
    icequeen: {
      name: "ราชินีหิมะ", role: "magic", art: "queen", hue: 300, glow: FROST, tier: 1.3, boss: true, hp: 4, atk: 1.3, def: 1.2, spd: 114,
      skills: [
        { name: "พายุน้ำแข็งนิรันดร์", cd: 3, target: "all", power: 1.3, fx: [{ k: "defDown", v: .25, turns: 2 }] },
        { name: "จุมพิตแช่แข็ง", cd: 4, first: 1, target: "one", power: 2.6, fx: [{ k: "stun", chance: .6, turns: 1 }] }
      ]
    }
  });
  // Chapter 5: shadows. They drain, break armour and burn with dark fire.
  const DUSK = "rgba(190,110,255,.95)";
  const SHADE = "hue-rotate(40deg) saturate(1.6) brightness(.75) contrast(1.25)";
  Object.assign(FOES, {
    shadowshroom: { name: "เห็ดเงา", role: "balance", art: "walker", look: SHADE, glow: DUSK, tier: 1.6, skills: [{ name: "สปอร์ความมืด", cd: 3, target: "front", power: 1.15, drain: .4 }] },
    voidbat: { name: "ค้างคาวห้วงมืด", role: "attack", art: "bat", look: SHADE, glow: DUSK, tier: 1.6, spd: 118, skills: [{ name: "เขี้ยวสุริยคราส", cd: 3, target: "back", power: 1.1, drain: .5 }] },
    shadowcrab: { name: "ปูเงาทมิฬ", role: "attack", art: "crab", hue: 250, glow: DUSK, tier: 1.6, def: 1.4, skills: [{ name: "ก้ามเงาฉีก", cd: 3, target: "one", power: 2.3, fx: [{ k: "defDown", v: .3, turns: 2 }] }] },
    voidjelly: { name: "แมงกะพรุนห้วงมืด", role: "support", art: "jelly", hue: 90, glow: DUSK, tier: 1.6, skills: [{ name: "พรแห่งความมืด", cd: 3, target: "allies", heal: 1.3, fx: [{ k: "atkUp", v: .25, turns: 2 }] }] },
    duskroller: { name: "ตัวกลิ้งสนธยา", role: "defense", art: "roller", hue: 230, glow: DUSK, tier: 1.6, atk: 1.3, skills: [{ name: "กลิ้งเงาบดขยี้", cd: 3, target: "front", power: 1.4, fx: [{ k: "defDown", v: .2, turns: 2 }] }] },
    duskurchin: { name: "เม่นเงา", role: "defense", art: "urchin", look: SHADE, glow: DUSK, tier: 1.6, skills: [{ name: "หนามเงาสะท้อน", cd: 4, target: "self", shield: 2, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }] }] },
    nightflower: { name: "ดอกไม้ราตรีมืด", role: "magic", art: "spitter", hue: 60, glow: DUSK, tier: 1.6, skills: [{ name: "ฝนไฟเงา", cd: 3, target: "all", power: .85, fx: [{ k: "burn", power: .3, turns: 2 }] }] },
    wraithbird: { name: "นกโคมวิญญาณ", role: "attack", art: "swooper", hue: 230, glow: DUSK, tier: 1.6, spd: 116, skills: [{ name: "ดิ่งวิญญาณ", cd: 3, target: "back", power: 1.4, drain: .4, fx: [{ k: "stun", chance: .25, turns: 1 }] }] },
    shadowking: {
      name: "ราชาเห็ดเงา", role: "balance", art: "king", look: SHADE, glow: DUSK, tier: 1.6, boss: true, hp: 4.2, atk: 1.3, def: 1.3,
      skills: [
        { name: "คลื่นความมืดกลืนกิน", cd: 3, target: "all", power: 1.2, drain: .3, fx: [{ k: "defDown", v: .25, turns: 2 }] },
        { name: "บัลลังก์เงา", cd: 4, first: 1, target: "self", shield: 3, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }] }
      ]
    },
    eclipsequeen: {
      name: "ราชินีสุริยคราส", role: "magic", art: "queen", look: SHADE, glow: DUSK, tier: 1.6, boss: true, hp: 4.2, atk: 1.35, def: 1.2, spd: 118,
      skills: [
        { name: "สุริยคราสเพลิงมืด", cd: 3, target: "all", power: 1.35, fx: [{ k: "burn", power: .45, turns: 2 }] },
        { name: "จุมพิตห้วงมืด", cd: 4, first: 1, target: "one", power: 3, drain: .8, fx: [{ k: "stun", chance: .5, turns: 1 }] }
      ]
    }
  });
  // Chapter 6: the guardians of heaven. They heal, shield and lift each
  // other up, and strike with holy light.
  const HALO = "rgba(255,225,120,.95)";
  const GILD = "sepia(1) saturate(2.6) hue-rotate(-8deg) brightness(1.18)";
  Object.assign(FOES, {
    haloshroom: { name: "เห็ดรัศมี", role: "balance", art: "walker", look: GILD, glow: HALO, tier: 2.1, skills: [{ name: "สปอร์ศักดิ์สิทธิ์", cd: 3, target: "front", power: 1.2, fx: [{ k: "atkUp", v: .2, turns: 2, on: "allies" }] }] },
    seraphbat: { name: "ค้างคาวเทวดา", role: "attack", art: "bat", look: GILD, glow: HALO, tier: 2.1, spd: 120, skills: [{ name: "ปีกแสงพุ่ง", cd: 3, target: "back", power: 1.15, fx: [{ k: "defDown", v: .2, turns: 2 }] }] },
    goldcrab: { name: "ปูทองคำสวรรค์", role: "attack", art: "crab", look: GILD, glow: HALO, tier: 2.1, def: 1.5, skills: [{ name: "ก้ามทองคำ", cd: 3, target: "one", power: 2.3, fx: [{ k: "shield", turns: 2, on: "self" }] }] },
    lightjelly: { name: "แมงกะพรุนแสงเทพ", role: "support", art: "jelly", look: GILD, glow: HALO, tier: 2.1, skills: [{ name: "ธารแสงเยียวยา", cd: 3, target: "allies", heal: 1.4, shield: .8, fx: [{ k: "shield", turns: 2 }, { k: "cleanse" }] }] },
    sunroller: { name: "ตัวกลิ้งสุริยะ", role: "defense", art: "roller", look: GILD, glow: HALO, tier: 2.1, atk: 1.3, skills: [{ name: "กลิ้งแสงสุริยะ", cd: 3, target: "front", power: 1.4, fx: [{ k: "stun", chance: .2, turns: 1 }] }] },
    haloburchin: { name: "เม่นรัศมี", role: "defense", art: "urchin", look: GILD, glow: HALO, tier: 2.1, skills: [{ name: "โล่แสงศักดิ์สิทธิ์", cd: 4, target: "allies", shield: 1.2, fx: [{ k: "shield", turns: 2 }, { k: "defUp", v: .3, turns: 2 }] }] },
    starflower: { name: "ดอกไม้ดารา", role: "magic", art: "spitter", look: GILD, glow: HALO, tier: 2.1, skills: [{ name: "ฝนดาวศักดิ์สิทธิ์", cd: 3, target: "all", power: .9, fx: [{ k: "defDown", v: .15, turns: 2 }] }] },
    angelbird: { name: "นกโคมเทวดา", role: "attack", art: "swooper", look: GILD, glow: HALO, tier: 2.1, spd: 118, skills: [{ name: "ดิ่งแสงสวรรค์", cd: 3, target: "back", power: 1.45, fx: [{ k: "stun", chance: .3, turns: 1 }] }] },
    heavenking: {
      name: "ราชาเห็ดสวรรค์", role: "balance", art: "king", look: GILD, glow: HALO, tier: 2.1, boss: true, hp: 4.4, atk: 1.3, def: 1.35,
      skills: [
        { name: "ประกาศิตแห่งแสง", cd: 3, target: "all", power: 1.25, fx: [{ k: "stun", chance: .25, turns: 1 }] },
        { name: "พรแห่งสวรรค์", cd: 4, first: 1, target: "allies", heal: 1.5, shield: 1.5, fx: [{ k: "shield", turns: 2 }, { k: "atkUp", v: .3, turns: 2 }] }
      ]
    },
    starqueen: {
      name: "ราชินีดวงดาว", role: "magic", art: "queen", look: GILD, glow: HALO, tier: 2.1, boss: true, hp: 4.4, atk: 1.4, def: 1.25, spd: 120,
      skills: [
        { name: "ทางช้างเผือกถล่ม", cd: 3, target: "all", power: 1.4, fx: [{ k: "defDown", v: .3, turns: 2 }] },
        { name: "จุมพิตดาวตก", cd: 4, first: 1, target: "one", power: 3.2, drain: .5, fx: [{ k: "stun", chance: .5, turns: 1 }] }
      ]
    }
  });
  // Chapter 7: creatures of the nebula, all the tricks at once: drain,
  // burn, freeze and armour breaking.
  const NEBULA = "rgba(120,230,255,.95)";
  const STARRY = "hue-rotate(70deg) saturate(2.4) contrast(1.1) brightness(1.15)";
  Object.assign(FOES, {
    nebulashroom: { name: "เห็ดเนบิวลา", role: "balance", art: "walker", look: STARRY, glow: NEBULA, tier: 2.8, skills: [{ name: "สปอร์ดาวหาง", cd: 3, target: "front", power: 1.2, drain: .3, fx: [{ k: "burn", power: .3, turns: 2 }] }] },
    cometbat: { name: "ค้างคาวดาวหาง", role: "attack", art: "bat", look: STARRY, glow: NEBULA, tier: 2.8, spd: 122, skills: [{ name: "โฉบหางดาวหาง", cd: 3, target: "back", power: 1.2, fx: [{ k: "burn", power: .3, turns: 2 }] }] },
    starcrab: { name: "ปูดวงดาว", role: "attack", art: "crab", look: STARRY, glow: NEBULA, tier: 2.8, def: 1.5, skills: [{ name: "ก้ามแรงโน้มถ่วง", cd: 3, target: "one", power: 2.4, fx: [{ k: "stun", chance: .35, turns: 1 }] }] },
    cosmicjelly: { name: "แมงกะพรุนจักรวาล", role: "support", art: "jelly", look: STARRY, glow: NEBULA, tier: 2.8, skills: [{ name: "คลื่นแสงเนบิวลา", cd: 3, target: "allies", heal: 1.4, fx: [{ k: "atkUp", v: .25, turns: 2 }, { k: "cleanse" }] }] },
    meteorroller: { name: "ตัวกลิ้งอุกกาบาต", role: "defense", art: "roller", look: STARRY, glow: NEBULA, tier: 2.8, atk: 1.35, skills: [{ name: "อุกกาบาตกลิ้ง", cd: 3, target: "front", power: 1.45, fx: [{ k: "defDown", v: .25, turns: 2 }] }] },
    voidurchin: { name: "เม่นหลุมดำ", role: "defense", art: "urchin", look: STARRY, glow: NEBULA, tier: 2.8, skills: [{ name: "สนามแรงโน้มถ่วง", cd: 4, target: "self", shield: 2.5, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }, { k: "defUp", v: .4, turns: 2 }] }] },
    galaxyflower: { name: "ดอกไม้กาแล็กซี", role: "magic", art: "spitter", look: STARRY, glow: NEBULA, tier: 2.8, skills: [{ name: "ฝนดาวเหนือ", cd: 3, target: "all", power: .95, fx: [{ k: "stun", chance: .15, turns: 1 }] }] },
    orbitbird: { name: "นกโคมวงโคจร", role: "attack", art: "swooper", look: STARRY, glow: NEBULA, tier: 2.8, spd: 120, skills: [{ name: "ดิ่งวงโคจร", cd: 3, target: "back", power: 1.5, drain: .4 }] },
    cosmicking: {
      name: "ราชาเห็ดจักรวาล", role: "balance", art: "king", look: STARRY, glow: NEBULA, tier: 2.8, boss: true, hp: 4.6, atk: 1.35, def: 1.35,
      skills: [
        { name: "บิ๊กแบงถล่ม", cd: 3, target: "all", power: 1.3, fx: [{ k: "burn", power: .4, turns: 2 }, { k: "stun", chance: .2, turns: 1 }] },
        { name: "หลุมดำกลืนกิน", cd: 4, first: 1, target: "front", power: 1.8, drain: .5, fx: [{ k: "defDown", v: .3, turns: 2 }] }
      ]
    },
    nebulaqueen: {
      name: "ราชินีเนบิวลา", role: "magic", art: "queen", look: STARRY, glow: NEBULA, tier: 2.8, boss: true, hp: 4.6, atk: 1.45, def: 1.25, spd: 122,
      skills: [
        { name: "พายุซูเปอร์โนวา", cd: 3, target: "all", power: 1.45, fx: [{ k: "burn", power: .45, turns: 2 }] },
        { name: "จุมพิตกาแล็กซี", cd: 4, first: 1, target: "one", power: 3.3, drain: .7, fx: [{ k: "stun", chance: .5, turns: 1 }] }
      ]
    }
  });
  // Chapter 8: the deep sea, under crushing water: ink that breaks armour,
  // coral shields, poison and lights that drink life.
  const DEEP = "rgba(90,255,210,.95)";
  // each picture turned to the blues and teals of deep water
  const ABYSS = (deg) => `hue-rotate(${deg}deg) saturate(1.9) contrast(1.1) brightness(1.05)`;
  Object.assign(FOES, {
    deepshroom: { name: "เห็ดทะเลลึก", role: "balance", art: "walker", look: ABYSS(220), glow: DEEP, tier: 3.2, skills: [{ name: "สปอร์หมึกดำ", cd: 3, target: "front", power: 1.25, fx: [{ k: "defDown", v: .25, turns: 2 }] }] },
    anglerbat: { name: "ค้างคาวตะเกียงลึก", role: "attack", art: "bat", look: ABYSS(320), glow: DEEP, tier: 3.2, spd: 124, skills: [{ name: "แสงล่อดูดชีวิต", cd: 3, target: "back", power: 1.25, drain: .4 }] },
    abysscrab: { name: "ปูยักษ์ห้วงลึก", role: "attack", art: "crab", look: ABYSS(160), glow: DEEP, tier: 3.2, def: 1.6, skills: [{ name: "ก้ามแรงดันน้ำ", cd: 3, target: "one", power: 2.5, fx: [{ k: "stun", chance: .35, turns: 1 }] }] },
    glowjelly: { name: "แมงกะพรุนเรืองแสง", role: "support", art: "jelly", look: ABYSS(0), glow: DEEP, tier: 3.2, skills: [{ name: "แสงเรืองใต้สมุทร", cd: 3, target: "allies", heal: 1.2, shield: .6, fx: [{ k: "shield", turns: 2 }, { k: "cleanse" }] }] },
    tideroller: { name: "ตัวกลิ้งกระแสน้ำ", role: "defense", art: "roller", look: ABYSS(160), glow: DEEP, tier: 3.2, atk: 1.4, skills: [{ name: "กลิ้งคลื่นยักษ์", cd: 3, target: "front", power: 1.5, fx: [{ k: "stun", chance: .25, turns: 1 }] }] },
    coralurchin: { name: "เม่นปะการัง", role: "defense", art: "urchin", look: ABYSS(320), glow: DEEP, tier: 3.2, skills: [{ name: "เกราะปะการัง", cd: 4, target: "self", shield: 2.6, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }, { k: "defUp", v: .45, turns: 2 }] }] },
    poisonflower: { name: "ดอกไม้ทะเลพิษ", role: "magic", art: "spitter", look: ABYSS(320), glow: DEEP, tier: 3.2, skills: [{ name: "หมอกพิษใต้น้ำ", cd: 3, target: "all", power: 1, fx: [{ k: "burn", power: .35, turns: 2 }] }] },
    sharkbird: { name: "นกโคมฉลาม", role: "attack", art: "swooper", look: ABYSS(160), glow: DEEP, tier: 3.2, spd: 122, skills: [{ name: "ดิ่งครีบฉลาม", cd: 3, target: "back", power: 1.55, drain: .4, fx: [{ k: "defDown", v: .2, turns: 2 }] }] },
    abyssking: {
      name: "ราชาเห็ดห้วงลึก", role: "balance", art: "king", look: ABYSS(240), glow: DEEP, tier: 3.2, boss: true, hp: 4.4, atk: 1.4, def: 1.4,
      skills: [
        { name: "สึนามิถล่ม", cd: 3, target: "all", power: 1.35, fx: [{ k: "defDown", v: .25, turns: 2 }, { k: "stun", chance: .2, turns: 1 }] },
        { name: "น้ำวนดูดกลืน", cd: 4, first: 1, target: "front", power: 1.9, drain: .5 }
      ]
    },
    krakenqueen: {
      name: "ราชินีคราเคน", role: "magic", art: "queen", look: ABYSS(280), glow: DEEP, tier: 3.2, boss: true, hp: 4.4, atk: 1.5, def: 1.3, spd: 124,
      skills: [
        { name: "หนวดคราเคนฟาด", cd: 3, target: "all", power: 1.5, fx: [{ k: "burn", power: .45, turns: 2 }] },
        { name: "จุมพิตห้วงลึก", cd: 4, first: 1, target: "one", power: 3.4, drain: .7, fx: [{ k: "stun", chance: .5, turns: 1 }] }
      ]
    }
  });
  // Chapter 9: the clockwork city in the sky, brass machines: thick armour,
  // electric shocks, drills that break armour and steam that scalds.
  const STEAM = "rgba(255,190,90,.95)";
  const BRASS = "sepia(1) saturate(2.6) hue-rotate(-12deg) contrast(1.15) brightness(1.08)";
  Object.assign(FOES, {
    gearshroom: { name: "เห็ดเฟืองทองเหลือง", role: "balance", art: "walker", look: BRASS, glow: STEAM, tier: 3.6, def: 1.2, skills: [{ name: "สปอร์ไอน้ำร้อน", cd: 3, target: "front", power: 1.25, fx: [{ k: "burn", power: .3, turns: 2 }] }] },
    rotorbat: { name: "ค้างคาวใบพัด", role: "attack", art: "bat", look: BRASS, glow: STEAM, tier: 3.6, spd: 126, skills: [{ name: "ใบพัดเฉือน", cd: 3, target: "back", power: 1.3, fx: [{ k: "defDown", v: .2, turns: 2 }] }] },
    drillcrab: { name: "ปูสว่านกล", role: "attack", art: "crab", look: BRASS, glow: STEAM, tier: 3.6, def: 1.7, skills: [{ name: "ก้ามสว่านเจาะเกราะ", cd: 3, target: "one", power: 2.5, fx: [{ k: "defDown", v: .35, turns: 2 }] }] },
    oiljelly: { name: "แมงกะพรุนน้ำมันเครื่อง", role: "support", art: "jelly", look: BRASS, glow: STEAM, tier: 3.6, skills: [{ name: "หยอดน้ำมันซ่อมแซม", cd: 3, target: "allies", heal: 1.2, fx: [{ k: "defUp", v: .25, turns: 2 }] }] },
    steamroller: { name: "รถบดไอน้ำ", role: "defense", art: "roller", look: BRASS, glow: STEAM, tier: 3.6, atk: 1.4, def: 1.2, skills: [{ name: "บดขยี้ไอน้ำ", cd: 3, target: "front", power: 1.5, fx: [{ k: "stun", chance: .25, turns: 1 }] }] },
    cogurchin: { name: "เม่นเฟืองหนาม", role: "defense", art: "urchin", look: BRASS, glow: STEAM, tier: 3.6, skills: [{ name: "เกราะเฟืองหมุน", cd: 4, target: "self", shield: 2.6, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }, { k: "defUp", v: .45, turns: 2 }] }] },
    teslaflower: { name: "ดอกไม้เทสลา", role: "magic", art: "spitter", look: BRASS, glow: STEAM, tier: 3.6, skills: [{ name: "สายฟ้าขดลวด", cd: 3, target: "all", power: 1, fx: [{ k: "stun", chance: .2, turns: 1 }] }] },
    airshipbird: { name: "นกเรือเหาะ", role: "attack", art: "swooper", look: BRASS, glow: STEAM, tier: 3.6, spd: 124, skills: [{ name: "ทิ้งระเบิดไอน้ำ", cd: 3, target: "back", power: 1.55, fx: [{ k: "burn", power: .35, turns: 2 }] }] },
    clockking: {
      name: "ราชาเห็ดจักรกล", role: "balance", art: "king", look: BRASS, glow: STEAM, tier: 3.6, boss: true, hp: 4.4, atk: 1.4, def: 1.5,
      skills: [
        { name: "หม้อไอน้ำระเบิด", cd: 3, target: "all", power: 1.35, fx: [{ k: "burn", power: .4, turns: 2 }] },
        { name: "ค้อนลูกสูบ", cd: 4, first: 1, target: "front", power: 1.9, fx: [{ k: "stun", chance: .4, turns: 1 }, { k: "defDown", v: .25, turns: 2 }] }
      ]
    },
    brassqueen: {
      name: "ราชินีกลไกทองเหลือง", role: "magic", art: "queen", look: BRASS, glow: STEAM, tier: 3.6, boss: true, hp: 4.4, atk: 1.5, def: 1.35, spd: 126,
      skills: [
        { name: "พายุสายฟ้าเทสลา", cd: 3, target: "all", power: 1.5, fx: [{ k: "stun", chance: .25, turns: 1 }] },
        { name: "เข็มนาฬิกาพิพากษา", cd: 4, first: 1, target: "one", power: 3.4, drain: .6, fx: [{ k: "defDown", v: .3, turns: 2 }] }
      ]
    }
  });
  // Chapter 10: the jade dragon valley, the last stand: warriors of jade
  // that rouse each other, drink life, stun and wash their wounds clean.
  const JADEGLOW = "rgba(120,255,170,.95)";
  const JADE = "sepia(1) saturate(3) hue-rotate(85deg) contrast(1.15) brightness(1.05)";
  Object.assign(FOES, {
    jadeshroom: { name: "เห็ดหยก", role: "balance", art: "walker", look: JADE, glow: JADEGLOW, tier: 4, def: 1.2, skills: [{ name: "สปอร์หยกเขียว", cd: 3, target: "front", power: 1.3, drain: .3 }] },
    lanternbat: { name: "ค้างคาวโคมแดง", role: "attack", art: "bat", look: JADE, glow: JADEGLOW, tier: 4, spd: 128, skills: [{ name: "โคมไฟพุ่งชน", cd: 3, target: "back", power: 1.3, fx: [{ k: "burn", power: .3, turns: 2 }] }] },
    jadecrab: { name: "ปูเกราะหยก", role: "attack", art: "crab", look: JADE, glow: JADEGLOW, tier: 4, def: 1.7, skills: [{ name: "ก้ามหยกบด", cd: 3, target: "one", power: 2.6, fx: [{ k: "stun", chance: .35, turns: 1 }] }] },
    spiritjelly: { name: "แมงกะพรุนวิญญาณหยก", role: "support", art: "jelly", look: JADE, glow: JADEGLOW, tier: 4, skills: [{ name: "ธารหยกชำระ", cd: 3, target: "allies", heal: 1.2, fx: [{ k: "cleanse" }, { k: "atkUp", v: .2, turns: 2 }] }] },
    stoneroller: { name: "ตัวกลิ้งศิลาหยก", role: "defense", art: "roller", look: JADE, glow: JADEGLOW, tier: 4, atk: 1.4, def: 1.2, skills: [{ name: "กลิ้งภูผาถล่ม", cd: 3, target: "front", power: 1.55, fx: [{ k: "defDown", v: .25, turns: 2 }] }] },
    bambooburchin: { name: "เม่นไผ่หยก", role: "defense", art: "urchin", look: JADE, glow: JADEGLOW, tier: 4, skills: [{ name: "กำแพงไผ่หยก", cd: 4, target: "allies", shield: 1.3, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2, on: "self" }] }] },
    lotusflower: { name: "บัวหยกพิษ", role: "magic", art: "spitter", look: JADE, glow: JADEGLOW, tier: 4, skills: [{ name: "กลีบบัวพายุ", cd: 3, target: "all", power: 1.05, fx: [{ k: "defDown", v: .15, turns: 2 }] }] },
    cranebird: { name: "นกกระเรียนหยก", role: "attack", art: "swooper", look: JADE, glow: JADEGLOW, tier: 4, spd: 126, skills: [{ name: "จะงอยกระเรียนเหิน", cd: 3, target: "back", power: 1.6, fx: [{ k: "stun", chance: .3, turns: 1 }] }] },
    jadeking: {
      name: "ราชาเห็ดหยก", role: "balance", art: "king", look: JADE, glow: JADEGLOW, tier: 4, boss: true, hp: 4.5, atk: 1.45, def: 1.5,
      skills: [
        { name: "คลื่นพลังหยก", cd: 3, target: "all", power: 1.4, drain: .3, fx: [{ k: "defDown", v: .25, turns: 2 }] },
        { name: "ฝ่ามือภูผา", cd: 4, first: 1, target: "front", power: 2, fx: [{ k: "stun", chance: .45, turns: 1 }] }
      ]
    },
    jadequeen: {
      name: "ราชินีมังกรหยก", role: "magic", art: "queen", look: JADE, glow: JADEGLOW, tier: 4, boss: true, hp: 4.1, atk: 1.4, def: 1.3, spd: 128,
      skills: [
        { name: "ลมหายใจมังกรหยก", cd: 3, target: "all", power: 1.55, fx: [{ k: "burn", power: .45, turns: 2 }] },
        { name: "เขี้ยวมังกรสวรรค์", cd: 4, first: 1, target: "one", power: 3.1, drain: .7, fx: [{ k: "stun", chance: .5, turns: 1 }] }
      ]
    }
  });
  // Chapter 11: the castle under the blood moon: vampire creatures that
  // drink life, curse armour, burn with dark fire and shield their lords.
  const BLOODGLOW = "rgba(255,70,90,.95)";
  const BLOOD = "sepia(1) saturate(4) hue-rotate(-55deg) contrast(1.2) brightness(.9)";
  Object.assign(FOES, {
    bloodshroom: { name: "เห็ดโลหิต", role: "balance", art: "walker", look: BLOOD, glow: BLOODGLOW, tier: 4.4, def: 1.2, skills: [{ name: "สปอร์ดูดเลือด", cd: 3, target: "front", power: 1.3, drain: .5 }] },
    vampbat: { name: "ค้างคาวแวมไพร์", role: "attack", art: "bat", look: BLOOD, glow: BLOODGLOW, tier: 4.4, spd: 130, skills: [{ name: "เขี้ยวแวมไพร์", cd: 3, target: "back", power: 1.35, drain: .6 }] },
    gravecrab: { name: "ปูหลุมศพ", role: "attack", art: "crab", look: BLOOD, glow: BLOODGLOW, tier: 4.4, def: 1.7, skills: [{ name: "ก้ามสาปเกราะ", cd: 3, target: "one", power: 2.6, fx: [{ k: "defDown", v: .35, turns: 2 }] }] },
    bloodjelly: { name: "แมงกะพรุนโลหิต", role: "support", art: "jelly", look: BLOOD, glow: BLOODGLOW, tier: 4.4, skills: [{ name: "พิธีกรรมโลหิต", cd: 3, target: "allies", heal: 1.2, fx: [{ k: "atkUp", v: .25, turns: 2 }] }] },
    coffinroller: { name: "โลงศพกลิ้ง", role: "defense", art: "roller", look: BLOOD, glow: BLOODGLOW, tier: 4.4, atk: 1.4, def: 1.3, skills: [{ name: "โลงศพถล่ม", cd: 3, target: "front", power: 1.55, fx: [{ k: "stun", chance: .25, turns: 1 }] }] },
    thornurchin: { name: "เม่นกุหลาบดำ", role: "defense", art: "urchin", look: BLOOD, glow: BLOODGLOW, tier: 4.4, skills: [{ name: "กำแพงหนามกุหลาบ", cd: 4, target: "allies", shield: 1.3, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2, on: "self" }] }] },
    roseflower: { name: "กุหลาบเพลิงดำ", role: "magic", art: "spitter", look: BLOOD, glow: BLOODGLOW, tier: 4.4, skills: [{ name: "ไฟกุหลาบดำ", cd: 3, target: "all", power: 1.05, fx: [{ k: "burn", power: .35, turns: 2 }] }] },
    ravenbird: { name: "อีกาโลหิต", role: "attack", art: "swooper", look: BLOOD, glow: BLOODGLOW, tier: 4.4, spd: 128, skills: [{ name: "จิกสาปแช่ง", cd: 3, target: "back", power: 1.6, drain: .4, fx: [{ k: "defDown", v: .2, turns: 2 }] }] },
    bloodking: {
      name: "ราชาเห็ดโลหิต", role: "balance", art: "king", look: BLOOD, glow: BLOODGLOW, tier: 4.4, boss: true, hp: 4.4, atk: 1.45, def: 1.5,
      skills: [
        { name: "ทะเลโลหิต", cd: 3, target: "all", power: 1.35, drain: .4 },
        { name: "คำสาปราชันย์", cd: 4, first: 1, target: "front", power: 1.9, fx: [{ k: "stun", chance: .4, turns: 1 }, { k: "defDown", v: .3, turns: 2 }] }
      ]
    },
    bloodqueen: {
      name: "ราชินีจันทร์เลือด", role: "magic", art: "queen", look: BLOOD, glow: BLOODGLOW, tier: 4.4, boss: true, hp: 4, atk: 1.4, def: 1.3, spd: 130,
      skills: [
        { name: "จันทร์เลือดสาดแสง", cd: 3, target: "all", power: 1.5, fx: [{ k: "burn", power: .4, turns: 2 }] },
        { name: "จุมพิตแวมไพร์", cd: 4, first: 1, target: "one", power: 3.1, drain: .8, fx: [{ k: "stun", chance: .5, turns: 1 }] }
      ]
    }
  });
  // Chapter 12: the storm peaks: lightning creatures, quick and shocking,
  // that chain bolts across the team and stun.
  const STORMGLOW = "rgba(255,240,120,.95)";
  const STORM = "sepia(1) saturate(2.8) hue-rotate(195deg) contrast(1.2) brightness(1.05)";
  Object.assign(FOES, {
    stormshroom: { name: "เห็ดอสนี", role: "balance", art: "walker", look: STORM, glow: STORMGLOW, tier: 4.8, def: 1.2, skills: [{ name: "สปอร์ประจุไฟฟ้า", cd: 3, target: "front", power: 1.3, fx: [{ k: "stun", chance: .3, turns: 1 }] }] },
    thunderbat: { name: "ค้างคาวฟ้าร้อง", role: "attack", art: "bat", look: STORM, glow: STORMGLOW, tier: 4.8, spd: 134, skills: [{ name: "โฉบสายฟ้า", cd: 3, target: "random", hits: 3, power: .6 }] },
    voltcrab: { name: "ปูโวลต์", role: "attack", art: "crab", look: STORM, glow: STORMGLOW, tier: 4.8, def: 1.7, skills: [{ name: "ก้ามช็อตไฟฟ้า", cd: 3, target: "one", power: 2.6, fx: [{ k: "stun", chance: .4, turns: 1 }] }] },
    cloudjelly: { name: "แมงกะพรุนเมฆฝน", role: "support", art: "jelly", look: STORM, glow: STORMGLOW, tier: 4.8, skills: [{ name: "ฝนชโลมพลัง", cd: 3, target: "allies", heal: 1.2, fx: [{ k: "atkUp", v: .2, turns: 2 }, { k: "cleanse" }] }] },
    boltroller: { name: "ลูกบอลสายฟ้า", role: "defense", art: "roller", look: STORM, glow: STORMGLOW, tier: 4.8, atk: 1.4, def: 1.3, skills: [{ name: "กลิ้งพายุฟ้า", cd: 3, target: "front", power: 1.55, fx: [{ k: "defDown", v: .25, turns: 2 }] }] },
    rodurchin: { name: "เม่นสายล่อฟ้า", role: "defense", art: "urchin", look: STORM, glow: STORMGLOW, tier: 4.8, skills: [{ name: "สายล่อฟ้า", cd: 4, target: "self", shield: 2.6, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }, { k: "defUp", v: .45, turns: 2 }] }] },
    plasmaflower: { name: "ดอกไม้พลาสมา", role: "magic", art: "spitter", look: STORM, glow: STORMGLOW, tier: 4.8, skills: [{ name: "พายุพลาสมา", cd: 3, target: "all", power: 1.05, fx: [{ k: "stun", chance: .15, turns: 1 }] }] },
    stormbird: { name: "นกอินทรีพายุ", role: "attack", art: "swooper", look: STORM, glow: STORMGLOW, tier: 4.8, spd: 132, skills: [{ name: "ดิ่งฟ้าผ่า", cd: 3, target: "back", power: 1.6, fx: [{ k: "stun", chance: .3, turns: 1 }] }] },
    stormking: {
      name: "ราชาเห็ดอสนี", role: "balance", art: "king", look: STORM, glow: STORMGLOW, tier: 4.8, boss: true, hp: 4.4, atk: 1.45, def: 1.5,
      skills: [
        { name: "อัสนีบาตถล่ม", cd: 3, target: "all", power: 1.35, fx: [{ k: "stun", chance: .25, turns: 1 }] },
        { name: "ค้อนฟ้าคำราม", cd: 4, first: 1, target: "front", power: 1.9, fx: [{ k: "defDown", v: .3, turns: 2 }] }
      ]
    },
    stormqueen: {
      name: "ราชินีพายุ", role: "magic", art: "queen", look: STORM, glow: STORMGLOW, tier: 4.8, boss: true, hp: 4, atk: 1.4, def: 1.3, spd: 134,
      skills: [
        { name: "ห่าฝนสายฟ้า", cd: 3, target: "random", hits: 5, power: .75, fx: [{ k: "stun", chance: .2, turns: 1 }] },
        { name: "จุมพิตอัสนี", cd: 4, first: 1, target: "one", power: 3.1, drain: .5, fx: [{ k: "stun", chance: .5, turns: 1 }] }
      ]
    }
  });

  // Chapter 13: the neon fungus forest: glowing spore creatures that poison,
  // soften armour, feed each other and burst.
  const NEONGLOW = "rgba(120,255,240,.95)";
  const NEON = "sepia(1) saturate(3.4) hue-rotate(255deg) contrast(1.2) brightness(1.1)";
  Object.assign(FOES, {
    neonshroom: { name: "เห็ดนีออน", role: "balance", art: "walker", look: NEON, glow: NEONGLOW, tier: 5.2, def: 1.2, skills: [{ name: "สปอร์เรืองแสง", cd: 3, target: "front", power: 1.3, fx: [{ k: "burn", power: .35, turns: 2 }] }] },
    sporebat: { name: "ค้างคาวสปอร์", role: "attack", art: "bat", look: NEON, glow: NEONGLOW, tier: 5.2, spd: 134, skills: [{ name: "โปรยสปอร์พิษ", cd: 3, target: "back", power: 1.3, fx: [{ k: "burn", power: .3, turns: 2 }, { k: "defDown", v: .15, turns: 2 }] }] },
    mosscrab: { name: "ปูตะไคร่เรืองแสง", role: "attack", art: "crab", look: NEON, glow: NEONGLOW, tier: 5.2, def: 1.7, skills: [{ name: "ก้ามเชื้อรา", cd: 3, target: "one", power: 2.6, drain: .3, fx: [{ k: "defDown", v: .3, turns: 2 }] }] },
    sporejelly: { name: "แมงกะพรุนสปอร์", role: "support", art: "jelly", look: NEON, glow: NEONGLOW, tier: 5.2, skills: [{ name: "ละอองชุบชีวิต", cd: 3, target: "allies", heal: 1.25, fx: [{ k: "atkUp", v: .2, turns: 2 }] }] },
    puffroller: { name: "ลูกพัฟบอล", role: "defense", art: "roller", look: NEON, glow: NEONGLOW, tier: 5.2, atk: 1.4, def: 1.3, skills: [{ name: "พัฟบอลระเบิด", cd: 3, target: "front", power: 1.55, fx: [{ k: "stun", chance: .25, turns: 1 }] }] },
    capurchin: { name: "เม่นหมวกเห็ด", role: "defense", art: "urchin", look: NEON, glow: NEONGLOW, tier: 5.2, skills: [{ name: "หมวกเห็ดกำบัง", cd: 4, target: "allies", shield: 1.3, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2, on: "self" }] }] },
    glowflower: { name: "ดอกไม้นีออน", role: "magic", art: "spitter", look: NEON, glow: NEONGLOW, tier: 5.2, skills: [{ name: "แสงนีออนแผดเผา", cd: 3, target: "all", power: 1.05, fx: [{ k: "burn", power: .3, turns: 2 }] }] },
    mothbird: { name: "ผีเสื้อกลางคืนเรืองแสง", role: "attack", art: "swooper", look: NEON, glow: NEONGLOW, tier: 5.2, spd: 132, skills: [{ name: "ฝุ่นปีกมึนงง", cd: 3, target: "back", power: 1.55, fx: [{ k: "stun", chance: .35, turns: 1 }] }] },
    neonking: {
      name: "ราชาเห็ดนีออน", role: "balance", art: "king", look: NEON, glow: NEONGLOW, tier: 5.2, boss: true, hp: 4.4, atk: 1.45, def: 1.5,
      skills: [
        { name: "ป่าสปอร์ปะทุ", cd: 3, target: "all", power: 1.3, fx: [{ k: "burn", power: .4, turns: 2 }, { k: "defDown", v: .2, turns: 2 }] },
        { name: "รากใยราดูดกลืน", cd: 4, first: 1, target: "front", power: 1.9, drain: .5, fx: [{ k: "stun", chance: .35, turns: 1 }] }
      ]
    },
    sporequeen: {
      name: "ราชินีสปอร์", role: "magic", art: "queen", look: NEON, glow: NEONGLOW, tier: 5.2, boss: true, hp: 4, atk: 1.4, def: 1.3, spd: 134,
      skills: [
        { name: "พายุสปอร์นีออน", cd: 3, target: "all", power: 1.45, fx: [{ k: "burn", power: .45, turns: 2 }] },
        { name: "จุมพิตเห็ดพิษ", cd: 4, first: 1, target: "one", power: 3.1, drain: .6, fx: [{ k: "stun", chance: .5, turns: 1 }] }
      ]
    }
  });

  // ---- New faces ----
  // Bosses with art of their own: each takes the place of its chapter's
  // mushroom king on the chapter's last stage, with the king's strength.
  const UNIQUE_BOSSES = [
    { id: "serpentboss", from: "king", stage: 20, art: "serpent", name: "นาคีวารี", glow: "rgba(120,240,255,.95)", skills: ["คลื่นน้ำวนนาคี", "หางนาคฟาด"] },
    { id: "golemboss", from: "lavaking", stage: 30, art: "golem", name: "ยักษ์ลาวา", glow: "rgba(255,140,40,.95)", skills: ["หมัดลาวาปะทุ", "แผ่นดินไหวเพลิง"] },
    { id: "icedragonboss", from: "frostking", stage: 40, art: "icedragon", name: "มังกรน้ำแข็ง", glow: "rgba(170,230,255,.95)", skills: ["ลมหายใจเยือกแข็ง", "กรงเล็บธารน้ำแข็ง"] },
    { id: "reaperboss", from: "shadowking", stage: 50, art: "reaper", name: "ยมทูตเงา", glow: "rgba(190,110,255,.95)", skills: ["เคียวเก็บวิญญาณ", "ม่านเงามรณะ"] },
    { id: "krakenboss", from: "abyssking", stage: 80, art: "kraken", name: "คราเคนยักษ์", glow: "rgba(90,255,210,.95)", skills: ["หนวดยักษ์รัดแน่น", "หมึกมืดห้วงลึก"] }
  ];
  for (const u of UNIQUE_BOSSES) {
    const base = FOES[u.from];
    FOES[u.id] = { ...base, name: u.name, art: u.art, look: undefined, hue: undefined, glow: u.glow, skills: base.skills.map((s, n) => ({ ...s, name: u.skills[n] || s.name })) };
  }
  // New monsters, drawn by cards.js (slime, ghost, wisp, mimic, rockling,
  // crystal spider). They live in the tower, a copy per ten floors.
  const NEW_FOES = {
    slime: { name: "สไลม์", role: "defense", art: "slime", hp: 1.3, skills: [{ name: "เมือกเหนียวหนึบ", cd: 3, target: "front", power: .9, fx: [{ k: "stun", chance: .2, turns: 1 }] }] },
    ghost: { name: "ภูตผีน้อย", role: "support", art: "ghost", skills: [{ name: "เสียงหอนปลุกพวก", cd: 3, target: "allies", heal: 1, fx: [{ k: "atkUp", v: .2, turns: 2 }] }] },
    wisp: { name: "วิญญาณไฟ", role: "attack", art: "wisp", spd: 118, skills: [{ name: "เปลวไฟพุ่ง", cd: 3, target: "back", power: 1.3, fx: [{ k: "burn", power: .3, turns: 2 }] }] },
    mimic: { name: "หีบมิมิค", role: "attack", art: "mimic", def: 1.3, skills: [{ name: "งับเหรียญทอง", cd: 3, target: "one", power: 2.2, drain: .3 }] },
    rockling: { name: "ยักษ์หินจิ๋ว", role: "defense", art: "rockling", skills: [{ name: "เกราะหินผา", cd: 4, target: "self", shield: 2, fx: [{ k: "shield", turns: 2 }, { k: "taunt", turns: 2 }] }] },
    spider: { name: "แมงมุมคริสตัล", role: "magic", art: "spider", skills: [{ name: "ใยคริสตัล", cd: 3, target: "all", power: .75, fx: [{ k: "stun", chance: .15, turns: 1 }, { k: "defDown", v: .15, turns: 2 }] }] }
  };

  // ---- The tower: 100 floors, a boss on every one ----
  // Floors come ten at a time from a chapter (its monsters, its strength);
  // the tenth floor of each ten is a great boss.
  const TOWER_FLOORS = 100;
  // levels above the chapter's stages, by ten floors
  const TOWER_LIFT = [3, 3, 3, 3, 2, 1, 1, 0, 0, -2];
  const TOWER_KINGS = ["king", "king", "lavaking", "frostking", "shadowking", "heavenking", "cosmicking", "abyssking", "clockking", "jadeking"];
  const TOWER_QUEENS = ["queen", "queen", "sunqueen", "icequeen", "eclipsequeen", "starqueen", "nebulaqueen", "abyssking", "brassqueen", "jadeking"];
  const TOWER_GREAT = ["queen", "serpentboss", "golemboss", "icedragonboss", "reaperboss", "starqueen", "nebulaqueen", "krakenboss", "brassqueen", "jadequeen"];
  for (let g = 1; g <= 10; g++) {
    const tier = FOES[TOWER_KINGS[g - 1]].tier || 1;
    for (const [id, def] of Object.entries(NEW_FOES)) FOES[`${id}${g}`] = { ...def, tier };
  }
  // Monsters are a little softer than cards of the same level.
  const FOE_SCALE = { hp: .85, atk: .9, def: 1 };

  // Stages: each wave is "front,front/back,back,back". lv is the monsters'
  // level, card the card given for the first clear.
  const CHAPTERS = [
    { name: "บทที่ 1 · ป่าเชอร์รี่ยามค่ำ", from: 1, to: 10 },
    { name: "บทที่ 2 · ทะเลสาบภาพฝัน", from: 11, to: 20 },
    { name: "บทที่ 3 · ดินแดนเปลวสุริยะ", from: 21, to: 30 },
    { name: "บทที่ 4 · ยอดเขาน้ำแข็งนิรันดร์", from: 31, to: 40 },
    { name: "บทที่ 5 · อาณาจักรเงาราตรี", from: 41, to: 50 },
    { name: "บทที่ 6 · วิหารสวรรค์ดวงดาว", from: 51, to: 60 },
    { name: "บทที่ 7 · ห้วงจักรวาลเนบิวลา", from: 61, to: 70 },
    { name: "บทที่ 8 · มหาสมุทรห้วงลึก", from: 71, to: 80 },
    { name: "บทที่ 9 · นครจักรกลลอยฟ้า", from: 81, to: 90 },
    { name: "บทที่ 10 · หุบเขามังกรหยก", from: 91, to: 100 },
    { name: "บทที่ 11 · ปราสาทจันทร์สีเลือด", from: 101, to: 110 },
    { name: "บทที่ 12 · ยอดเขาพายุอสนี", from: 111, to: 120 },
    { name: "บทที่ 13 · ป่าเห็ดนีออน", from: 121, to: 130 }
  ];
  const STAGE_LIST = [
    ["ทางเข้าป่าเชอร์รี่", 1, ["walker", "walker,walker"]],
    ["ลานหิ่งห้อย", 1, ["walker,walker", "walker/bat", "walker,walker/bat"], "kitten"],
    ["สะพานไม้เก่า", 2, ["hopper,walker", "walker,hopper/bat", "hopper,hopper/spitter"]],
    ["ดงดอกพ่นเมล็ด", 2, ["walker/spitter", "hopper/spitter,spitter", "walker,walker/spitter,bat"], "pangji"],
    ["บัลลังก์เห็ดหนาม", 3, ["walker,walker/bat", "hopper,urchin/spitter", "king/walker,walker"], "baitoey"],
    ["ถ้ำค้างคาว", 4, ["bat,bat/bat", "urchin/bat,bat", "urchin,walker/bat,bat"]],
    ["ทุ่งเม่นหนาม", 4, ["urchin,urchin", "urchin,hopper/spitter", "urchin,urchin/spitter,bat"], "minibat"],
    ["หุบเขาลมหนาว", 5, ["hopper,hopper/bat,bat", "walker,urchin/spitter,spitter", "hopper,urchin/bat,spitter,bat"]],
    ["ป่าลึกยามดึก", 6, ["walker,walker/bat,spitter", "urchin,hopper/bat,bat,spitter", "urchin,walker/spitter,spitter,bat"]],
    ["รังราชินีค้างคาว", 6, ["bat,bat/bat,bat", "urchin,urchin/spitter,spitter", "queen/bat,bat"], "ikuya"],
    ["ชายหาดแมงกะพรุน", 8, ["crab,crab/jelly", "crab,roller/jelly", "crab,crab/jelly,swooper"]],
    ["แนวปะการัง", 7, ["roller,crab/jelly", "roller,roller/swooper", "crab,roller/jelly,swooper"], "starsprite"],
    ["ท่าเรือโคมลอย", 8, ["crab/swooper,swooper", "roller,urchin/swooper,jelly", "crab,crab/swooper,swooper,jelly"]],
    ["ถ้ำคริสตัล", 9, ["roller,roller/spitter", "urchin,roller/jelly,spitter", "roller,roller/jelly,spitter,swooper"]],
    ["ราชาเห็ดคืนชีพ", 9, ["crab,roller/jelly,swooper", "urchin,crab/jelly,jelly,spitter", "king/jelly,swooper"], "pupav2"],
    ["เกาะลอยฟ้า", 10, ["crab,crab/swooper,swooper", "roller,urchin/jelly,bat,swooper", "crab,roller/swooper,jelly,bat"]],
    ["สวนฝันกลับหัว", 11, ["hopper,roller/jelly,spitter", "urchin,crab/spitter,spitter,jelly", "roller,crab/swooper,jelly,spitter"]],
    ["ทะเลดาว", 10, ["crab,crab/bat,bat,jelly", "urchin,urchin/swooper,swooper,jelly", "roller,crab/spitter,swooper,jelly"], "dragon"],
    ["ประตูวังราตรี", 14, ["urchin,roller/jelly,jelly,spitter", "crab,crab/swooper,bat,jelly", "roller,urchin/swooper,spitter,jelly"]],
    ["ราชาและราชินี", 13, ["crab,roller/jelly,swooper,spitter", "urchin,urchin/jelly,jelly,bat", "king,queen/jelly"]],
    ["ประตูเปลวสุริยะ", 17, ["lavashroom,lavashroom/firebat", "magmacrab,lavashroom/flamespitter", "magmacrab,cinderroller/firebat,flamespitter"]],
    ["ทุ่งถ่านแดง", 18, ["cinderroller,lavashroom/emberjelly", "magmacrab,magmacrab/flamespitter,firebat", "cinderroller,magmacrab/emberjelly,ashowl"]],
    ["ถ้ำลาวาหลับใหล", 19, ["lavashroom,cinderroller/flamespitter,flamespitter", "magmacrab,urchin/emberjelly,firebat", "cinderroller,cinderroller/flamespitter,emberjelly,ashowl"]],
    ["สะพานหินหลอมเหลว", 20, ["magmacrab,magmacrab/ashowl,ashowl", "cinderroller,lavashroom/emberjelly,flamespitter,firebat", "magmacrab,cinderroller/emberjelly,ashowl,flamespitter"]],
    ["ปล่องภูเขาไฟ", 21, ["lavashroom,magmacrab/firebat,flamespitter", "cinderroller,cinderroller/emberjelly,emberjelly", "lavaking/flamespitter,firebat"]],
    ["ป่าเถ้าถ่าน", 22, ["lavashroom,lavashroom/ashowl,firebat,flamespitter", "magmacrab,cinderroller/emberjelly,ashowl,ashowl", "magmacrab,magmacrab/emberjelly,flamespitter,firebat"]],
    ["ทะเลสาบเพลิง", 23, ["cinderroller,magmacrab/emberjelly,flamespitter", "lavashroom,cinderroller/firebat,firebat,emberjelly", "magmacrab,cinderroller/ashowl,flamespitter,emberjelly"]],
    ["หอคอยตะวันแดง", 24, ["magmacrab,magmacrab/flamespitter,flamespitter,ashowl", "cinderroller,lavashroom/emberjelly,emberjelly,firebat", "magmacrab,cinderroller/ashowl,ashowl,emberjelly"]],
    ["ลานบูชาสุริยะ", 25, ["cinderroller,cinderroller/emberjelly,flamespitter,firebat", "magmacrab,lavashroom/ashowl,emberjelly,flamespitter", "lavaking/emberjelly,ashowl"]],
    ["บัลลังก์ราชินีสุริยะ", 26, ["magmacrab,cinderroller/emberjelly,flamespitter,ashowl", "lavashroom,magmacrab/emberjelly,emberjelly,firebat", "lavaking,sunqueen/emberjelly"]],
    ["เชิงเขาหิมะ", 31, ["frostshroom,frostshroom/snowbat", "icecrab,frostshroom/frostflower", "icecrab,glacierroller/snowbat,frostflower"]],
    ["ป่าสนน้ำแข็ง", 32, ["glacierroller,frostshroom/frostjelly", "iceurchin,icecrab/frostflower,snowbat", "glacierroller,icecrab/frostjelly,blizzardbird"]],
    ["ทะเลสาบเยือกแข็ง", 33, ["icecrab,icecrab/frostflower,snowbat", "iceurchin,glacierroller/frostjelly,frostflower", "icecrab,glacierroller/blizzardbird,blizzardbird,frostjelly"]],
    ["ถ้ำผลึกน้ำแข็ง", 34, ["iceurchin,frostshroom/frostflower,frostflower", "glacierroller,glacierroller/frostjelly,snowbat", "iceurchin,icecrab/frostjelly,frostflower,blizzardbird"]],
    ["ประตูพายุหิมะ", 35, ["frostshroom,icecrab/snowbat,frostflower", "glacierroller,iceurchin/frostjelly,frostjelly", "frostking/frostflower,snowbat"]],
    ["สะพานธารน้ำแข็ง", 36, ["icecrab,glacierroller/blizzardbird,snowbat,frostflower", "iceurchin,frostshroom/frostjelly,blizzardbird", "icecrab,icecrab/frostjelly,frostflower,snowbat"]],
    ["หุบเขาลมหนาว", 37, ["glacierroller,glacierroller/frostjelly,frostflower,snowbat", "iceurchin,icecrab/blizzardbird,blizzardbird,frostjelly", "icecrab,frostshroom/frostflower,frostflower,frostjelly"]],
    ["ยอดผาน้ำแข็ง", 38, ["iceurchin,iceurchin/frostflower,frostflower,blizzardbird", "icecrab,glacierroller/frostjelly,frostjelly,snowbat", "glacierroller,icecrab/blizzardbird,frostflower,frostjelly"]],
    ["วิหารออโรรา", 38, ["icecrab,glacierroller/frostjelly,frostflower,blizzardbird", "iceurchin,frostshroom/frostjelly,snowbat,frostflower", "frostking/frostjelly,blizzardbird"]],
    ["บัลลังก์ราชินีหิมะ", 39, ["glacierroller,icecrab/frostjelly,frostflower,blizzardbird", "iceurchin,iceurchin/frostjelly,frostjelly,snowbat", "frostking,icequeen/frostjelly"]],
    ["ประตูสุริยคราส", 38, ["shadowshroom,shadowshroom/voidbat", "shadowcrab,shadowshroom/nightflower", "shadowcrab,duskroller/voidbat,nightflower"]],
    ["ทุ่งเงาราตรี", 39, ["duskroller,shadowshroom/voidjelly", "duskurchin,shadowcrab/nightflower,voidbat", "duskroller,shadowcrab/voidjelly,wraithbird"]],
    ["ป่าวิญญาณ", 40, ["shadowcrab,shadowcrab/nightflower,voidbat", "duskurchin,duskroller/voidjelly,nightflower", "shadowcrab,duskroller/wraithbird,wraithbird,voidjelly"]],
    ["ถ้ำผลึกมืด", 41, ["duskurchin,shadowshroom/nightflower,nightflower", "duskroller,duskroller/voidjelly,voidbat", "duskurchin,shadowcrab/voidjelly,nightflower,wraithbird"]],
    ["ปราสาทเงา", 42, ["shadowshroom,shadowcrab/voidbat,nightflower", "duskroller,duskurchin/voidjelly,voidjelly", "shadowking/nightflower,voidbat"]],
    ["สะพานห้วงมืด", 43, ["shadowcrab,duskroller/wraithbird,voidbat,nightflower", "duskurchin,shadowshroom/voidjelly,wraithbird", "shadowcrab,shadowcrab/voidjelly,nightflower,voidbat"]],
    ["หอคอยไร้แสง", 44, ["duskroller,duskroller/voidjelly,nightflower,voidbat", "duskurchin,shadowcrab/wraithbird,wraithbird,voidjelly", "shadowcrab,shadowshroom/nightflower,nightflower,voidjelly"]],
    ["ห้องโถงพระจันทร์ดับ", 45, ["duskurchin,duskurchin/nightflower,nightflower,wraithbird", "shadowcrab,duskroller/voidjelly,voidjelly,voidbat", "duskroller,shadowcrab/wraithbird,nightflower,voidjelly"]],
    ["แท่นบูชาความมืด", 46, ["shadowcrab,duskroller/voidjelly,nightflower,wraithbird", "duskurchin,shadowshroom/voidjelly,voidbat,nightflower", "shadowking/voidjelly,wraithbird"]],
    ["บัลลังก์ราชินีสุริยคราส", 47, ["duskroller,shadowcrab/voidjelly,nightflower,wraithbird", "duskurchin,duskurchin/voidjelly,voidjelly,voidbat", "shadowking,eclipsequeen/voidjelly"]],
    ["บันไดสู่สวรรค์", 47, ["haloshroom,haloshroom/seraphbat", "goldcrab,haloshroom/starflower", "goldcrab,sunroller/seraphbat,starflower"]],
    ["ทุ่งเมฆทองคำ", 48, ["sunroller,haloshroom/lightjelly", "haloburchin,goldcrab/starflower,seraphbat", "sunroller,goldcrab/lightjelly,angelbird"]],
    ["สวนลอยฟ้า", 49, ["goldcrab,goldcrab/starflower,seraphbat", "haloburchin,sunroller/lightjelly,starflower", "goldcrab,sunroller/angelbird,angelbird,lightjelly"]],
    ["ระเบียงดวงดาว", 50, ["haloburchin,haloshroom/starflower,starflower", "sunroller,sunroller/lightjelly,seraphbat", "haloburchin,goldcrab/lightjelly,starflower,angelbird"]],
    ["ประตูทองคำ", 51, ["haloshroom,goldcrab/seraphbat,starflower", "sunroller,haloburchin/lightjelly,lightjelly", "heavenking/starflower,seraphbat"]],
    ["สะพานสายรุ้งสวรรค์", 52, ["goldcrab,sunroller/angelbird,seraphbat,starflower", "haloburchin,haloshroom/lightjelly,angelbird", "goldcrab,goldcrab/lightjelly,starflower,seraphbat"]],
    ["หอระฆังแสง", 53, ["sunroller,sunroller/lightjelly,starflower,seraphbat", "haloburchin,goldcrab/angelbird,angelbird,lightjelly", "goldcrab,haloshroom/starflower,starflower,lightjelly"]],
    ["ห้องโถงทางช้างเผือก", 54, ["haloburchin,haloburchin/starflower,starflower,angelbird", "goldcrab,sunroller/lightjelly,lightjelly,seraphbat", "sunroller,goldcrab/angelbird,starflower,lightjelly"]],
    ["แท่นบูชาสุริยจันทรา", 55, ["goldcrab,sunroller/lightjelly,starflower,angelbird", "haloburchin,haloshroom/lightjelly,seraphbat,starflower", "heavenking/lightjelly,angelbird"]],
    ["บัลลังก์ราชินีดวงดาว", 56, ["sunroller,goldcrab/lightjelly,starflower,angelbird", "haloburchin,haloburchin/lightjelly,lightjelly,seraphbat", "heavenking,starqueen/lightjelly"]],
    ["ประตูสู่ห้วงอวกาศ", 56, ["nebulashroom,nebulashroom/cometbat", "starcrab,nebulashroom/galaxyflower", "starcrab,meteorroller/cometbat,galaxyflower"]],
    ["ทุ่งอุกกาบาต", 57, ["meteorroller,nebulashroom/cosmicjelly", "voidurchin,starcrab/galaxyflower,cometbat", "meteorroller,starcrab/cosmicjelly,orbitbird"]],
    ["สวนดาวหาง", 58, ["starcrab,starcrab/galaxyflower,cometbat", "voidurchin,meteorroller/cosmicjelly,galaxyflower", "starcrab,meteorroller/orbitbird,orbitbird,cosmicjelly"]],
    ["วงแหวนดาวเคราะห์", 59, ["voidurchin,nebulashroom/galaxyflower,galaxyflower", "meteorroller,meteorroller/cosmicjelly,cometbat", "voidurchin,starcrab/cosmicjelly,galaxyflower,orbitbird"]],
    ["ใจกลางเนบิวลา", 60, ["nebulashroom,starcrab/cometbat,galaxyflower", "meteorroller,voidurchin/cosmicjelly,cosmicjelly", "cosmicking/galaxyflower,cometbat"]],
    ["สะพานทางช้างเผือก", 61, ["starcrab,meteorroller/orbitbird,cometbat,galaxyflower", "voidurchin,nebulashroom/cosmicjelly,orbitbird", "starcrab,starcrab/cosmicjelly,galaxyflower,cometbat"]],
    ["หลุมดำนิรันดร์", 62, ["meteorroller,meteorroller/cosmicjelly,galaxyflower,cometbat", "voidurchin,starcrab/orbitbird,orbitbird,cosmicjelly", "starcrab,nebulashroom/galaxyflower,galaxyflower,cosmicjelly"]],
    ["ซูเปอร์โนวา", 63, ["voidurchin,voidurchin/galaxyflower,galaxyflower,orbitbird", "starcrab,meteorroller/cosmicjelly,cosmicjelly,cometbat", "meteorroller,starcrab/orbitbird,galaxyflower,cosmicjelly"]],
    ["แท่นกำเนิดดวงดาว", 63, ["starcrab,meteorroller/cosmicjelly,galaxyflower,orbitbird", "voidurchin,nebulashroom/cosmicjelly,cometbat,galaxyflower", "cosmicking/cosmicjelly,orbitbird"]],
    ["บัลลังก์ราชินีเนบิวลา", 57, ["meteorroller,starcrab/cosmicjelly,galaxyflower,orbitbird", "voidurchin,voidurchin/cosmicjelly,cosmicjelly,cometbat", "cosmicking,nebulaqueen/cosmicjelly"]],
    ["ประตูสู่ห้วงลึก", 58, ["deepshroom,deepshroom/anglerbat", "abysscrab,deepshroom/poisonflower", "abysscrab,tideroller/anglerbat,poisonflower"]],
    ["แนวปะการังเรืองแสง", 59, ["tideroller,deepshroom/glowjelly", "coralurchin,abysscrab/poisonflower,anglerbat", "tideroller,abysscrab/glowjelly,sharkbird"]],
    ["ป่าสาหร่ายยักษ์", 60, ["abysscrab,abysscrab/poisonflower,anglerbat", "coralurchin,tideroller/glowjelly,poisonflower", "abysscrab,tideroller/sharkbird,sharkbird,glowjelly"]],
    ["ซากเรืออับปาง", 61, ["coralurchin,deepshroom/poisonflower,poisonflower", "tideroller,tideroller/glowjelly,anglerbat", "coralurchin,abysscrab/glowjelly,poisonflower,sharkbird"]],
    ["ถ้ำมุกนิรันดร์", 62, ["deepshroom,abysscrab/anglerbat,poisonflower", "tideroller,coralurchin/glowjelly,glowjelly", "abyssking/poisonflower,anglerbat"]],
    ["เหวมืดใต้สมุทร", 63, ["abysscrab,tideroller/sharkbird,anglerbat,poisonflower", "coralurchin,deepshroom/glowjelly,sharkbird", "abysscrab,abysscrab/glowjelly,poisonflower,anglerbat"]],
    ["เมืองบาดาลที่สาบสูญ", 64, ["tideroller,tideroller/glowjelly,poisonflower,anglerbat", "coralurchin,abysscrab/sharkbird,sharkbird,glowjelly", "abysscrab,deepshroom/poisonflower,poisonflower,glowjelly"]],
    ["น้ำวนยักษ์", 64, ["coralurchin,coralurchin/poisonflower,poisonflower,sharkbird", "abysscrab,tideroller/glowjelly,glowjelly,anglerbat", "tideroller,abysscrab/sharkbird,poisonflower,glowjelly"]],
    ["วิหารมุกดำ", 63, ["abysscrab,tideroller/glowjelly,poisonflower,sharkbird", "coralurchin,deepshroom/glowjelly,anglerbat,poisonflower", "abyssking/glowjelly,sharkbird"]],
    ["บัลลังก์ราชินีคราเคน", 55, ["tideroller,abysscrab/glowjelly,poisonflower,sharkbird", "coralurchin,coralurchin/glowjelly,glowjelly,anglerbat", "abyssking,krakenqueen/glowjelly"]],
    ["ท่าเรือเหาะ", 56, ["gearshroom,gearshroom/rotorbat", "drillcrab,gearshroom/teslaflower", "drillcrab,steamroller/rotorbat,teslaflower"]],
    ["โรงงานเฟืองยักษ์", 57, ["steamroller,gearshroom/oiljelly", "cogurchin,drillcrab/teslaflower,rotorbat", "steamroller,drillcrab/oiljelly,airshipbird"]],
    ["ตลาดลอยฟ้า", 58, ["drillcrab,drillcrab/teslaflower,rotorbat", "cogurchin,steamroller/oiljelly,teslaflower", "drillcrab,steamroller/airshipbird,airshipbird,oiljelly"]],
    ["หอนาฬิกาทองเหลือง", 59, ["cogurchin,gearshroom/teslaflower,teslaflower", "steamroller,steamroller/oiljelly,rotorbat", "cogurchin,drillcrab/oiljelly,teslaflower,airshipbird"]],
    ["ห้องหม้อไอน้ำ", 60, ["gearshroom,drillcrab/rotorbat,teslaflower", "steamroller,cogurchin/oiljelly,oiljelly", "clockking/teslaflower,rotorbat"]],
    ["รางรถไฟเมฆ", 60, ["drillcrab,steamroller/airshipbird,rotorbat,teslaflower", "cogurchin,gearshroom/oiljelly,airshipbird", "drillcrab,drillcrab/oiljelly,teslaflower,rotorbat"]],
    ["สะพานขดลวดเทสลา", 60, ["steamroller,steamroller/oiljelly,teslaflower,rotorbat", "cogurchin,drillcrab/airshipbird,airshipbird,oiljelly", "drillcrab,gearshroom/teslaflower,teslaflower,oiljelly"]],
    ["อู่เรือเหาะหลวง", 61, ["cogurchin,cogurchin/teslaflower,teslaflower,airshipbird", "drillcrab,steamroller/oiljelly,oiljelly,rotorbat", "steamroller,drillcrab/airshipbird,teslaflower,oiljelly"]],
    ["แกนกลางจักรกล", 60, ["drillcrab,steamroller/oiljelly,teslaflower,airshipbird", "cogurchin,gearshroom/oiljelly,rotorbat,teslaflower", "clockking/oiljelly,airshipbird"]],
    ["บัลลังก์ราชินีกลไก", 50, ["steamroller,drillcrab/oiljelly,teslaflower,airshipbird", "cogurchin,cogurchin/oiljelly,oiljelly,rotorbat", "clockking,brassqueen/oiljelly"]],
    ["ประตูหุบเขาหยก", 57, ["jadeshroom,jadeshroom/lanternbat", "jadecrab,jadeshroom/lotusflower", "jadecrab,stoneroller/lanternbat,lotusflower"]],
    ["ป่าไผ่หมอก", 58, ["stoneroller,jadeshroom/spiritjelly", "bambooburchin,jadecrab/lotusflower,lanternbat", "stoneroller,jadecrab/spiritjelly,cranebird"]],
    ["ธารน้ำตกมรกต", 59, ["jadecrab,jadecrab/lotusflower,lanternbat", "bambooburchin,stoneroller/spiritjelly,lotusflower", "jadecrab,stoneroller/cranebird,cranebird,spiritjelly"]],
    ["เจดีย์โคมแดง", 60, ["bambooburchin,jadeshroom/lotusflower,lotusflower", "stoneroller,stoneroller/spiritjelly,lanternbat", "bambooburchin,jadecrab/spiritjelly,lotusflower,cranebird"]],
    ["ลานฝึกยุทธ์หยก", 60, ["jadeshroom,jadecrab/lanternbat,lotusflower", "stoneroller,bambooburchin/spiritjelly,spiritjelly", "jadeking/lotusflower,lanternbat"]],
    ["สะพานเมฆเก้าชั้น", 59, ["jadecrab,stoneroller/cranebird,lanternbat,lotusflower", "bambooburchin,jadeshroom/spiritjelly,cranebird", "jadecrab,jadecrab/spiritjelly,lotusflower,lanternbat"]],
    ["ถ้ำมุกมังกร", 59, ["stoneroller,stoneroller/spiritjelly,lotusflower,lanternbat", "bambooburchin,jadecrab/cranebird,cranebird,spiritjelly", "jadecrab,jadeshroom/lotusflower,lotusflower,spiritjelly"]],
    ["ยอดเขาเทพเซียน", 57, ["bambooburchin,bambooburchin/lotusflower,lotusflower,cranebird", "jadecrab,stoneroller/spiritjelly,spiritjelly,lanternbat", "stoneroller,jadecrab/cranebird,lotusflower,spiritjelly"]],
    ["ตำหนักหยกสวรรค์", 58, ["jadecrab,stoneroller/spiritjelly,lotusflower,cranebird", "bambooburchin,jadeshroom/spiritjelly,lanternbat,lotusflower", "jadeking/spiritjelly,cranebird"]],
    ["บัลลังก์ราชินีมังกรหยก", 45, ["stoneroller,jadecrab/spiritjelly,lotusflower,cranebird", "bambooburchin,bambooburchin/spiritjelly,spiritjelly,lanternbat", "jadeking,jadequeen/spiritjelly"]],
    ["สุสานใต้จันทร์แดง", 54, ["bloodshroom,bloodshroom/vampbat", "gravecrab,bloodshroom/roseflower", "gravecrab,coffinroller/vampbat,roseflower"]],
    ["สวนกุหลาบดำ", 55, ["coffinroller,bloodshroom/bloodjelly", "thornurchin,gravecrab/roseflower,vampbat", "coffinroller,gravecrab/bloodjelly,ravenbird"]],
    ["สะพานโซ่เหล็ก", 56, ["gravecrab,gravecrab/roseflower,vampbat", "thornurchin,coffinroller/bloodjelly,roseflower", "gravecrab,coffinroller/ravenbird,ravenbird,bloodjelly"]],
    ["ประตูปราสาท", 55, ["thornurchin,bloodshroom/roseflower,roseflower", "coffinroller,coffinroller/bloodjelly,vampbat", "thornurchin,gravecrab/bloodjelly,roseflower,ravenbird"]],
    ["ห้องโถงโลหิต", 56, ["bloodshroom,gravecrab/vampbat,roseflower", "coffinroller,thornurchin/bloodjelly,bloodjelly", "bloodking/roseflower,vampbat"]],
    ["ห้องสมุดต้องสาป", 54, ["gravecrab,coffinroller/ravenbird,vampbat,roseflower", "thornurchin,bloodshroom/bloodjelly,ravenbird", "gravecrab,gravecrab/bloodjelly,roseflower,vampbat"]],
    ["หอระฆังอีกา", 52, ["coffinroller,coffinroller/bloodjelly,roseflower,vampbat", "thornurchin,gravecrab/ravenbird,ravenbird,bloodjelly", "gravecrab,bloodshroom/roseflower,roseflower,bloodjelly"]],
    ["ห้องใต้ดินโลงศพ", 50, ["thornurchin,thornurchin/roseflower,roseflower,ravenbird", "gravecrab,coffinroller/bloodjelly,bloodjelly,vampbat", "coffinroller,gravecrab/ravenbird,roseflower,bloodjelly"]],
    ["ระเบียงจันทร์เลือด", 53, ["gravecrab,coffinroller/bloodjelly,roseflower,ravenbird", "thornurchin,bloodshroom/bloodjelly,vampbat,roseflower", "bloodking/bloodjelly,ravenbird"]],
    ["บัลลังก์ราชินีจันทร์เลือด", 45, ["coffinroller,gravecrab/bloodjelly,roseflower,ravenbird", "thornurchin,thornurchin/bloodjelly,bloodjelly,vampbat", "bloodking,bloodqueen/bloodjelly"]],
    ["เชิงเขาเมฆดำ", 70, ["stormshroom,stormshroom/thunderbat", "voltcrab,stormshroom/plasmaflower", "voltcrab,boltroller/thunderbat,plasmaflower"]],
    ["ทุ่งหินลอยฟ้า", 73, ["boltroller,stormshroom/cloudjelly", "rodurchin,voltcrab/plasmaflower,thunderbat", "boltroller,voltcrab/cloudjelly,stormbird"]],
    ["ช่องเขาฟ้าคำราม", 76, ["voltcrab,voltcrab/plasmaflower,thunderbat", "rodurchin,boltroller/cloudjelly,plasmaflower", "voltcrab,boltroller/stormbird,stormbird,cloudjelly"]],
    ["หอคอยสายล่อฟ้า", 79, ["rodurchin,stormshroom/plasmaflower,plasmaflower", "boltroller,boltroller/cloudjelly,thunderbat", "rodurchin,voltcrab/cloudjelly,plasmaflower,stormbird"]],
    ["ลานพายุหมุน", 82, ["stormshroom,voltcrab/thunderbat,plasmaflower", "boltroller,rodurchin/cloudjelly,cloudjelly", "stormking/plasmaflower,thunderbat"]],
    ["สะพานสายรุ้งอสนี", 84, ["voltcrab,boltroller/stormbird,thunderbat,plasmaflower", "rodurchin,stormshroom/cloudjelly,stormbird", "voltcrab,voltcrab/cloudjelly,plasmaflower,thunderbat"]],
    ["ถ้ำผลึกประจุ", 86, ["boltroller,boltroller/cloudjelly,plasmaflower,thunderbat", "rodurchin,voltcrab/stormbird,stormbird,cloudjelly", "voltcrab,stormshroom/plasmaflower,plasmaflower,cloudjelly"]],
    ["ตาพายุ", 88, ["rodurchin,rodurchin/plasmaflower,plasmaflower,stormbird", "voltcrab,boltroller/cloudjelly,cloudjelly,thunderbat", "boltroller,voltcrab/stormbird,plasmaflower,cloudjelly"]],
    ["ยอดเขาอัสนี", 88, ["voltcrab,boltroller/cloudjelly,plasmaflower,stormbird", "rodurchin,stormshroom/cloudjelly,thunderbat,plasmaflower", "stormking/cloudjelly,stormbird"]],
    ["บัลลังก์ราชินีพายุ", 76, ["boltroller,voltcrab/cloudjelly,plasmaflower,stormbird", "rodurchin,voltcrab/cloudjelly,plasmaflower,thunderbat", "stormking,stormqueen/cloudjelly"]],
    ["ปากทางป่าเรืองแสง", 80, ["neonshroom,neonshroom/sporebat", "mosscrab,neonshroom/glowflower", "mosscrab,puffroller/sporebat,glowflower"]],
    ["ลำธารนีออน", 83, ["puffroller,neonshroom/sporejelly", "capurchin,mosscrab/glowflower,sporebat", "puffroller,mosscrab/sporejelly,mothbird"]],
    ["ดงเห็ดยักษ์", 86, ["mosscrab,mosscrab/glowflower,sporebat", "capurchin,puffroller/sporejelly,glowflower", "mosscrab,puffroller/mothbird,mothbird,sporejelly"]],
    ["ถ้ำใยรา", 89, ["capurchin,neonshroom/glowflower,glowflower", "puffroller,puffroller/sporejelly,sporebat", "capurchin,mosscrab/sporejelly,glowflower,mothbird"]],
    ["วงแหวนเห็ดภูต", 92, ["neonshroom,mosscrab/sporebat,glowflower", "puffroller,capurchin/sporejelly,sporejelly", "neonking/glowflower,sporebat"]],
    ["บึงสปอร์", 94, ["mosscrab,puffroller/mothbird,sporebat,glowflower", "capurchin,neonshroom/sporejelly,mothbird", "mosscrab,mosscrab/sporejelly,glowflower,sporebat"]],
    ["สะพานรากไม้", 94, ["puffroller,puffroller/sporejelly,glowflower,sporebat", "capurchin,mosscrab/mothbird,mothbird,sporejelly", "mosscrab,neonshroom/glowflower,glowflower,sporejelly"]],
    ["หัวใจป่าเห็ด", 91, ["capurchin,mosscrab/glowflower,glowflower,mothbird", "mosscrab,puffroller/sporejelly,sporejelly,sporebat", "puffroller,mosscrab/mothbird,glowflower,sporejelly"]],
    ["แท่นสปอร์ราชา", 85, ["mosscrab,puffroller/sporejelly,glowflower,mothbird", "capurchin,neonshroom/sporejelly,sporebat,glowflower", "neonking/sporejelly,mothbird"]],
    ["บัลลังก์ราชินีสปอร์", 82, ["puffroller,mosscrab/sporejelly,glowflower,mothbird", "capurchin,mosscrab/sporejelly,glowflower,sporebat", "sporequeen/sporejelly,sporebat"]]
  ];
  // the chapters' last stages meet their own bosses
  for (const u of UNIQUE_BOSSES) {
    const waves = STAGE_LIST[u.stage - 1][2], last = waves.length - 1;
    waves[last] = waves[last].replace(u.from, u.id);
  }
  const parseWave = (text) => {
    const [front, back = ""] = text.split("/");
    const list = (part, row) => part.split(",").filter(Boolean).map(id => ({ id, row }));
    return [...list(front, "front"), ...list(back, "back")];
  };
  const STAGES = STAGE_LIST.map(([name, lv, waves, card], index) => {
    const num = index + 1;
    const parsed = waves.map(parseWave);
    return {
      num, name, lv, card: card || null,
      waves: parsed,
      boss: parsed.some(wave => wave.some(foe => FOES[foe.id].boss)),
      // the third star: win within this many hero turns
      par: parsed.length * 2 + 2,
      coins: 20 + 5 * num,       // first clear
      repeat: 5 + num,           // every clear after that
      // characters come only from card pulls now: the first clear gives
      // gems for them instead (the old card prize stages give more)
      gems: card ? 80 : parsed.some(wave => wave.some(foe => FOES[foe.id].boss)) ? 60 : 25,
      // star dust for the first clear, from chapter 4 on
      dust: num > 30 ? (parsed.some(wave => wave.some(foe => FOES[foe.id].boss)) ? 20 : 8) : 0,
      // star-up wings for the first clear of a boss stage
      wings: parsed.some(wave => wave.some(foe => FOES[foe.id].boss)) ? 2 : 0
    };
  });

  // ---- Numbers ----
  function statsOf(def, lv, foe) {
    const role = ROLES[def.role];
    const rare = foe ? 1 : RARITY[def.rarity] || 1;
    const scale = foe ? FOE_SCALE : { hp: 1, atk: 1, def: 1 };
    const g = growth(lv);
    return {
      // tier: a later chapter's monsters hit and last a little harder
      hp: Math.round(role.hp * HP_SCALE * (def.hp || 1) * (def.tier || 1) * rare * scale.hp * g),
      atk: Math.round(role.atk * (def.atk || 1) * (def.tier || 1) * rare * scale.atk * g),
      def: Math.round(role.def * (def.def || 1) * rare * scale.def * g),
      spd: Math.round((def.spd || role.spd) + (lv - 1) * .5),
      crit: def.crit || role.crit
    };
  }
  const cardStats = (id, lv) => statsOf(CARDS[id], lv, false);
  // A rough strength number for the team screen.
  const power = (id, lv) => { const s = cardStats(id, lv); return Math.round(s.hp / 10 + s.atk * 2 + s.def * 1.5 + s.spd / 2); };

  // Same seed, same battle (mulberry32).
  function random(b) {
    let t = (b.seed = (b.seed + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // bonus: a costume's extra share of hp, attack and defence.
  function makeUnit(side, slot, id, lv, row, bonus = 0) {
    const foe = side === "foe";
    const def = foe ? FOES[id] : CARDS[id];
    const stats = statsOf(def, lv, foe);
    for (const key of ["hp", "atk", "def"]) stats[key] = Math.round(stats[key] * (1 + bonus));
    return {
      side, slot, id, lv, name: def.name, role: def.role, boss: Boolean(def.boss),
      row: row || (slot < FRONT_SLOTS ? "front" : "back"),
      maxHp: stats.hp, hp: stats.hp, atk: stats.atk, def: stats.def, spd: stats.spd, crit: stats.crit,
      skills: def.skills.map(skill => ({ ...skill, cool: skill.first || 0 })),
      passive: def.passive || null,
      status: [],
      alive: true
    };
  }

  // What the page needs to redraw one card mid-animation.
  const snap = (u) => ({ hp: u.hp, maxHp: u.maxHp, sh: shieldOf(u), st: u.status.map(s => s.k), alive: u.alive });
  const statusOf = (u, k) => u.status.find(s => s.k === k);
  const shieldOf = (u) => statusOf(u, "shield")?.v || 0;
  const buff = (u, k) => statusOf(u, k)?.v || 0;
  const living = (list) => list.filter(u => u && u.alive);
  const own = (b, u) => (u.side === "hero" ? b.heroes : b.foes);
  const other = (b, u) => (u.side === "hero" ? b.foes : b.heroes);

  // ---- Starting a battle ----
  // team: { id, lv, row?, bonus? } or null, by slot (five for a stage, up
  // to ten in the arena; without a row, slots 0-1 are the front).
  // stage: a STAGES entry, or an arena tier (see arenaTier).
  function createBattle({ team, stage, seed = 1 }) {
    const b = {
      stage: stage.num, waves: stage.waves, waveLv: stage.lv, wave: 0,
      seed: seed >>> 0, turn: 0, phase: "hero", result: null, focus: -1,
      heroes: [], foes: []
    };
    for (let slot = 0; slot < team.length; slot++) {
      const entry = team[slot];
      b.heroes[slot] = entry && CARDS[entry.id] ? makeUnit("hero", slot, entry.id, entry.lv, entry.row, entry.bonus || 0) : null;
    }
    for (const hero of living(b.heroes)) {
      if (hero.passive?.shield) addStatus(hero, { k: "shield", v: Math.round(hero.maxHp * hero.passive.shield), turns: 2 });
      // a guardian's passive shields the whole team
      if (hero.passive?.teamShield) for (const ally of living(b.heroes)) addStatus(ally, { k: "shield", v: Math.round(ally.maxHp * hero.passive.teamShield), turns: 2 });
    }
    spawnWave(b);
    b.phase = average(living(b.foes)) > average(living(b.heroes)) ? "foe" : "hero";
    return b;
  }
  const average = (list) => list.reduce((sum, u) => sum + u.spd, 0) / Math.max(1, list.length);

  function spawnWave(b) {
    b.foes = b.waves[b.wave].map((foe, slot) => makeUnit("foe", slot, foe.id, b.waveLv, foe.row));
    b.focus = -1;
  }

  // ---- Statuses ----
  // atkUp, stun and burn count down at the end of their holder's turn;
  // shield, taunt, defUp and defDown at the end of the other side's turn
  // (they matter while being hit), so "2 turns" on a shield means it lasts
  // through two enemy turns.
  const OWN_TICK = new Set(["atkUp", "stun", "burn"]);
  function addStatus(u, s) {
    const old = statusOf(u, s.k);
    if (!old) { u.status.push({ ...s }); return; }
    old.turns = Math.max(old.turns, s.turns);
    old.v = Math.max(old.v || 0, s.v || 0);
  }

  // ---- Hitting and healing ----
  function hurt(b, u, amount, events, crit = false) {
    let left = amount, absorbed = 0;
    const shield = statusOf(u, "shield");
    if (shield) {
      absorbed = Math.min(shield.v, left);
      shield.v -= absorbed; left -= absorbed;
      if (shield.v <= 0) u.status = u.status.filter(s => s !== shield);
    }
    u.hp = Math.max(0, u.hp - left);
    if (u.hp <= 0) { u.alive = false; u.status = []; }
    events.push({ t: "hit", side: u.side, i: u.slot, v: amount, crit, ko: !u.alive, u: snap(u) });
    return left + absorbed;
  }

  function damageRoll(b, from, to, power) {
    const atk = from.atk * (1 + buff(from, "atkUp"));
    let def = to.def * (1 + buff(to, "defUp") - buff(to, "defDown"));
    if (from.role === "magic") def *= .6; // magic slips past armour
    const crit = random(b) < from.crit;
    const vary = .95 + random(b) * .1;
    return { amount: Math.max(1, Math.round(atk * power * (200 / (200 + Math.max(0, def))) * vary * (crit ? 1.5 : 1))), crit };
  }

  function heal(u, amount, events) {
    if (!u.alive) return;
    const gain = Math.min(u.maxHp - u.hp, Math.round(amount));
    u.hp += gain;
    events.push({ t: "heal", side: u.side, i: u.slot, v: gain, u: snap(u) });
  }

  // ---- Picking targets ----
  const rowOf = (list, row) => living(list).filter(u => u.row === row);
  const lowest = (list) => list.reduce((best, u) => (!best || u.hp / u.maxHp < best.hp / best.maxHp ? u : best), null);
  const pick = (b, list) => list[Math.floor(random(b) * list.length)];

  // One enemy: whoever taunts, else the focused monster (heroes only), else
  // heroes go for the weakest of the front row and monsters hit the front
  // row two times in three.
  function singleTarget(b, from) {
    const foes = other(b, from);
    const taunting = living(foes).filter(u => statusOf(u, "taunt"));
    if (taunting.length) return lowest(taunting);
    if (from.side === "hero") {
      const focus = foes[b.focus];
      if (focus?.alive) return focus;
      return lowest(rowOf(foes, "front")) || lowest(living(foes));
    }
    const front = rowOf(foes, "front"), back = rowOf(foes, "back");
    if (front.length && (!back.length || random(b) < .65)) return pick(b, front);
    return pick(b, back.length ? back : living(foes));
  }

  function targetsFor(b, from, skill) {
    const foes = other(b, from), friends = own(b, from);
    switch (skill.target) {
      case "front": { const row = rowOf(foes, "front"); return row.length ? row : living(foes); }
      case "back": { const row = rowOf(foes, "back"); return row.length ? row : living(foes); }
      case "all": return living(foes);
      case "ally": { const one = lowest(living(friends)); return one ? [one] : []; }
      case "allies": return living(friends);
      case "self": return [from];
      default: { const one = singleTarget(b, from); return one ? [one] : []; }
    }
  }

  const BASIC = { name: "", target: "one", power: 1 };
  const hostile = (skill) => ["one", "front", "back", "all", "random"].includes(skill.target);

  // ---- One action ----
  function perform(b, u, skill, events) {
    const index = u.skills.indexOf(skill);
    events.push({ t: "act", side: u.side, i: u.slot, s: index, name: skill.name });
    if (index >= 0) skill.cool = skill.cd;
    let dealt = 0;
    const hitOnce = (target, pow) => {
      const roll = damageRoll(b, u, target, pow);
      dealt += hurt(b, target, roll.amount, events, roll.crit);
      return target;
    };
    const struck = [];
    if (skill.target === "random") {
      for (let n = 0; n < skill.hits; n++) {
        const pool = living(other(b, u));
        if (!pool.length) break;
        struck.push(hitOnce(pick(b, pool), skill.power));
      }
    } else {
      const targets = targetsFor(b, u, skill);
      for (const target of targets) {
        if (skill.power) hitOnce(target, skill.power);
        if (skill.heal) heal(target, u.atk * skill.heal, events);
        if (skill.shield) {
          addStatus(target, { k: "shield", v: Math.round(u.atk * skill.shield), turns: 2 });
          events.push({ t: "shield", side: target.side, i: target.slot, u: snap(target) });
        }
        struck.push(target);
      }
      // Jibjib's flutter: a plain attack sometimes lands twice.
      if (skill === BASIC && u.passive?.double && random(b) < u.passive.double) {
        const again = singleTarget(b, u);
        if (again) { events.push({ t: "act", side: u.side, i: u.slot, s: -1, name: "ตีซ้ำ!" }); hitOnce(again, 1); }
      }
    }
    for (const fx of skill.fx || []) {
      if (fx.k === "shield") continue; // added with the shield amount above
      const on = fx.on === "allies" ? living(own(b, u)) : fx.on === "self" ? [u] : [...new Set(struck)];
      for (const target of on) {
        if (!target.alive) continue;
        if (fx.k === "cleanse") {
          target.status = target.status.filter(s => !["stun", "burn", "defDown"].includes(s.k));
          events.push({ t: "fx", side: target.side, i: target.slot, k: "cleanse", u: snap(target) });
          continue;
        }
        if (fx.chance != null && random(b) >= fx.chance) continue;
        const status = { k: fx.k, turns: fx.turns, v: fx.v || 0 };
        if (fx.k === "burn") status.v = Math.max(1, Math.round(u.atk * fx.power));
        addStatus(target, status);
        events.push({ t: "fx", side: target.side, i: target.slot, k: fx.k, u: snap(target) });
      }
    }
    if (skill.drain && dealt > 0) heal(u, dealt * skill.drain, events);
  }

  // Use the skill if it can be used, else make a plain attack.
  function act(b, u, skill, events) {
    if (statusOf(u, "stun")) { events.push({ t: "skip", side: u.side, i: u.slot }); return; }
    perform(b, u, skill && skill.cool === 0 ? skill : BASIC, events);
  }

  // End of one side's turn: burns, status timers, cooldowns.
  function tick(b, side, events) {
    const mine = side === "hero" ? b.heroes : b.foes;
    const theirs = side === "hero" ? b.foes : b.heroes;
    for (const u of living(mine)) {
      const burn = statusOf(u, "burn");
      if (burn) {
        u.hp = Math.max(0, u.hp - burn.v);
        if (u.hp <= 0) { u.alive = false; u.status = []; }
        events.push({ t: "burn", side: u.side, i: u.slot, v: burn.v, ko: !u.alive, u: snap(u) });
      }
    }
    const count = (u, test) => {
      for (const s of u.status) if (test(s.k)) s.turns--;
      u.status = u.status.filter(s => s.turns > 0);
    };
    for (const u of living(mine)) {
      count(u, k => OWN_TICK.has(k));
      for (const skill of u.skills) skill.cool = Math.max(0, skill.cool - 1);
    }
    for (const u of living(theirs)) count(u, k => !OWN_TICK.has(k));
    for (const u of [...living(mine), ...living(theirs)]) events.push({ t: "status", side: u.side, i: u.slot, u: snap(u) });
  }

  // After every action: has a side been wiped out?
  function settle(b, events) {
    if (!living(b.heroes).length) {
      b.result = "lost"; b.phase = "done";
      events.push({ t: "end", result: "lost" });
      return true;
    }
    if (!living(b.foes).length) {
      if (b.wave + 1 >= b.waves.length) {
        b.result = "won"; b.phase = "done";
        events.push({ t: "end", result: "won" });
      } else b.cleared = true;
      return true;
    }
    return false;
  }

  // A cleared wave hands the turn straight back to the heroes, so the
  // skills not yet used this turn are kept for the next wave.
  function nextWave(b, events) {
    b.cleared = false;
    b.wave++;
    spawnWave(b);
    events.push({ t: "wave", n: b.wave + 1, total: b.waves.length, foes: b.foes.map(snap) });
    b.phase = "hero";
  }

  // ---- Turns ----
  // queue: [{ i: slot, s: 0 | 1 }] in the order the skills should go off.
  // focus: the monster slot single attacks should aim at, or -1.
  function heroTurn(b, queue = [], focus = b.focus) {
    const events = [];
    if (b.phase !== "hero") return events;
    // a fight that drags past MAX_TURNS is lost (it can be tried again)
    if (b.turn >= MAX_TURNS) {
      b.result = "lost"; b.phase = "done";
      events.push({ t: "end", result: "lost", timeout: true });
      return events;
    }
    b.turn++;
    b.focus = focus;
    events.push({ t: "turn", side: "hero", turn: b.turn });
    const done = new Set();
    let over = false;
    for (const { i, s } of queue) {
      const u = b.heroes[i];
      if (!u?.alive || done.has(i)) continue;
      done.add(i);
      act(b, u, u.skills[s], events);
      if ((over = settle(b, events))) break;
    }
    if (!over) {
      const rest = living(b.heroes).filter(u => !done.has(u.slot)).sort((x, y) => y.spd - x.spd);
      for (const u of rest) {
        if (!u.alive) continue;
        act(b, u, null, events);
        if ((over = settle(b, events))) break;
      }
    }
    if (b.phase === "done") return events;
    tick(b, "hero", events);
    if (settle(b, events) && b.phase === "done") return events;
    if (b.cleared) nextWave(b, events);
    else b.phase = "foe";
    return events;
  }

  function enemyTurn(b) {
    const events = [];
    if (b.phase !== "foe") return events;
    events.push({ t: "turn", side: "foe", turn: b.turn });
    const order = living(b.foes).sort((x, y) => y.spd - x.spd);
    for (const u of order) {
      if (!u.alive) continue;
      act(b, u, foeSkill(b, u), events);
      if (settle(b, events)) break;
    }
    if (b.phase === "done") return events;
    tick(b, "foe", events);
    if (settle(b, events) && b.phase === "done") return events;
    if (b.cleared) nextWave(b, events);
    else b.phase = "hero";
    return events;
  }

  // ---- Choosing skills ----
  const ready = (skill) => skill && skill.cool === 0;
  const isHeal = (skill) => skill.heal && !skill.power;
  const isSupport = (skill) => !hostile(skill) && !skill.heal;

  // Monsters: heal when a friend is hurt, raise their spines when not
  // already, otherwise the strongest skill that is ready.
  function foeSkill(b, u) {
    for (let s = u.skills.length - 1; s >= 0; s--) {
      const skill = u.skills[s];
      if (!ready(skill)) continue;
      if (isHeal(skill) && !living(b.foes).some(f => f.hp / f.maxHp < .65)) continue;
      if (skill.target === "self" && statusOf(u, "taunt")) continue;
      return skill;
    }
    return null;
  }

  // The auto button: support first (team buffs, then armour breakers),
  // then damage, heals last; heals only when someone needs one.
  function autoQueue(b) {
    const heroes = living(b.heroes);
    const foes = living(b.foes);
    const hurtHeroes = heroes.filter(u => u.hp / u.maxHp < .75).length;
    const worst = lowest(heroes);
    const troubled = heroes.some(u => u.status.some(s => s.k === "stun" || s.k === "burn" || s.k === "defDown"));
    const picks = [];
    for (const u of heroes) {
      if (statusOf(u, "stun")) continue;
      let choice = -1, rank = 9;
      for (let s = u.skills.length - 1; s >= 0; s--) {
        const skill = u.skills[s];
        if (!ready(skill)) continue;
        let r;
        if (isHeal(skill)) {
          const needed = skill.target === "ally" ? worst && worst.hp / worst.maxHp < .6 : hurtHeroes >= 2 || (worst && worst.hp / worst.maxHp < .45);
          if (!needed) continue;
          r = 3;
        } else if (isSupport(skill)) {
          if (skill.target === "self" && statusOf(u, "taunt")) continue;
          const cleanse = (skill.fx || []).some(fx => fx.k === "cleanse");
          r = cleanse && troubled ? 0 : (skill.fx || []).some(fx => fx.k === "atkUp") ? 0 : 3;
        } else {
          const area = skill.target !== "one";
          if (area && foes.length < 2 && skill.target !== "random" && !(skill.fx || []).length) r = 2.5;
          else r = (skill.fx || []).some(fx => fx.k === "defDown") ? 1 : 2;
        }
        if (r < rank || choice < 0) { rank = r; choice = s; }
        break; // the strongest ready skill that makes sense
      }
      if (choice >= 0) picks.push({ i: u.slot, s: choice, rank });
    }
    return picks.sort((x, y) => x.rank - y.rank).map(({ i, s }) => ({ i, s }));
  }

  // ---- After the battle ----
  function starsFor(b, stage) {
    if (b.result !== "won") return 0;
    return 1 + (b.heroes.every(u => !u || u.alive) ? 1 : 0) + (b.turn <= stage.par ? 1 : 0);
  }

  // A short line about a skill, built from its numbers so it never drifts.
  const TARGET_TEXT = {
    one: "ศัตรู 1 ตัว", front: "ศัตรูแถวหน้า", back: "ศัตรูแถวหลัง", all: "ศัตรูทุกตัว",
    ally: "เพื่อนที่บาดเจ็บที่สุด", allies: "ทั้งทีม", self: "ตัวเอง"
  };
  const pct = (v) => `${Math.round(v * 100)}%`;
  function describe(skill) {
    const parts = [];
    if (skill.target === "random") parts.push(`โจมตีสุ่ม ${skill.hits} ครั้ง ครั้งละ ${pct(skill.power)}`);
    else if (skill.power) parts.push(`โจมตี${TARGET_TEXT[skill.target]} ${pct(skill.power)}`);
    if (skill.heal) parts.push(`ฟื้นพลัง${TARGET_TEXT[skill.target]} ${pct(skill.heal)} ของพลังโจมตี`);
    if (skill.shield) parts.push(`เกราะให้${TARGET_TEXT[skill.target]} ${pct(skill.shield)} ของพลังโจมตี`);
    if (skill.drain) parts.push(`ดูดเลือด ${pct(skill.drain)} ของความเสียหาย`);
    for (const fx of skill.fx || []) {
      const turns = fx.turns ? ` ${fx.turns} เทิร์น` : "";
      const chance = fx.chance != null ? ` (โอกาส ${pct(fx.chance)})` : "";
      const who = fx.on === "allies" ? "ทั้งทีม" : "";
      if (fx.k === "stun") parts.push(`มึนงงข้ามเทิร์น${chance}`);
      else if (fx.k === "burn") parts.push(`ไฟลวก${turns}`);
      else if (fx.k === "atkUp") parts.push(`พลังโจมตี${who || TARGET_TEXT[skill.target]} +${pct(fx.v)}${turns}`);
      else if (fx.k === "defUp") parts.push(`พลังป้องกัน${who} +${pct(fx.v)}${turns}`);
      else if (fx.k === "defDown") parts.push(`ลดเกราะศัตรู ${pct(fx.v)}${turns}`);
      else if (fx.k === "taunt") parts.push(`ยั่วยุให้ศัตรูโจมตีตัวเอง${turns}`);
      else if (fx.k === "cleanse") parts.push("ล้างมึนงง ไฟลวก และเกราะแตก");
      else if (fx.k === "shield" && turns) parts[parts.length - 1] += turns;
    }
    const wait = `คูลดาวน์ ${skill.cd} เทิร์น${skill.first ? ` · เริ่มใช้ได้เทิร์นที่ ${skill.first + 1}` : ""}`;
    return `${parts.join(" · ")} (${wait})`;
  }

  // ---- Growing without fighting ----
  // Card XP: a card at level lv needs xpNeed(lv) XP for the next level.
  const xpNeed = (lv) => 40 * lv;
  // Adds XP to { units, xp } for one card; returns how many levels it rose.
  function giveXp(cards, id, amount) {
    const cap = capFor(cards.awake?.[id]);
    let lv = cards.units[id], xp = (cards.xp[id] || 0) + Math.round(amount), ups = 0;
    while (lv < cap && xp >= xpNeed(lv)) { xp -= xpNeed(lv); lv++; ups++; }
    cards.units[id] = lv;
    // at the cap, XP waits (up to one level's worth) for the next star
    cards.xp[id] = lv >= cap ? Math.min(xp, xpNeed(lv) - 1) : xp;
    return ups;
  }
  // XP each card of the team gets from a stage.
  const stageXp = (stage, won) => Math.round((10 + stage.num * 6) * (won ? 1 : .3));

  // Auto hunting: the team keeps hunting while the game is closed, up to
  // IDLE_HOURS; the better the furthest stage cleared, the richer the hunt.
  const IDLE_HOURS = 8;
  function idleReward(best, ms) {
    const hours = Math.max(0, Math.min(IDLE_HOURS, ms / 3600000));
    return { hours, coins: Math.floor(hours * (30 + 12 * best)), xp: Math.floor(hours * (40 + 15 * best)) };
  }

  // Login rewards, one a day in a cycle of seven.
  const DAILY = [
    { coins: 50, gems: 20 }, { xp: 120, gems: 20 }, { coins: 100, gems: 30 }, { xp: 200, gems: 30 }, { coins: 150, gems: 40 }, { xp: 300, gems: 50 }, { coins: 400, xp: 400, gems: 150, wings: 3 }
  ];

  // Costumes: one per card, bought with coins; worn, it changes the look
  // and adds COSTUME_BONUS to hp, attack and defence.
  const COSTUME_PRICE = 400;
  const COSTUME_BONUS = .08;

  // ---- The arena: ten against ten ----
  // Tier n: ten monsters a little above the stages, a boss every fifth.
  const ARENA_SIZE = 10;
  const ARENA_FRONT = 4;
  const ARENA_FOES = ["walker", "bat", "hopper", "urchin", "spitter", "jelly", "crab", "roller", "swooper"];
  function arenaTier(n) {
    let seed = n * 7919 + 13;
    const roll = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const pool = ARENA_FOES.slice(0, Math.min(ARENA_FOES.length, 4 + n));
    const wave = [];
    const boss = n % 5 === 0 ? (n % 10 === 0 ? "queen" : "king") : null;
    if (boss) wave.push({ id: boss, row: "front" });
    while (wave.length < ARENA_SIZE) {
      const front = wave.filter(f => f.row === "front").length < ARENA_FRONT;
      const tough = pool.filter(id => ["defense", "balance", "attack"].includes(FOES[id].role));
      const id = front ? tough[Math.floor(roll() * tough.length)] : pool[Math.floor(roll() * pool.length)];
      wave.push({ id, row: front ? "front" : "back" });
    }
    return {
      num: n, arena: true, name: `ลานประลอง ชั้น ${n}`, lv: 1 + n,
      waves: [wave], boss: Boolean(boss), par: 99,
      coins: 40 + 15 * n, repeat: 40 + 15 * n, xp: 20 + 8 * n, gems: n % 5 === 0 ? 50 : 15, dust: n % 5 === 0 ? 10 : 2, wings: n % 5 === 0 ? 2 : 0
    };
  }
  // A tower floor: a boss (a great one every tenth floor) and its guards,
  // from the chapter of these ten floors, a little above that chapter's level.
  function towerFloor(n) {
    const g = Math.min(10, Math.ceil(n / 10)), great = n % 10 === 0;
    const chapter = CHAPTERS[g - 1];
    const pool = [...new Set(STAGES.filter(s => s.num >= chapter.from && s.num <= chapter.to).flatMap(s => s.waves.flat().map(f => f.id)).filter(id => !FOES[id].boss))];
    const fresh = Object.keys(NEW_FOES).map(id => `${id}${g}`);
    let seed = n * 7717 + 3;
    const roll = (list) => list[(seed = (seed * 1103515245 + 12345) >>> 0) % list.length];
    const boss = great ? TOWER_GREAT[g - 1] : n % 2 ? TOWER_KINGS[g - 1] : TOWER_QUEENS[g - 1];
    const guards = great ? 4 : 2 + ((n % 10) >= 5 ? 1 : 0);
    const wave = [{ id: boss, row: "front" }];
    for (let k = 0; k < guards; k++) wave.push({ id: roll(k % 2 ? pool : fresh), row: k === 0 ? "front" : "back" });
    const stage = STAGES[Math.min(STAGES.length, n) - 1];
    return {
      num: n, tower: true, name: `หอคอย ชั้น ${n}`, lv: stage.lv + TOWER_LIFT[g - 1] + Math.floor((n % 10 || 10) / 3), chapter: g,
      waves: [wave], boss: true, par: 99,
      coins: 60 + 12 * n, repeat: 0, xp: 15 + 6 * n,
      gems: great ? 120 : n % 5 === 0 ? 50 : 20, dust: great ? 15 : 5, wings: great ? 3 : n % 5 === 0 ? 1 : 0
    };
  }

  // The strongest cards first, tanks in front: who goes to the arena.
  // The player's own ten (cards.arenaPick, front row cards.arenaFront) when
  // set, otherwise the strongest ten with the sturdiest in front.
  function arenaTeam(cards) {
    const picked = (cards.arenaPick || []).filter(id => CARDS[id] && cards.units[id]).slice(0, ARENA_SIZE);
    if (picked.length) {
      const chosen = (cards.arenaFront || []).filter(id => picked.includes(id)).slice(0, ARENA_FRONT);
      return picked.map(id => ({ id, lv: cards.units[id], row: chosen.includes(id) ? "front" : "back", bonus: cardBonus(cards, id) }));
    }
    const ids = Object.keys(cards.units).filter(id => CARDS[id]).sort((a, b) => power(b, cards.units[b]) * (1 + cardBonus(cards, b)) - power(a, cards.units[a]) * (1 + cardBonus(cards, a))).slice(0, ARENA_SIZE);
    const sturdy = (id) => ({ defense: 0, balance: 1, attack: 2, magic: 3, support: 4 })[CARDS[id].role];
    const front = [...ids].sort((a, b) => sturdy(a) - sturdy(b)).slice(0, Math.min(ARENA_FRONT, Math.ceil(ids.length / 2)));
    return ids.map(id => ({ id, lv: cards.units[id], row: front.includes(id) ? "front" : "back", bonus: cardBonus(cards, id) }));
  }

  // ---- Daily dungeons: one clear a day each ----
  // exp: a crystal cave of soft, quick monsters paying lots of card XP;
  // coin: a treasure vault guarded by tough ones, paying coins. Both are
  // pitched at the furthest stage cleared (best).
  const DUNGEONS = {
    exp: {
      name: "ถ้ำผลึกปัญญา", icon: "📘", text: "มอนสเตอร์ผลึกตัวเปราะ ให้ EXP การ์ดจำนวนมาก",
      waves: ["jelly,jelly/spitter", "hopper,jelly/spitter,spitter", "urchin,jelly/spitter,jelly,swooper"]
    },
    coin: {
      name: "คลังสมบัติเห็ดทอง", icon: "💰", text: "ผู้พิทักษ์คลังทองตัวแกร่ง ให้เหรียญจำนวนมาก",
      waves: ["walker,crab/walker", "crab,roller/walker,bat", "king/crab,walker"]
    }
  };
  function dungeon(kind, best) {
    const d = DUNGEONS[kind];
    const lv = best > 0 ? STAGES[Math.min(best, STAGES.length) - 1].lv : 1;
    return {
      num: 0, dungeon: kind, name: d.name, lv, waves: d.waves.map(parseWave), par: 99, boss: kind === "coin",
      coins: kind === "coin" ? 120 + 30 * best : 20 + 5 * best,
      xp: kind === "exp" ? 120 + 40 * best : 20 + 6 * best,
      gems: 20, dust: 5, wings: 1
    };
  }

  // ---- Card pulls ----
  // Characters and pets are only found here. Gems pay for a pull. The odds
  // are shown on the pull page; PITY pulls without an S make the next one
  // S or SSS, PITY6 pulls without an SSS make the next one SSS, and ten at
  // once always hold a B or better.
  const GACHA = { one: 100, ten: 900, rates: { 6: .01, 5: .04, 4: .12, 3: .23, 2: .3, 1: .3 }, pity: 50, pitySSS: .2, pity6: 100 };
  // A card pulled again turns into shards of that card, for its stars; the
  // top grades also give star-up wings.
  const DUPE_SHARDS = { 1: 4, 2: 5, 3: 8, 4: 12, 5: 20, 6: 40 };
  const DUPE_WINGS = { 5: 1, 6: 3 };

  // ---- Stars (awakening) ----
  // Raising a card a (red) star costs its shards (star dust, earned in play,
  // can stand in for any card's shards), star-up wings and coins. Each star
  // adds 10 to the level cap and AWAKE_BONUS to hp, attack and defence.
  // Wings come from boss stages, daily dungeons, the arena, the daily
  // reward, star bonuses, S/SSS duplicates, or gems (WING_PRICE).
  // stars 6-10 are the second awakening, for S and SSS cards only
  const AWAKE_SHARDS = [10, 20, 35, 55, 80, 100, 130, 170, 220, 280];
  const AWAKE_WINGS = [1, 2, 3, 5, 8, 10, 13, 16, 20, 25];
  const AWAKE_COINS = [300, 600, 1000, 1600, 2500, 4000, 6000, 8500, 11500, 15000];
  const maxAwake = (id) => (CARDS[id]?.rarity >= 5 ? MAX_AWAKE2 : MAX_AWAKE);
  const WING_PRICE = 80;
  const STAR_WINGS = 2;
  // Wings owed to a save that cleared boss stages (stars: num -> stars) and
  // arena floors (arena: the next floor) before wings were given out.
  const wingCompensation = (stars, arena = 1) =>
    STAGES.filter(s => s.wings && stars[s.num] > 0).reduce((sum, s) => sum + s.wings, 0) + 2 * Math.floor((Math.max(1, arena) - 1) / 5);
  const AWAKE_BONUS = .08;
  const AWAKE2_BONUS = .1;
  // What the next star costs, and whether this save can pay it.
  function awakeCost(cards, id) {
    const at = cards.awake?.[id] || 0;
    if (at >= maxAwake(id)) return null;
    const need = AWAKE_SHARDS[at], own = cards.shards?.[id] || 0;
    const fromShards = Math.min(own, need), fromDust = need - fromShards;
    return { star: at + 1, second: at >= MAX_AWAKE, need, fromShards, fromDust, coins: AWAKE_COINS[at], dust: cards.dust || 0, wingsNeed: AWAKE_WINGS[at], wings: cards.wings || 0 };
  }
  // Pays and raises the star; coins is the save's coin balance (returned).
  function awaken(cards, id, coins) {
    const cost = awakeCost(cards, id);
    if (!cost || !cards.units[id] || coins < cost.coins || cost.dust < cost.fromDust || cost.wings < cost.wingsNeed) return null;
    cards.shards[id] = (cards.shards[id] || 0) - cost.fromShards;
    cards.dust = cost.dust - cost.fromDust;
    cards.wings = cost.wings - cost.wingsNeed;
    cards.awake[id] = cost.star;
    return coins - cost.coins;
  }
  // Battle bonus from stars and a worn costume.
  const awakeBonus = (n = 0) => Math.min(n, MAX_AWAKE) * AWAKE_BONUS + Math.max(0, n - MAX_AWAKE) * AWAKE2_BONUS;
  const cardBonus = (cards, id) => awakeBonus(cards.awake?.[id] || 0) + (cards.outfit?.[id] === 2 ? COSTUME_BONUS : 0);
  const byRarity = (n) => CARD_IDS.filter(id => CARDS[id].rarity === n);
  // state: { pity, pity6 } (pulls since the last S or SSS, and since the
  // last SSS); rnd: () => 0..1.
  function pullOne(state, rnd, atLeast = 1) {
    let rarity = 1;
    state.pity6 = state.pity6 || 0;
    if (state.pity6 + 1 >= GACHA.pity6) rarity = 6;
    else if (state.pity + 1 >= GACHA.pity) rarity = rnd() < GACHA.pitySSS ? 6 : 5;
    else {
      let roll = rnd();
      for (const r of [6, 5, 4, 3, 2, 1]) { if (roll < GACHA.rates[r]) { rarity = r; break; } roll -= GACHA.rates[r]; }
    }
    rarity = Math.max(rarity, atLeast);
    state.pity = rarity >= 5 ? 0 : state.pity + 1;
    state.pity6 = rarity === 6 ? 0 : state.pity6 + 1;
    const pool = byRarity(rarity);
    return pool[Math.floor(rnd() * pool.length)];
  }
  function pull(state, rnd, count) {
    const out = [];
    for (let n = 0; n < count; n++) {
      const last = count >= 10 && n === count - 1 && !out.some(id => CARDS[id].rarity >= 3);
      out.push(pullOne(state, rnd, last ? 3 : 1));
    }
    return out;
  }

  // ---- Quests ----
  // Daily quests count what was done today (cards.quest.counts, reset each
  // day); finishing them all opens a chest. Achievements are milestones read
  // straight from the save, each paid once (cards.achv).
  const DAILY_QUESTS = [
    { id: "win3", key: "win", need: 3, gems: 30, text: "ชนะการต่อสู้ 3 ครั้ง" },
    { id: "idle1", key: "idle", need: 1, gems: 20, text: "รับรางวัลล่าอัตโนมัติ" },
    { id: "dungeon1", key: "dungeon", need: 1, gems: 30, text: "ผ่านด่านประจำวัน 1 ด่าน" },
    { id: "arena1", key: "arena", need: 1, gems: 30, text: "สู้ในลานประลอง 1 ครั้ง" },
    { id: "level3", key: "level", need: 3, gems: 20, text: "อัปเลเวลการ์ด 3 ครั้ง" },
    { id: "pull1", key: "pull", need: 1, gems: 20, text: "สุ่มการ์ด 1 ครั้ง" }
  ];
  const QUEST_CHEST = { gems: 100, wings: 1 };
  const freshQuest = (day) => ({ day, counts: {}, claimed: [] });
  // A day's quest record, renewed when the day has changed.
  const questFor = (quest, day) => (quest && quest.day === day ? quest : freshQuest(day));
  const questDone = (quest, q) => (quest.counts[q.key] || 0) >= q.need;
  const ACHIEVEMENTS = [];
  for (let n = 10; n <= 100; n += 10) ACHIEVEMENTS.push({ id: `stage${n}`, gems: 50 + 2 * n, text: `ผ่านศึกการ์ดด่าน ${n}`, need: n, have: (c) => Math.max(0, ...Object.keys(c.stars).map(Number).filter(k => c.stars[k] > 0)) });
  for (const n of [50, 100, 150, 200, 250, 300]) ACHIEVEMENTS.push({ id: `stars${n}`, gems: n, text: `เก็บดาวด่านรวม ${n} ดวง`, need: n, have: (c) => Object.values(c.stars).reduce((a, b) => a + Math.min(3, b), 0) });
  for (const [n, gems] of [[5, 50], [10, 80], [15, 120], [20, 160], [25, 200]]) ACHIEVEMENTS.push({ id: `cards${n}`, gems, text: `มีการ์ด ${n} ใบ`, need: n, have: (c) => Object.keys(c.units).filter(id => CARDS[id] && c.units[id] > 0).length });
  for (const [n, gems] of [[1, 50], [3, 100], [5, 200], [6, 250], [8, 300], [10, 500]]) ACHIEVEMENTS.push({ id: `awake${n}`, gems, text: n > MAX_AWAKE ? `ปลุกพลังขั้น 2 การ์ดใบใดก็ได้ถึงดาวทอง ${n - MAX_AWAKE} ดวง` : `อัปดาวแดงการ์ดใบใดก็ได้ถึง ${n} ดวง`, need: n, have: (c) => Math.max(0, ...Object.values(c.awake || {})) });
  for (const [n, gems] of [[10, 100], [25, 150], [50, 250], [75, 300], [100, 500]]) ACHIEVEMENTS.push({ id: `tower${n}`, gems, text: `ผ่านหอคอยชั้น ${n}`, need: n, have: (c) => c.tower || 0 });
  ACHIEVEMENTS.push({ id: "sss1", gems: 200, text: "ได้การ์ดระดับ SSS ใบแรก", need: 1, have: (c) => CARD_IDS.filter(id => CARDS[id].rarity === 6 && c.units[id]).length });
  for (const [n, gems] of [[10, 80], [20, 120], [30, 160], [50, 250]]) ACHIEVEMENTS.push({ id: `arena${n}`, gems, text: `ผ่านลานประลองชั้น ${n}`, need: n, have: (c) => Math.max(0, (c.arena || 1) - 1) });
  // How far an achievement is: [have, need, done].
  const achvProgress = (c, a) => { const have = Math.min(a.need, a.have(c)); return [have, a.need, have >= a.need]; };

  // ---- Star bonus ----
  // Every five stages (1-5, 6-10, ...) at full stars (15) give STAR_BONUS
  // gems, once. group n covers stages 5n-4 to 5n.
  const STAR_BONUS = 250;
  const STAR_GROUP = 5;
  const starGroups = () => Array.from({ length: Math.ceil(STAGES.length / STAR_GROUP) }, (_, n) => n + 1);
  const groupStages = (n) => STAGES.filter(s => s.num > (n - 1) * STAR_GROUP && s.num <= n * STAR_GROUP);
  const groupStars = (stars, n) => groupStages(n).reduce((sum, s) => sum + Math.min(3, stars[s.num] || 0), 0);
  // The groups now at full stars and not yet paid.
  const dueStarBonus = (stars, paid = []) => starGroups().filter(n => !paid.includes(n) && groupStars(stars, n) >= groupStages(n).length * 3);

  return {
    DAILY_QUESTS, QUEST_CHEST, questFor, questDone, ACHIEVEMENTS, achvProgress,
    GRADES, DUPE_WINGS, AWAKE_WINGS, WING_PRICE, STAR_WINGS, wingCompensation,
    STAR_BONUS, STAR_GROUP, starGroups, groupStars, dueStarBonus,
    GACHA, DUPE_SHARDS, pull, MAX_AWAKE, MAX_AWAKE2, maxAwake, AWAKE2_BONUS, awakeBonus, BASE_CAP, capFor, AWAKE_SHARDS, AWAKE_COINS, AWAKE_BONUS, awakeCost, awaken, cardBonus,
    DUNGEONS, dungeon,
    xpNeed, giveXp, stageXp, IDLE_HOURS, idleReward, DAILY, COSTUME_PRICE, COSTUME_BONUS, ARENA_SIZE, arenaTier, arenaTeam,
    MAX_TURNS, TOWER_FLOORS, towerFloor, UNIQUE_BOSSES, NEW_FOES, ARENA_FRONT, MAX_LEVEL, TEAM_SIZE, FRONT_SLOTS, ROLES, CARDS, CARD_IDS, STARTER, STARTER_TEAM, FOES, STAGES, CHAPTERS,
    levelCost, cardStats, power, createBattle, heroTurn, enemyTurn, autoQueue, starsFor, describe
  };
});

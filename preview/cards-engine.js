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

  const MAX_LEVEL = 30;
  const TEAM_SIZE = 5;
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
  // Rarer cards start stronger.
  const RARITY = { 3: 1, 4: 1.12, 5: 1.25 };

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
      name: "Pupa", role: "balance", rarity: 3, art: "pupa", from: "hero",
      text: "ดักแด้ไหมชมพู ตัวเอกของสวนเชอร์รี่",
      passive: { coins: .15, text: "เสน่ห์เหรียญทอง: เหรียญรางวัลจากด่าน +15%" },
      skills: [
        { name: "ไหมชมพูพันรัด", icon: "🎀", cd: 3, target: "one", power: 1.5, fx: [{ k: "stun", chance: .6, turns: 1 }] },
        { name: "รังไหมแสงจันทร์", icon: "🌙", cd: 4, first: 1, target: "allies", shield: 1.2, fx: [{ k: "shield", turns: 2 }] }
      ]
    },
    jibjib: {
      name: "จิ๊บจิ๊บแมน", role: "attack", rarity: 3, art: "jibjib", from: "hero",
      text: "ลูกเจี๊ยบนักผจญภัย ผ้าพันคอแดงปลิวไสว",
      passive: { double: .3, text: "ปีกกระพือ: โจมตีปกติมีโอกาส 30% ตีซ้ำอีกครั้ง" },
      skills: [
        { name: "จิกรัว", icon: "🐤", cd: 3, target: "random", hits: 3, power: .7 },
        { name: "ปีกพายุ", icon: "🌪", cd: 4, first: 1, target: "all", power: .9 }
      ]
    },
    baitoey: {
      name: "ใบเตย", role: "support", rarity: 4, art: "baitoey", from: "hero",
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
      name: "ปังจิ", role: "defense", rarity: 4, art: "pangji", from: "hero",
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
      name: "หิ่งห้อยน้อย", role: "support", rarity: 3, art: "firefly", from: "pet",
      text: "แสงอุ่น ๆ ที่คอยดูแลเพื่อน",
      skills: [
        { name: "แสงอุ่น", icon: "✨", cd: 3, target: "ally", heal: 2.6 },
        { name: "แสงนำทาง", icon: "💡", cd: 4, first: 1, target: "allies", fx: [{ k: "atkUp", v: .3, turns: 2 }] }
      ]
    },
    kitten: {
      name: "ลูกแมวเชอร์รี่", role: "attack", rarity: 3, art: "kitten", from: "pet",
      text: "ลูกแมวซนกรงเล็บคม",
      skills: [
        { name: "ข่วนเชอร์รี่", icon: "🐾", cd: 3, target: "one", power: 1.9 },
        { name: "ข่วนรัวพายุ", icon: "🍒", cd: 4, first: 1, target: "random", hits: 4, power: .65 }
      ]
    },
    minibat: {
      name: "ค้างคาวจิ๋ว", role: "magic", rarity: 4, art: "minibat", from: "pet",
      text: "ค้างคาวตัวน้อยผู้พิทักษ์ราตรี",
      skills: [
        { name: "เขี้ยวดูดพลัง", icon: "🦇", cd: 3, target: "one", power: 1.7, drain: .5 },
        { name: "คลื่นเสียงราตรี", icon: "🔊", cd: 4, first: 1, target: "back", power: 1.5, fx: [{ k: "defDown", v: .25, turns: 2 }] }
      ]
    },
    starsprite: {
      name: "ภูตดาว", role: "defense", rarity: 4, art: "starsprite", from: "pet",
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
      name: "กระต่ายจันทร์", role: "support", rarity: 3, art: "moonrabbit", from: "pet",
      text: "กระต่ายขาวจากดวงจันทร์ พกโมจิมาแจกเพื่อน",
      skills: [
        { name: "โมจิพลังจันทร์", icon: "🍡", cd: 3, target: "ally", heal: 2.4 },
        { name: "กระโดดเชียร์", icon: "🐰", cd: 4, first: 1, target: "allies", fx: [{ k: "atkUp", v: .25, turns: 2 }] }
      ]
    },
    starowl: {
      name: "นกฮูกดาว", role: "magic", rarity: 4, art: "starowl", from: "pet",
      text: "นกฮูกขนดาวผู้รู้ทุกความลับของท้องฟ้า",
      skills: [
        { name: "ดวงตาดารา", icon: "👁", cd: 3, target: "one", power: 1.8, fx: [{ k: "defDown", v: .25, turns: 2 }] },
        { name: "คืนพันดาว", icon: "🌌", cd: 4, first: 1, target: "all", power: 1.2 }
      ]
    },
    silverwolf: {
      name: "หมาป่าเงิน", role: "attack", rarity: 5, art: "silverwolf", from: "pet", crit: .25,
      text: "ลูกหมาป่าขนเงิน หอนเรียกพลังจันทร์เต็มดวง",
      skills: [
        { name: "เขี้ยวเงิน", icon: "🐺", cd: 3, target: "one", power: 2.2, drain: .3 },
        { name: "หอนจันทร์เต็มดวง", icon: "🌕", cd: 5, first: 1, target: "all", power: 1.4, fx: [{ k: "atkUp", v: .2, turns: 2, on: "allies" }] }
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
  // Monsters are a little softer than cards of the same level.
  const FOE_SCALE = { hp: .85, atk: .9, def: 1 };

  // Stages: each wave is "front,front/back,back,back". lv is the monsters'
  // level, card the card given for the first clear.
  const CHAPTERS = [
    { name: "บทที่ 1 · ป่าเชอร์รี่ยามค่ำ", from: 1, to: 10 },
    { name: "บทที่ 2 · ทะเลสาบภาพฝัน", from: 11, to: 20 }
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
    ["ราชาและราชินี", 13, ["crab,roller/jelly,swooper,spitter", "urchin,urchin/jelly,jelly,bat", "king,queen/jelly"]]
  ];
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
      gems: card ? 80 : parsed.some(wave => wave.some(foe => FOES[foe.id].boss)) ? 60 : 25
    };
  });

  // ---- Numbers ----
  function statsOf(def, lv, foe) {
    const role = ROLES[def.role];
    const rare = foe ? 1 : RARITY[def.rarity] || 1;
    const scale = foe ? FOE_SCALE : { hp: 1, atk: 1, def: 1 };
    const g = growth(lv);
    return {
      hp: Math.round(role.hp * HP_SCALE * (def.hp || 1) * rare * scale.hp * g),
      atk: Math.round(role.atk * (def.atk || 1) * rare * scale.atk * g),
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
    let lv = cards.units[id], xp = (cards.xp[id] || 0) + Math.round(amount), ups = 0;
    while (lv < MAX_LEVEL && xp >= xpNeed(lv)) { xp -= xpNeed(lv); lv++; ups++; }
    cards.units[id] = lv;
    cards.xp[id] = lv >= MAX_LEVEL ? 0 : xp;
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
    { coins: 50, gems: 20 }, { xp: 120, gems: 20 }, { coins: 100, gems: 30 }, { xp: 200, gems: 30 }, { coins: 150, gems: 40 }, { xp: 300, gems: 50 }, { coins: 400, xp: 400, gems: 150 }
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
      coins: 40 + 15 * n, repeat: 40 + 15 * n, xp: 20 + 8 * n, gems: n % 5 === 0 ? 50 : 15
    };
  }
  // The strongest cards first, tanks in front: who goes to the arena.
  function arenaTeam(cards) {
    const ids = Object.keys(cards.units).filter(id => CARDS[id]).sort((a, b) => power(b, cards.units[b]) - power(a, cards.units[a])).slice(0, ARENA_SIZE);
    const sturdy = (id) => ({ defense: 0, balance: 1, attack: 2, magic: 3, support: 4 })[CARDS[id].role];
    const front = [...ids].sort((a, b) => sturdy(a) - sturdy(b)).slice(0, Math.min(ARENA_FRONT, Math.ceil(ids.length / 2)));
    return ids.map(id => ({ id, lv: cards.units[id], row: front.includes(id) ? "front" : "back", bonus: cards.outfit?.[id] === 2 ? COSTUME_BONUS : 0 }));
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
      gems: 20
    };
  }

  // ---- Card pulls ----
  // Characters and pets are only found here. Gems pay for a pull. The odds
  // are shown on the pull page; PITY pulls without a five-star make the
  // next one a five-star, and ten at once always hold a four-star or better.
  // A card already owned turns into XP for that card instead.
  const GACHA = { one: 100, ten: 900, rates: { 5: .05, 4: .25, 3: .70 }, pity: 50 };
  const DUPE_XP = { 3: 150, 4: 400, 5: 1000 };
  const byRarity = (n) => CARD_IDS.filter(id => CARDS[id].rarity === n);
  // state: { pity } (pulls since the last five-star); rnd: () => 0..1.
  function pullOne(state, rnd, atLeast = 3) {
    let rarity;
    if (state.pity + 1 >= GACHA.pity) rarity = 5;
    else {
      const roll = rnd();
      rarity = roll < GACHA.rates[5] ? 5 : roll < GACHA.rates[5] + GACHA.rates[4] ? 4 : 3;
    }
    rarity = Math.max(rarity, atLeast);
    state.pity = rarity === 5 ? 0 : state.pity + 1;
    const pool = byRarity(rarity);
    return pool[Math.floor(rnd() * pool.length)];
  }
  function pull(state, rnd, count) {
    const out = [];
    for (let n = 0; n < count; n++) {
      const last = count >= 10 && n === count - 1 && !out.some(id => CARDS[id].rarity >= 4);
      out.push(pullOne(state, rnd, last ? 4 : 3));
    }
    return out;
  }

  return {
    GACHA, DUPE_XP, pull,
    DUNGEONS, dungeon,
    xpNeed, giveXp, stageXp, IDLE_HOURS, idleReward, DAILY, COSTUME_PRICE, COSTUME_BONUS, ARENA_SIZE, arenaTier, arenaTeam,
    MAX_LEVEL, TEAM_SIZE, FRONT_SLOTS, ROLES, CARDS, CARD_IDS, STARTER, STARTER_TEAM, FOES, STAGES, CHAPTERS,
    levelCost, cardStats, power, createBattle, heroTurn, enemyTurn, autoQueue, starsFor, describe
  };
});

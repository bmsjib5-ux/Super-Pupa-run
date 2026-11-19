// Potion sort (ห้องยาวิเศษ): the rules, with no page in them, so Node can
// test them too. Bottles hold up to CAP layers of potion. A pour moves the
// top run of one colour into a bottle that is empty or shows that colour
// on top, as much as fits. A level is done when every bottle is empty or
// full of one colour. Twists come in as the levels go up: hidden layers
// ("?") show when they come to the top; a corked bottle opens when another
// is filled with the cork's colour; a frozen bottle thaws after so many
// pours; small bottles hold less; a tinted bottle takes one colour only; a
// drip bottle pours one layer at a time; a funnel takes potion but never
// gives it back. The last hundred levels are the hard ones: more colours
// (fourteen at the very end), one plain empty bottle (none at all from
// 131), several twists at once, and from 141 every layer below the top
// hidden too. Every level is dealt
// from its own seed and checked solvable, so it is the same on every
// device.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PupaPotionEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const LEVELS = 200;
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
    { name: "ขาวมุก", hex: "#f2ecff", sign: "◆" },
    // the hard chapters' extra two
    { name: "น้ำตาลช็อกโกแลต", hex: "#a8622c", sign: "▼" },
    { name: "เงินจันทร์", hex: "#8f9bb3", sign: "✦" },
    // and the finale's one more
    { name: "ไวน์ทับทิม", hex: "#a3184f", sign: "♠" }
  ];
  // The twists a level can have, in the order they come in.
  const TWISTS = [
    { key: "hidden", icon: "❓", name: "ซ่อนชั้น", text: "ชั้นล่างถูกซ่อนไว้ จะเห็นสีเมื่อเทชั้นบนออกจนมันขึ้นมาอยู่บนสุด" },
    { key: "lock", icon: "🔒", name: "ขวดปิดจุก", text: "เทเข้าหรือออกไม่ได้ จุกจะเปิดเมื่อเรียงสีเดียวกับสีจุกครบ 1 ขวด" },
    { key: "ice", icon: "❄️", name: "ขวดน้ำแข็ง", text: "แข็งตัวอยู่ เทเข้าหรือออกไม่ได้ ทุกครั้งที่เทขวดอื่น ตัวเลขจะลด 1 พอถึง 0 ก็ละลาย" },
    { key: "small", icon: "🍶", name: "ขวดจิ๋ว", text: "จุได้แค่ 2–3 ชั้น ไว้พักน้ำยาชั่วคราว ตอนจบต้องเทออกให้ว่าง" },
    { key: "only", icon: "🎨", name: "ขวดสีเฉพาะ", text: "รับเฉพาะน้ำยาสีเดียวกับขวด สีอื่นเทลงไม่ได้" },
    { key: "drip", icon: "💧", name: "ขวดหยด", text: "ปากขวดแคบ เทออกได้ทีละ 1 ชั้นเท่านั้น" },
    { key: "funnel", icon: "⏬", name: "ขวดกรวย", text: "เทเข้าได้อย่างเดียว เทออกไม่ได้ ใส่สีไหนแล้วต้องเติมสีนั้นให้ครบ 4 ชั้น" }
  ];
  // Ten levels a chapter after the first forty, each bringing in a twist.
  const CHAPTERS = [
    { from: 1, to: 20, name: "ห้องฝึกปรุงยา", icon: "🧪" },
    { from: 21, to: 40, name: "ห้องสมุดเวทมนตร์", icon: "📚" },
    { from: 41, to: 50, name: "ถ้ำน้ำแข็ง", icon: "❄️" },
    { from: 51, to: 60, name: "ห้องขวดจิ๋ว", icon: "🍶" },
    { from: 61, to: 70, name: "ห้องสีต้องมนตร์", icon: "🎨" },
    { from: 71, to: 80, name: "หอหยดน้ำค้าง", icon: "💧" },
    { from: 81, to: 90, name: "หอกรวยวิเศษ", icon: "⏬" },
    { from: 91, to: 100, name: "หอคอยปรมาจารย์", icon: "👑" },
    { from: 101, to: 110, name: "ห้องทดลองต้องห้าม", icon: "🔮", hard: 1, note: "ด่านยากพิเศษ: น้ำยา 11–12 สี มีขวดว่างธรรมดาแค่ 1 ขวด ทุกด่านมีลูกเล่นหลายแบบพร้อมกัน และคัดกระดานที่ต้องเทมากที่สุดมาให้ มีสีใหม่ 🟤 น้ำตาลช็อกโกแลต ▼" },
    { from: 111, to: 120, name: "บัลลังก์จอมเวท", icon: "🌌", hard: 1, note: "บทสุดท้าย ยากที่สุด: น้ำยา 12–13 สี เพิ่มสี ⚪ เงินจันทร์ ✦ ลูกเล่นตั้งแต่ 3 แบบขึ้นไปพร้อมกัน ขวดว่างธรรมดาแค่ 1 ขวด คิดก่อนเททุกครั้ง!" },
    { from: 121, to: 130, name: "ห้องหมอกมนตรา", icon: "🌫️", hard: 2, note: "ยากสุดขีด: หมอกปกคลุมทุกด่าน ทุกขวดซ่อนชั้นล่าง ❓ น้ำยา 12–13 สี ขวดว่างธรรมดาแค่ 1 ขวด ลูกเล่นซ้อนกัน 4–6 แบบ และเป้า ★★★ เข้มขึ้น (ใช้ทางที่สั้นที่สุดที่หาได้)" },
    { from: 131, to: 140, name: "วิหารจันทร์ดับ", icon: "🌑", hard: 2, note: "บทสุดท้ายที่โหดที่สุด: ไม่มีขวดว่างธรรมดาเลยสักขวด! ต้องพักน้ำยาในขวดจิ๋ว ขวดสีเฉพาะ หรือขวดกรวยเท่านั้น น้ำยา 12–13 สี และเป้า ★★★ เข้มขึ้น" },
    { from: 141, to: 150, name: "เขาวงกตหมอกจันทร์", icon: "🌘", hard: 3, note: "ระดับตำนาน: รวมสองอย่างที่โหดที่สุดไว้ด้วยกัน ทุกขวดซ่อนชั้นล่าง ❓ และไม่มีขวดว่างธรรมดาเลยสักขวด! น้ำยา 12–13 สี พักน้ำยาได้แค่ในขวดจิ๋ว ขวดสีเฉพาะ หรือขวดกรวย เป้า ★★★ เข้ม" },
    { from: 151, to: 160, name: "ประตูมิติสุดท้าย", icon: "🌀", hard: 3, note: "บทสุดท้ายระดับตำนาน: ซ่อนชั้นทุกขวด ไม่มีขวดว่างธรรมดา ที่พักน้ำยาน้อยลงอีก (บางด่านมีขวดจิ๋วแค่ 2 ชั้น) น้ำแข็งแข็งตัวนานขึ้น และลูกเล่นซ้อนกัน 5–7 แบบ น้ำยา 13 สี" },
    { from: 161, to: 170, name: "ธารน้ำแข็งนิรันดร์", icon: "🧊", hard: 3, note: "ระดับตำนาน: ซ่อนชั้นทุกขวด ไม่มีขวดว่างธรรมดา และขวดแข็งตัวมากถึง 4–6 ขวดพร้อมกัน ต้องวางแผนเทขวดที่เหลือให้ดีระหว่างรอน้ำแข็งละลาย" },
    { from: 171, to: 180, name: "ม่านฝนจันทรา", icon: "🌧️", hard: 3, note: "ระดับตำนาน: ขวดหยดมากถึง 4–6 ขวด เทออกได้ทีละชั้น ที่พักส่วนใหญ่เป็นขวดจิ๋ว 2 ชั้น ซ่อนชั้นทุกขวด และไม่มีขวดว่างธรรมดา" },
    { from: 181, to: 190, name: "หอศิลป์ต้องสาป", icon: "🖼️", hard: 3, note: "ระดับตำนาน: แทบไม่มีขวดจิ๋วเลย มีที่พักน้ำยาแค่ 3 ขวด ส่วนใหญ่เป็นขวดสีเฉพาะและขวดกรวย ใส่ผิดสีลงขวดกรวยแล้วเอาออกไม่ได้! ทั้งยังมีน้ำแข็ง ขวดหยด และขวดปิดจุกซ้อน" },
    { from: 191, to: 200, name: "บัลลังก์ราชันย์แห่งยา", icon: "👑", hard: 4, note: "บทสุดท้ายของห้องยา: น้ำยา 14 สี เพิ่มสีใหม่ 🍷 ไวน์ทับทิม ♠ ทุกลูกเล่นมาพร้อมกัน ซ่อนชั้นทุกขวด ไม่มีขวดว่างธรรมดา ผ่านครบ 200 ด่านคือราชันย์แห่งห้องยา!" }
  ];
  const chapterOf = (n) => CHAPTERS.find(c => n >= c.from && n <= c.to) || CHAPTERS[0];

  // A level: how many potion colours, empty bottles, and its twists:
  // hidden layers, a corked bottle, ice (frozen bottles and for how many
  // pours), small bottles (their room), bottles for one colour only,
  // drip bottles and funnels.
  const STEP = [7, 8, 8, 9, 9, 10, 10, 11, 11, 11];
  // the last chapter: a mix each level
  const MASTER = [
    { ice: 2, small: [3] },
    { only: 1, drip: 2 },
    { funnel: 1, ice: 1 },
    { small: [3], only: 1 },
    { drip: 2, funnel: 1 },
    { ice: 2, only: 1 },
    { small: [3, 2], drip: 2 },
    { funnel: 1, only: 1 },
    { ice: 2, drip: 2, small: [3] },
    { ice: 2, only: 1, funnel: 1, drip: 1 }
  ];
  // Levels 101–120, the hard ones, one by one: more colours, one plain
  // empty bottle, two to four twists at once. `seed` is the deal to start
  // from: each was picked, from the first solvable ones, as the one
  // needing the most pours.
  const HARD = [
    { colours: 11, hidden: true, ice: 2, only: 1 },
    { colours: 11, small: [3], drip: 2, lock: true },
    { colours: 12, funnel: 1, ice: 2 },
    { colours: 12, hidden: true, only: 2, drip: 2 },
    { colours: 12, small: [3, 2], ice: 1, lock: true },
    { colours: 12, hidden: true, drip: 3, funnel: 1 },
    { colours: 12, only: 1, ice: 3, drip: 1 },
    { colours: 12, hidden: true, small: [3], funnel: 1, lock: true },
    { colours: 12, drip: 2, only: 1, ice: 2 },
    { colours: 12, hidden: true, small: [3], only: 1, funnel: 1 },
    { colours: 12, hidden: true, ice: 3, drip: 2, small: [2] },
    { colours: 13, only: 1, funnel: 1, lock: true },
    { colours: 13, hidden: true, small: [3, 2], ice: 2 },
    { colours: 13, drip: 3, only: 1, lock: true },
    { colours: 13, hidden: true, funnel: 1, ice: 2, small: [3] },
    { colours: 13, only: 2, drip: 2, ice: 1 },
    { colours: 13, hidden: true, small: [3], funnel: 1, drip: 2, lock: true },
    { colours: 13, ice: 3, only: 1, funnel: 1 },
    { colours: 13, hidden: true, small: [3, 2], only: 1, drip: 2, lock: true },
    { colours: 13, hidden: true, ice: 3, only: 1, funnel: 1, drip: 2, lock: true },
    // 121–130: every layer below the top hidden
    { colours: 12, hidden: true, ice: 2, drip: 2, only: 1 },
    { colours: 12, hidden: true, small: [3], funnel: 1, lock: true, drip: 1 },
    { colours: 13, hidden: true, ice: 3, only: 1, lock: true },
    { colours: 13, hidden: true, drip: 3, small: [2], ice: 1 },
    { colours: 13, hidden: true, funnel: 1, only: 1, ice: 2 },
    { colours: 13, hidden: true, small: [3, 2], drip: 2, lock: true },
    { colours: 13, hidden: true, ice: 3, funnel: 1, drip: 2 },
    { colours: 13, hidden: true, only: 2, small: [2], lock: true },
    { colours: 13, hidden: true, ice: 2, drip: 3, funnel: 1, lock: true },
    { colours: 13, hidden: true, small: [3], only: 1, funnel: 1, ice: 2, drip: 2 },
    // 131–140: no plain empty bottle at all
    { colours: 12, empties: 0, small: [3, 3], only: 1 },
    { colours: 12, empties: 0, small: [3, 2], funnel: 1, hidden: true },
    { colours: 12, empties: 0, small: [3, 3], ice: 2, lock: true },
    { colours: 13, empties: 0, small: [3], only: 2, drip: 2 },
    { colours: 13, empties: 0, small: [3, 3], funnel: 1, hidden: true, ice: 1 },
    { colours: 13, empties: 0, small: [3, 2], only: 1, drip: 2, lock: true },
    { colours: 13, empties: 0, small: [3], only: 1, funnel: 1, hidden: true, ice: 2 },
    { colours: 13, empties: 0, small: [3, 3], drip: 3, lock: true, hidden: true },
    { colours: 13, empties: 0, small: [3, 2], only: 1, funnel: 1, ice: 2, drip: 2 },
    { colours: 13, empties: 0, small: [3, 3], only: 1, funnel: 1, ice: 3, drip: 2, lock: true, hidden: true },
    // 141–150: fog over every layer and no plain empty bottle, both at once
    { colours: 12, empties: 0, hidden: true, small: [3, 3], only: 1, drip: 2 },
    { colours: 12, empties: 0, hidden: true, small: [3, 2], funnel: 1, ice: 2 },
    { colours: 12, empties: 0, hidden: true, small: [3, 3], lock: true, drip: 2 },
    { colours: 13, empties: 0, hidden: true, small: [3], only: 2, ice: 2 },
    { colours: 13, empties: 0, hidden: true, small: [3, 3], funnel: 1, drip: 2 },
    { colours: 13, empties: 0, hidden: true, small: [3, 2], only: 1, lock: true, ice: 1 },
    { colours: 13, empties: 0, hidden: true, small: [3], only: 1, funnel: 1, drip: 3 },
    { colours: 13, empties: 0, hidden: true, small: [3, 3], ice: 3, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [3, 2], only: 1, funnel: 1, ice: 2, drip: 1 },
    { colours: 13, empties: 0, hidden: true, small: [3, 3], only: 1, drip: 2, lock: true, ice: 2 },
    // 151–160: the same, with fewer bottles to park in and more twists
    { colours: 13, empties: 0, hidden: true, small: [3], only: 1, ice: 3, drip: 2 },
    { colours: 13, empties: 0, hidden: true, small: [2, 2], funnel: 1, lock: true, drip: 2 },
    { colours: 13, empties: 0, hidden: true, small: [3], funnel: 1, only: 1, ice: 3, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [3, 2], drip: 3, ice: 2, lock: true },
    { colours: 13, empties: 0, hidden: true, only: 2, funnel: 1, drip: 2, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [2], only: 1, funnel: 1, ice: 3, drip: 2 },
    { colours: 13, empties: 0, hidden: true, small: [3], only: 2, drip: 3, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [3, 2], funnel: 1, ice: 3, drip: 2, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [2], only: 1, funnel: 1, ice: 3, drip: 3, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [3], only: 1, funnel: 1, ice: 3, drip: 3, lock: true },
    // 161–170: fog, no plain empty bottle, and many frozen bottles
    { colours: 12, empties: 0, hidden: true, small: [3, 3], only: 1, ice: 4 },
    { colours: 12, empties: 0, hidden: true, small: [3, 2], funnel: 1, ice: 4, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [3, 3], ice: 4, drip: 2 },
    { colours: 13, empties: 0, hidden: true, small: [3], only: 2, ice: 4 },
    { colours: 13, empties: 0, hidden: true, small: [3, 3], funnel: 1, ice: 5 },
    { colours: 13, empties: 0, hidden: true, small: [3, 2], only: 1, ice: 5, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [3], only: 1, funnel: 1, ice: 5, drip: 1 },
    { colours: 13, empties: 0, hidden: true, small: [3, 3], ice: 6, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [3, 2], only: 1, funnel: 1, ice: 5, drip: 2 },
    { colours: 13, empties: 0, hidden: true, small: [3, 3], only: 1, ice: 6, drip: 2, lock: true },
    // 171–180: drip bottles everywhere, and two-layer bottles to park in
    { colours: 12, empties: 0, hidden: true, small: [2, 2, 2], drip: 4 },
    { colours: 12, empties: 0, hidden: true, small: [2, 2], only: 1, drip: 4, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [3, 2], funnel: 1, drip: 5 },
    { colours: 13, empties: 0, hidden: true, small: [2, 2, 2], ice: 2, drip: 4 },
    { colours: 13, empties: 0, hidden: true, small: [3, 2], only: 1, drip: 5, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [2, 2], funnel: 1, only: 1, drip: 5 },
    { colours: 13, empties: 0, hidden: true, small: [3, 2, 2], ice: 3, drip: 5, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [2, 2], only: 1, funnel: 1, ice: 2, drip: 5 },
    { colours: 13, empties: 0, hidden: true, small: [2, 2, 2], only: 1, drip: 6, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [3, 2], only: 1, funnel: 1, ice: 3, drip: 6, lock: true },
    // 181–190: tinted bottles and funnels, hardly a small bottle, three
    // places to park at most
    { colours: 12, empties: 0, hidden: true, only: 2, funnel: 1, drip: 2 },
    { colours: 12, empties: 0, hidden: true, only: 2, funnel: 1, ice: 2, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [2], only: 1, funnel: 1, ice: 3 },
    { colours: 13, empties: 0, hidden: true, only: 2, funnel: 1, drip: 3, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [2], only: 2, ice: 2, lock: true },
    { colours: 13, empties: 0, hidden: true, only: 2, funnel: 1, ice: 3, drip: 2 },
    { colours: 13, empties: 0, hidden: true, only: 1, funnel: 2, ice: 2, drip: 2, lock: true },
    { colours: 13, empties: 0, hidden: true, only: 2, funnel: 1, drip: 4, lock: true },
    { colours: 13, empties: 0, hidden: true, small: [2], only: 1, funnel: 1, ice: 3, drip: 3, lock: true },
    { colours: 13, empties: 0, hidden: true, only: 2, funnel: 1, ice: 4, drip: 3, lock: true },
    // 191–200: the finale, fourteen colours and everything at once
    { colours: 14, empties: 0, hidden: true, small: [3, 3], only: 1, ice: 3, drip: 2 },
    { colours: 14, empties: 0, hidden: true, small: [3, 2], funnel: 1, only: 1, drip: 3, lock: true },
    { colours: 14, empties: 0, hidden: true, small: [3], only: 2, funnel: 1, ice: 3 },
    { colours: 14, empties: 0, hidden: true, small: [2, 2], only: 1, funnel: 1, drip: 4, lock: true },
    { colours: 14, empties: 0, hidden: true, small: [3, 2], only: 2, ice: 4, drip: 2 },
    { colours: 14, empties: 0, hidden: true, small: [3], only: 1, funnel: 2, ice: 3, drip: 3, lock: true },
    { colours: 14, empties: 0, hidden: true, small: [2, 2], only: 2, funnel: 1, ice: 4, drip: 3 },
    { colours: 14, empties: 0, hidden: true, small: [3], only: 2, funnel: 1, ice: 4, drip: 4, lock: true },
    { colours: 14, empties: 0, hidden: true, small: [2], only: 2, funnel: 2, ice: 4, drip: 4, lock: true },
    { colours: 14, empties: 0, hidden: true, small: [3], only: 2, funnel: 1, ice: 5, drip: 4, lock: true }
  ];
  const SEEDS = [4, 16, 44, 27, 50, 3, 28, 47, 18, 57, 45, 32, 30, 53, 15, 13, 36, 45, 2, 13,
    11, 34, 26, 21, 26, 40, 57, 45, 51, 27, 22, 33, 4, 27, 50, 8, 43, 50, 15, 37,
    59, 10, 6, 48, 24, 26, 33, 36, 57, 1, 52, 49, 31, 57, 51, 41, 57, 2, 6, 43,
    2, 1, 12, 18, 14, 13, 6, 30, 9, 13, 13, 6, 8, 31, 4, 14, 26, 19, 2, 20,
    18, 0, 17, 29, 24, 34, 11, 1, 1, 37, 21, 22, 38, 16, 34, 30, 27, 38, 35, 24];
  // From level 121, a searched-out shake of the solver that finds a short
  // way, so the three-star mark is tighter.
  const JITS = [324, 53, 359, 340, 20, 256, 112, 239, 255, 151, 318, 391, 332, 154, 4, 123, 213, 301, 66, 70,
    36, 94, 266, 301, 269, 264, 60, 1, 186, 216, 312, 254, 69, 111, 20, 202, 282, 26, 126, 5,
    187, 194, 102, 41, 52, 197, 36, 79, 168, 276, 199, 35, 162, 115, 183, 264, 194, 31, 147, 168,
    53, 13, 3, 261, 4, 199, 245, 290, 11, 257, 20, 45, 37, 176, 48, 236, 101, 150, 147, 68];
  function levelOf(n) {
    const num = Math.max(1, Math.min(LEVELS, Math.floor(n) || 1));
    const level = { num, colours: 0, empties: 2, hidden: false, lock: false, ice: 0, iceTurns: 0, small: [], only: 0, drip: 0, funnel: 0, seed: 0, hard: false };
    if (num > 100) {
      const k = num - 101;
      Object.assign(level, { empties: 1, hard: k >= 90 ? 4 : k >= 40 ? 3 : k >= 20 ? 2 : 1, seed: SEEDS[k] || 0, jit: JITS[k - 20] || 0 }, HARD[k]);
      if (level.ice) level.iceTurns = Math.min(20, 6 + Math.floor(k / 4));
      return level;
    }
    if (num <= 40) {
      // (the first forty were made with eleven colours at most)
      level.colours = Math.min(11, 2 + Math.ceil(num / 3.5));
      level.hidden = num >= 6 && num % 3 === 0;
      level.lock = num >= 10 && num % 4 === 2;
      return level;
    }
    const k = (num - 41) % 10, chapter = Math.floor((num - 41) / 10);
    level.colours = STEP[k];
    level.hidden = num % 3 === 0;
    level.lock = num % 4 === 2;
    if (chapter === 0) { level.ice = k < 3 ? 1 : k < 7 ? 2 : 3; }
    else if (chapter === 1) { level.empties = 1; level.small = k < 4 ? [3, 3] : k < 8 ? [3, 2] : [2, 2, 2]; }
    else if (chapter === 2) { if (k >= 5) level.empties = 1; level.only = k < 5 ? 1 : 2; }
    else if (chapter === 3) { level.drip = k < 4 ? 2 : 3; if (k % 3 === 2) level.ice = 1; }
    else if (chapter === 4) { level.empties = 1; level.funnel = 1; if (k >= 5) level.small = [3]; if (k % 4 === 3) level.ice = 1; }
    else Object.assign(level, { empties: 1 }, MASTER[k]);
    if (level.ice) level.iceTurns = 4 + Math.floor(k / 2);
    return level;
  }
  // the twists a level has, as keys of TWISTS
  const twistsOf = (level) => TWISTS.filter(t => t.key === "small" ? level.small.length > 0 : Boolean(level[t.key])).map(t => t.key);

  // A small seeded random source.
  function random(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---- A board ----
  // { bottles: [{ layers: [colour, ...] bottom to top, hide: how many of
  // the bottom layers are still hidden, lock: the colour that uncorks it
  // or -1, ice: pours left until it thaws, cap: its room, only: the one
  // colour it takes or -1, drip: pours one layer at a time, funnel: takes
  // potion but never gives it back }] }
  const bottle = (layers = [], o = {}) => ({ layers: layers.slice(), hide: o.hide || 0, lock: o.lock ?? -1, ice: o.ice || 0, cap: o.cap || CAP, only: o.only ?? -1, drip: Boolean(o.drip), funnel: Boolean(o.funnel) });
  const clone = (state) => ({ bottles: state.bottles.map(b => bottle(b.layers, b)) });
  const capOf = (b) => b.cap || CAP;
  const top = (b) => b.layers[b.layers.length - 1];
  // how many layers of the top colour sit together on top
  function run(b) {
    let k = 0;
    for (let i = b.layers.length - 1; i >= 0 && b.layers[i] === top(b); i--) k++;
    return k;
  }
  const isFull = (b) => b.layers.length === CAP && run(b) === CAP;
  const isSolved = (state) => state.bottles.every(b => !b.layers.length || isFull(b));
  // what sort of bottle (the same sort, empty, is as good as another)
  const kindOf = (b) => `${capOf(b) !== CAP ? `c${b.cap}` : ""}${(b.only ?? -1) >= 0 ? `o${b.only}` : ""}${b.drip ? "d" : ""}${b.funnel ? "f" : ""}`;
  // how much a pour from a to b would move
  const amountOf = (from, to) => Math.min(from.drip ? 1 : run(from), capOf(to) - to.layers.length);

  // Can the top of bottle a go into bottle b?
  function canPour(state, a, b) {
    const from = state.bottles[a], to = state.bottles[b];
    if (!from || !to || a === b || !from.layers.length || to.layers.length >= capOf(to)) return false;
    if (from.lock >= 0 || to.lock >= 0 || from.ice > 0 || to.ice > 0 || from.funnel || isFull(from)) return false;
    if ((to.only ?? -1) >= 0 && top(from) !== to.only) return false;
    return !to.layers.length || top(to) === top(from);
  }
  // Pour: how many layers moved (0 if it can't). Reveals the layer that
  // comes to the top, thaws the ice a pour, and uncorks bottles once their
  // colour is filled.
  function pour(state, a, b) {
    if (!canPour(state, a, b)) return 0;
    const from = state.bottles[a], to = state.bottles[b];
    const amount = amountOf(from, to);
    for (let k = 0; k < amount; k++) to.layers.push(from.layers.pop());
    if (from.layers.length && from.hide > from.layers.length - 1) from.hide = from.layers.length - 1;
    if (!from.layers.length) from.hide = 0;
    for (const bottle of state.bottles) if (bottle.ice > 0) bottle.ice--;
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
  const keyOf = (state) => state.bottles.map(b => b.layers.join(".") + (b.lock >= 0 ? `#${b.lock}` : "") + (b.ice > 0 ? `*${b.ice}` : "") + kindOf(b)).sort().join("|");
  function worth(state, a, b, waiting) {
    const from = state.bottles[a], to = state.bottles[b];
    // pouring a bottle of one colour into an empty one of the same sort
    // changes nothing (but passes a pour while ice thaws)
    if (!to.layers.length && run(from) === from.layers.length && kindOf(from) === kindOf(to)) return waiting ? 0 : -1;
    const amount = amountOf(from, to);
    let score = amount;
    if (to.layers.length && to.layers.length + amount === CAP && run(to) === to.layers.length) score += 20; // fills a bottle
    if (to.layers.length) score += 8;                                                                    // onto its colour
    if (amount === run(from)) score += 4;                                                                // takes the whole run
    if (from.layers.length - amount && from.layers[from.layers.length - amount - 1] !== top(from)) score += 1;
    return score;
  }
  // jitter: a random source that shakes up equal choices (another way)
  // stats, if given, gets how many boards the search looked at
  function solve(start, limit = 200000, jitter = null, stats = null) {
    const seen = new Set(), path = [];
    let boards = 0, gaveUp = false;
    const go = (state) => {
      if (isSolved(state)) return true;
      if (++boards > limit) { gaveUp = true; return false; }
      const key = keyOf(state);
      if (seen.has(key)) return false;
      seen.add(key);
      const firstEmpty = new Map(), waiting = state.bottles.some(b => b.ice > 0);
      const list = [];
      for (const [a, b] of moves(state)) {
        // one empty bottle is as good as another of its sort
        const to = state.bottles[b];
        if (!to.layers.length && to.lock < 0) { const kind = kindOf(to); if (!firstEmpty.has(kind)) firstEmpty.set(kind, b); else if (b !== firstEmpty.get(kind)) continue; }
        const w = worth(state, a, b, waiting);
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
    const found = go(clone(start));
    if (stats) stats.boards = boards;
    return found ? path : null;
  }
  // Shorten a found way: drop pours that come back to a board seen
  // earlier on it (the same bottles in the same places).
  const placeKey = (state) => state.bottles.map(b => b.layers.join(".") + (b.lock >= 0 ? `#${b.lock}` : "") + (b.ice > 0 ? `*${b.ice}` : "")).join("|");
  function tidy(start, path) {
    let best = path.slice();
    const boards = [placeKey(start)];
    let state = clone(start);
    for (const [a, b] of best) { pour(state, a, b); boards.push(placeKey(state)); }
    for (let i = 0; i < boards.length; i++) {
      const j = boards.lastIndexOf(boards[i]);
      if (j > i) { best.splice(i, j - i); boards.splice(i, j - i); }
    }
    return best;
  }

  // ---- Dealing a level ----
  // The colours, CAP of each, shuffled into full bottles, then the empty
  // ones; hidden levels hide all but the top layer, a lock level corks a
  // bottle with a colour it doesn't hold; then the later twists: frozen
  // and drip bottles among the full ones, and the small, one-colour and
  // funnel bottles. Dealt again (next seed) until no bottle starts sorted
  // and the level can be solved.
  function deal(level) {
    const small = level.small || [];
    for (let attempt = level.seed || 0; attempt < (level.seed || 0) + 400; attempt++) {
      const rnd = random(level.num * 7919 + attempt * 104729 + 17);
      const layers = [];
      for (let c = 0; c < level.colours; c++) for (let k = 0; k < CAP; k++) layers.push(c);
      for (let i = layers.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [layers[i], layers[j]] = [layers[j], layers[i]]; }
      const bottles = [];
      for (let c = 0; c < level.colours; c++) bottles.push(bottle(layers.slice(c * CAP, c * CAP + CAP), { hide: level.hidden ? CAP - 1 : 0 }));
      if (bottles.some(b => run(b) >= 3)) continue;
      for (let e = 0; e < level.empties; e++) bottles.push(bottle());
      if (level.lock) {
        const which = Math.floor(rnd() * level.colours), held = new Set(bottles[which].layers);
        const free = [];
        for (let c = 0; c < level.colours; c++) if (!held.has(c)) free.push(c);
        if (!free.length) continue;
        bottles[which].lock = free[Math.floor(rnd() * free.length)];
      }
      // the full bottles, in a shuffled order, for the frozen and drip ones
      const order = [];
      for (let c = 0; c < level.colours; c++) if (bottles[c].lock < 0) order.push(c);
      for (let i = order.length - 1; i > 0 && (level.ice || level.drip); i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      for (let k = 0; k < (level.ice || 0); k++) bottles[order[k]].ice = level.iceTurns + Math.floor(rnd() * 5);
      for (let k = 0; k < (level.drip || 0); k++) bottles[order[order.length - 1 - k]].drip = true;
      for (const cap of small) bottles.push(bottle([], { cap }));
      const tints = [];
      for (let k = 0; k < (level.only || 0); k++) {
        let c = Math.floor(rnd() * level.colours);
        while (tints.includes(c)) c = (c + 1) % level.colours;
        tints.push(c);
        bottles.push(bottle([], { only: c }));
      }
      for (let k = 0; k < (level.funnel || 0); k++) bottles.push(bottle([], { funnel: true }));
      const state = { bottles };
      const way = solve(state);
      if (!way) continue;
      // a few more searches, each shaken differently, for a shorter way
      // (a level with a searched-out shake has it beat them all already)
      let short = tidy(state, way);
      for (let k = 0; k < (level.jit ? 0 : 6); k++) {
        const other = solve(state, 60000, random(level.num * 31 + k * 977 + attempt));
        if (other && other.length < short.length) { const t = tidy(state, other); if (t.length < short.length) short = t; }
      }
      if (level.jit) {
        const other = solve(state, 200000, random(level.jit));
        if (other) { const t = tidy(state, other); if (t.length < short.length) short = t; }
      }
      return { state, par: short.length, way: short, attempt };
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
  // and ore for the card battles; three stars the first time more gems,
  // and the last level of a chapter, the first time, more again.
  function rewardFor(level, first, stars, before = 0) {
    const coins = Math.round((30 + 6 * level.num) * (first ? 1 : .5));
    const gems = (first ? 10 : 0) + (stars >= 3 && before < 3 ? 10 : 0) + (first && level.num === chapterOf(level.num).to ? 20 : 0);
    return { coins, gems, dust: first ? 3 : 0, ore: first ? 5 : 0 };
  }

  return {
    LEVELS, CAP, UNDOS, EXTRAS, HINTS, COLOURS, TWISTS, CHAPTERS,
    levelOf, twistsOf, chapterOf, random, bottle, clone, capOf, top, run, isFull, isSolved, canPour, pour, moves, solve, tidy, deal, hint, starsFor, rewardFor
  };
});

// Joining a device's save with the account's save.
//
// Coins are the only thing money can buy, so the server owns the coin
// balance. A device reports how its coins moved since it last synced
// (coins now minus coins at the last sync) and the server applies that
// difference to the balance; a top-up credited in between is kept. Every
// other field is either "the biggest wins" (totals), "both" (things owned
// or cleared) or "the device wins" (what is equipped).

const SLOT_GROUPS = ["hero", "skin", "hat", "pet"];
const MAX_SAVE_BYTES = 60_000;

const int = (value, max = Number.MAX_SAFE_INTEGER) => Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
const idList = (value) => Array.isArray(value) ? [...new Set(value.filter(v => typeof v === "string" && v.length <= 40))].slice(0, 500) : [];
const numberList = (value) => Array.isArray(value) ? [...new Set(value.map(Number).filter(n => Number.isInteger(n) && n > 0 && n <= 1000))].sort((a, b) => a - b) : [];
const intMap = (value, max) => {
  const out = {};
  if (value && typeof value === "object") for (const [key, count] of Object.entries(value)) if (/^[a-z0-9]{1,30}$/.test(key)) out[key] = int(count, max);
  return out;
};

// The day's quests: what was done (counts) and what was claimed.
const cleanQuest = (raw) => (raw && typeof raw.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.day)
  ? { day: raw.day, counts: intMap(raw.counts, 100_000), claimed: idList(raw.claimed) }
  : undefined);
const mergeQuest = (a, b) => {
  if (!a || !b) return a || b;
  if (a.day !== b.day) return a.day > b.day ? a : b;
  const counts = { ...a.counts };
  for (const [key, n] of Object.entries(b.counts)) counts[key] = Math.max(counts[key] || 0, n);
  return { day: a.day, counts, claimed: [...new Set([...a.claimed, ...b.claimed])] };
};

// Items from battles: { i: id, s: slot 0-7, r: rarity 1-5, m: main roll
// 0-100, x: up to four extra stats (stat 0-4 * 1000 + roll 0-100), o: the
// card wearing it or "" } (one a slot per card); gone: items broken down.
const ITEMS_MAX = 150;
const itemId = (v) => typeof v === "string" && /^[a-z0-9]{1,12}$/.test(v);
const cleanItems = (raw, units) => {
  const items = [], seen = new Set(), worn = new Set();
  for (const it of Array.isArray(raw) ? raw : []) {
    if (!it || !itemId(it.i) || seen.has(it.i) || items.length >= ITEMS_MAX) continue;
    const s = Math.floor(Number(it.s)), r = Math.floor(Number(it.r)), m = Math.floor(Number(it.m));
    if (!(s >= 0 && s <= 7 && r >= 1 && r <= 5 && m >= 0 && m <= 100)) continue;
    const x = (Array.isArray(it.x) ? it.x : []).map(Number).filter(v => Number.isInteger(v) && v >= 0 && Math.floor(v / 1000) <= 4 && v % 1000 <= 100).slice(0, r - 1);
    let o = typeof it.o === "string" && units[it.o] ? it.o : "";
    if (o && worn.has(`${o}:${s}`)) o = "";
    if (o) worn.add(`${o}:${s}`);
    seen.add(it.i);
    items.push({ i: it.i, s, r, m, x, o });
  }
  return items;
};
const cleanGone = (raw) => (Array.isArray(raw) ? raw.filter(itemId).slice(-300) : []);
// Both copies' items, but none broken down on either; for an item on both,
// and for which item a card wears in a slot, the device's copy wins.
function mergeItems(now, next) {
  const gone = [...new Set([...now.gone, ...next.gone])].slice(-300), dead = new Set(gone);
  const fromNext = new Set(next.items.map(it => it.i));
  const byId = new Map();
  for (const it of [...next.items, ...now.items]) if (!dead.has(it.i) && !byId.has(it.i)) byId.set(it.i, it);
  const worn = new Set();
  const items = [...byId.values()].sort((a, b) => fromNext.has(b.i) - fromNext.has(a.i)).map(it => {
    if (!it.o) return it;
    const key = `${it.o}:${it.s}`;
    if (worn.has(key)) return { ...it, o: "" };
    worn.add(key);
    return it;
  }).slice(0, ITEMS_MAX);
  return { items, gone };
}

// Saved team sets: five slots, each null or a name and five places.
const TEAM_SETS = 5;
const cleanSets = (raw) => Array.from({ length: TEAM_SETS }, (_, k) => {
  const one = Array.isArray(raw) ? raw[k] : null;
  if (!one || typeof one !== "object" || !Array.isArray(one.t)) return null;
  return { n: typeof one.n === "string" ? one.n.slice(0, 16) : "", t: one.t.slice(0, 5).map(id => (typeof id === "string" && /^[a-z0-9]{1,30}$/.test(id) ? id : "")) };
});

// The dragon raid: a day's best score and the coins paid for it, and the
// best score ever.
const isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const cleanRaid = (raw) => (raw && typeof raw === "object" && isDay(raw.day) ? { day: raw.day, best: int(raw.best, 1e12), paid: int(raw.paid, 1e9), top: int(raw.top, 1e12) } : null);
function mergeRaid(now, next) {
  if (!now || !next) return next || now;
  const top = Math.max(now.top, next.top);
  // the same day: the best on either copy, and every coin paid stays paid
  if (now.day === next.day) return { day: now.day, best: Math.max(now.best, next.best), paid: Math.max(now.paid, next.paid), top };
  return { ...(next.day > now.day ? next : now), top };
}

// A time-limited event (Halloween's candy): what it earned, what the shop
// took (bought: offer -> times), and the day's candy from battles, the
// day's gift and the day's raid candy. Candy left is earned less bought,
// so the higher of each, merged, never makes candy out of nothing.
const cleanEvent = (raw) => (raw && typeof raw === "object" && typeof raw.id === "string" && /^[a-z0-9]{1,30}$/.test(raw.id)
  ? { id: raw.id, earned: int(raw.earned, 1e7), bought: intMap(raw.bought, 1000), day: isDay(raw.day) ? raw.day : "", battle: int(raw.battle, 1e6), gift: raw.gift === true, raid: int(raw.raid, 1e6) }
  : null);
function mergeEvent(now, next) {
  if (!now || !next || now.id !== next.id) return next || now;
  const days = now.day === next.day
    ? { day: now.day, battle: Math.max(now.battle, next.battle), gift: now.gift || next.gift, raid: Math.max(now.raid, next.raid) }
    : (next.day > now.day ? { day: next.day, battle: next.battle, gift: next.gift, raid: next.raid } : { day: now.day, battle: now.battle, gift: now.gift, raid: now.raid });
  return { id: now.id, earned: Math.max(now.earned, next.earned), bought: maxMap(now.bought, next.bought), ...days };
}

// Card battles: each card's level, the best stars per stage, the team of
// five ("" for an empty slot) and two switches.
const cleanCards = (raw) => {
  const cards = raw && typeof raw === "object" ? raw : {};
  const team = Array.isArray(cards.team) ? cards.team.slice(0, 5).map(id => (typeof id === "string" && /^[a-z0-9]{1,30}$/.test(id) ? id : "")) : [];
  const daily = cards.daily && typeof cards.daily.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cards.daily.day) ? { day: cards.daily.day, streak: int(cards.daily.streak, 7) } : null;
  const units = intMap(cards.units, 200);
  return {
    units, items: cleanItems(cards.items, units), gone: cleanGone(cards.gone), stars: intMap(cards.stars, 3), team, sets: cleanSets(cards.sets), set: int(cards.set, TEAM_SETS - 1), arenaPick: idList(cards.arenaPick).slice(0, 10), arenaFront: idList(cards.arenaFront).slice(0, 4), auto: cards.auto === true, fast: cards.fast === true,
    xp: intMap(cards.xp, 1_000_000), outfit: intMap(cards.outfit, 2), hallo: intMap(cards.hallo, 1), awake: intMap(cards.awake, 10), shards: intMap(cards.shards, 1_000_000), dust: int(cards.dust, 1_000_000), wings: cards.wings == null ? undefined : int(cards.wings, 1_000_000), ore: cards.ore == null ? undefined : int(cards.ore, 1_000_000), gear: intMap(cards.gear, 600), wingComp: cards.wingComp === true ? true : undefined, quest: cleanQuest(cards.quest), achv: idList(cards.achv), starPaid: numberList(cards.starPaid), arena: Math.max(1, int(cards.arena, 100_000)), tower: int(cards.tower, 1000), idleAt: int(cards.idleAt), daily,
    dungeon: cards.dungeon && typeof cards.dungeon.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cards.dungeon.day) ? { day: cards.dungeon.day, exp: cards.dungeon.exp === true, coin: cards.dungeon.coin === true } : null,
    raid: cleanRaid(cards.raid),
    event: cleanEvent(cards.event)
  };
};

const maxMap = (a = {}, b = {}) => {
  const out = { ...a };
  for (const [key, value] of Object.entries(b)) out[key] = Math.max(out[key] || 0, value);
  return out;
};

// Only the fields the game writes, with sane values, from whatever a client sent.
export function cleanSave(raw) {
  if (!raw || typeof raw !== "object" || JSON.stringify(raw).length > MAX_SAVE_BYTES) return null;
  const shop = raw.shop && typeof raw.shop === "object" ? raw.shop : {};
  const out = {
    best: int(raw.best), points: int(raw.points), coins: int(raw.coins), gems: int(raw.gems), cardPity: int(raw.cardPity, 1000), cardPity6: int(raw.cardPity6, 1000), itemPity: int(raw.itemPity, 1000), gift: typeof raw.gift === "string" ? raw.gift.slice(0, 40) : "", plays: int(raw.plays), wins: int(raw.wins),
    cleared: numberList(raw.cleared),
    stars: intMap(raw.stars, 3),
    worldRewards: numberList(raw.worldRewards),
    cards: cleanCards(raw.cards),
    // the match mode: best stars and score per level
    match: { stars: intMap(raw.match?.stars, 3), best: intMap(raw.match?.best, 10_000_000) },
    shop: { owned: idList(shop.owned), items: intMap(shop.items, 99), petLevels: intMap(shop.petLevels, 9), heroXp: intMap(shop.heroXp, 10_000_000), bring: {} }
  };
  for (const slot of SLOT_GROUPS) if (typeof shop[slot] === "string" && shop[slot].length <= 40) out.shop[slot] = shop[slot];
  if (shop.bring && typeof shop.bring === "object") for (const [key, on] of Object.entries(shop.bring)) if (/^[a-z0-9]{1,30}$/.test(key)) out.shop.bring[key] = on !== false;
  return out;
}

// Higher card levels and stars win; the team and switches come from the device.
function mergeCards(current, incoming) {
  const now = cleanCards(current), next = cleanCards(incoming);
  return {
    ...next, units: maxMap(now.units, next.units), stars: maxMap(now.stars, next.stars), team: next.team.some(Boolean) ? next.team : now.team,
    // the device's team sets, unless it has none yet
    ...(next.sets.some(Boolean) ? { sets: next.sets, set: next.set } : { sets: now.sets, set: now.set }),
    xp: maxMap(now.xp, next.xp), outfit: maxMap(now.outfit, next.outfit), hallo: maxMap(now.hallo, next.hallo), awake: maxMap(now.awake, next.awake),
    // shards and star dust are spent on stars: this device's count, unless the account is ahead
    shards: maxMap(now.shards, next.shards), dust: Math.max(now.dust, next.dust), wings: now.wings == null && next.wings == null ? undefined : Math.max(now.wings || 0, next.wings || 0),
    ore: now.ore == null && next.ore == null ? undefined : Math.max(now.ore || 0, next.ore || 0),
    // gear only goes up (tier * 100 + level), so the higher of each piece
    gear: maxMap(now.gear, next.gear),
    ...mergeItems(now, next),
    // star bonuses paid on either copy stay paid
    // the later day's quests; on the same day the most done and every claim
    quest: mergeQuest(now.quest, next.quest),
    // achievements paid on either copy stay paid
    achv: [...new Set([...now.achv, ...next.achv])],
    // the wing compensation, once given on either copy, is given
    wingComp: now.wingComp || next.wingComp || undefined,
    starPaid: [...new Set([...now.starPaid, ...next.starPaid])].sort((a, b) => a - b), arena: Math.max(now.arena, next.arena), tower: Math.max(now.tower, next.tower),
    // the later claim wins, so a hunt or a day's reward is not taken twice
    idleAt: Math.max(now.idleAt, next.idleAt),
    daily: (next.daily?.day || "") >= (now.daily?.day || "") ? next.daily : now.daily,
    // a dungeon cleared today on either copy stays cleared
    dungeon: now.dungeon && next.dungeon && now.dungeon.day === next.dungeon.day
      ? { day: now.dungeon.day, exp: now.dungeon.exp || next.dungeon.exp, coin: now.dungeon.coin || next.dungeon.coin }
      : (next.dungeon?.day || "") >= (now.dungeon?.day || "") ? next.dungeon : now.dungeon,
    raid: mergeRaid(now.raid, next.raid),
    event: mergeEvent(now.event, next.event)
  };
}

// `current` is the account's save (or null), `incoming` the device's clean
// save and `baseCoins` the device's coins at its last sync with this account.
export function mergeSave(current, incoming, baseCoins, baseGems = 0) {
  if (!current) return { ...incoming, coins: int(incoming.coins), gems: int(incoming.gems) };
  const coins = int(current.coins + (incoming.coins - int(baseCoins)));
  // gems for card pulls move the same way as coins
  const gems = int((current.gems || 0) + (incoming.gems - int(baseGems)));
  const shop = {
    ...incoming.shop,
    owned: [...new Set([...current.shop.owned, ...incoming.shop.owned])],
    items: { ...current.shop.items },
    petLevels: { ...current.shop.petLevels },
    heroXp: { ...current.shop.heroXp }
  };
  for (const [id, count] of Object.entries(incoming.shop.items)) shop.items[id] = Math.max(shop.items[id] || 0, count);
  for (const [id, level] of Object.entries(incoming.shop.petLevels)) shop.petLevels[id] = Math.max(shop.petLevels[id] || 0, level);
  for (const [id, xp] of Object.entries(incoming.shop.heroXp || {})) shop.heroXp[id] = Math.max(shop.heroXp[id] || 0, xp);
  return {
    best: Math.max(current.best, incoming.best), points: Math.max(current.points, incoming.points), coins, gems, cardPity: incoming.cardPity, cardPity6: incoming.cardPity6,
    // the newer one-time gift wins, so a gift given on one device is not given again on another
    gift: [current.gift || "", incoming.gift || ""].sort().pop(),
    plays: Math.max(current.plays, incoming.plays), wins: Math.max(current.wins, incoming.wins),
    cleared: [...new Set([...current.cleared, ...incoming.cleared])].sort((a, b) => a - b),
    stars: maxMap(current.stars, incoming.stars),
    worldRewards: [...new Set([...(current.worldRewards || []), ...incoming.worldRewards])].sort((a, b) => a - b),
    cards: mergeCards(current.cards, incoming.cards),
    match: { stars: maxMap(current.match?.stars, incoming.match?.stars), best: maxMap(current.match?.best, incoming.match?.best) },
    shop
  };
}

// The one-time gem gift, given by the server so an account gets it once
// however many devices it plays on: 10000 gems for every player. The id
// sorts after the earlier gifts' ("gacha-2026-10", "gift-2026-10-13",
// "gift-2026-10-16", "gift-2026-10-16b", "gift-2026-10-21"), so merges
// keep it.
// Changes `save` and returns the gems given (0 if already given).
export const GIFT_ID = "gift-2026-10-21b";
export const GIFT_GEMS = 10000;
export function grantGift(save) {
  if (!save || save.gift === GIFT_ID) return 0;
  save.gift = GIFT_ID;
  save.gems = (save.gems || 0) + GIFT_GEMS;
  return GIFT_GEMS;
}

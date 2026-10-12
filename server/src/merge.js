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

// Card battles: each card's level, the best stars per stage, the team of
// five ("" for an empty slot) and two switches.
const cleanCards = (raw) => {
  const cards = raw && typeof raw === "object" ? raw : {};
  const team = Array.isArray(cards.team) ? cards.team.slice(0, 5).map(id => (typeof id === "string" && /^[a-z0-9]{1,30}$/.test(id) ? id : "")) : [];
  const daily = cards.daily && typeof cards.daily.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cards.daily.day) ? { day: cards.daily.day, streak: int(cards.daily.streak, 7) } : null;
  return {
    units: intMap(cards.units, 99), stars: intMap(cards.stars, 3), team, auto: cards.auto === true, fast: cards.fast === true,
    xp: intMap(cards.xp, 1_000_000), outfit: intMap(cards.outfit, 2), awake: intMap(cards.awake, 5), shards: intMap(cards.shards, 1_000_000), dust: int(cards.dust, 1_000_000), wings: cards.wings == null ? undefined : int(cards.wings, 1_000_000), starPaid: numberList(cards.starPaid), arena: Math.max(1, int(cards.arena, 100_000)), idleAt: int(cards.idleAt), daily,
    dungeon: cards.dungeon && typeof cards.dungeon.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cards.dungeon.day) ? { day: cards.dungeon.day, exp: cards.dungeon.exp === true, coin: cards.dungeon.coin === true } : null
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
    best: int(raw.best), points: int(raw.points), coins: int(raw.coins), gems: int(raw.gems), cardPity: int(raw.cardPity, 1000), gift: typeof raw.gift === "string" ? raw.gift.slice(0, 40) : "", plays: int(raw.plays), wins: int(raw.wins),
    cleared: numberList(raw.cleared),
    stars: intMap(raw.stars, 3),
    worldRewards: numberList(raw.worldRewards),
    cards: cleanCards(raw.cards),
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
    xp: maxMap(now.xp, next.xp), outfit: maxMap(now.outfit, next.outfit), awake: maxMap(now.awake, next.awake),
    // shards and star dust are spent on stars: this device's count, unless the account is ahead
    shards: maxMap(now.shards, next.shards), dust: Math.max(now.dust, next.dust), wings: now.wings == null && next.wings == null ? undefined : Math.max(now.wings || 0, next.wings || 0),
    // star bonuses paid on either copy stay paid
    starPaid: [...new Set([...now.starPaid, ...next.starPaid])].sort((a, b) => a - b), arena: Math.max(now.arena, next.arena),
    // the later claim wins, so a hunt or a day's reward is not taken twice
    idleAt: Math.max(now.idleAt, next.idleAt),
    daily: (next.daily?.day || "") >= (now.daily?.day || "") ? next.daily : now.daily,
    // a dungeon cleared today on either copy stays cleared
    dungeon: now.dungeon && next.dungeon && now.dungeon.day === next.dungeon.day
      ? { day: now.dungeon.day, exp: now.dungeon.exp || next.dungeon.exp, coin: now.dungeon.coin || next.dungeon.coin }
      : (next.dungeon?.day || "") >= (now.dungeon?.day || "") ? next.dungeon : now.dungeon
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
    best: Math.max(current.best, incoming.best), points: Math.max(current.points, incoming.points), coins, gems, cardPity: incoming.cardPity,
    // the newer one-time gift wins, so a gift given on one device is not given again on another
    gift: [current.gift || "", incoming.gift || ""].sort().pop(),
    plays: Math.max(current.plays, incoming.plays), wins: Math.max(current.wins, incoming.wins),
    cleared: [...new Set([...current.cleared, ...incoming.cleared])].sort((a, b) => a - b),
    stars: maxMap(current.stars, incoming.stars),
    worldRewards: [...new Set([...(current.worldRewards || []), ...incoming.worldRewards])].sort((a, b) => a - b),
    cards: mergeCards(current.cards, incoming.cards),
    shop
  };
}

// The one-time gem gift for players from before card pulls, given by the
// server so an account gets it once however many devices it plays on:
// 500 gems plus what the levels already cleared would give now (5 each,
// 20 for a boss level, every fifth up to 100). Changes `save` and returns
// the gems given (0 if none: already given, or nothing played yet).
export const GIFT_ID = "gacha-2026-10";
const FREE_IDS = ["pupa", "jibjib", "cherry", "nohat", "nopet"];
export function grantGift(save) {
  if (!save || save.gift === GIFT_ID) return 0;
  const cleared = save.cleared || [];
  const played = save.points > 0 || save.plays > 0 || cleared.length > 0 || save.coins > 0 || (save.shop?.owned || []).some(id => !FREE_IDS.includes(id));
  save.gift = GIFT_ID;
  if (!played) return 0;
  const gems = 500 + cleared.reduce((sum, num) => sum + (num % 5 === 0 && num <= 100 ? 20 : 5), 0);
  save.gems = (save.gems || 0) + gems;
  return gems;
}

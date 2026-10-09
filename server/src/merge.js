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
    best: int(raw.best), points: int(raw.points), coins: int(raw.coins), plays: int(raw.plays), wins: int(raw.wins),
    cleared: numberList(raw.cleared),
    stars: intMap(raw.stars, 3),
    worldRewards: numberList(raw.worldRewards),
    shop: { owned: idList(shop.owned), items: intMap(shop.items, 99), petLevels: intMap(shop.petLevels, 9), heroXp: intMap(shop.heroXp, 10_000_000), bring: {} }
  };
  for (const slot of SLOT_GROUPS) if (typeof shop[slot] === "string" && shop[slot].length <= 40) out.shop[slot] = shop[slot];
  if (shop.bring && typeof shop.bring === "object") for (const [key, on] of Object.entries(shop.bring)) if (/^[a-z0-9]{1,30}$/.test(key)) out.shop.bring[key] = on !== false;
  return out;
}

// `current` is the account's save (or null), `incoming` the device's clean
// save and `baseCoins` the device's coins at its last sync with this account.
export function mergeSave(current, incoming, baseCoins) {
  if (!current) return { ...incoming, coins: int(incoming.coins) };
  const coins = int(current.coins + (incoming.coins - int(baseCoins)));
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
    best: Math.max(current.best, incoming.best), points: Math.max(current.points, incoming.points), coins,
    plays: Math.max(current.plays, incoming.plays), wins: Math.max(current.wins, incoming.wins),
    cleared: [...new Set([...current.cleared, ...incoming.cleared])].sort((a, b) => a - b),
    stars: maxMap(current.stars, incoming.stars),
    worldRewards: [...new Set([...(current.worldRewards || []), ...incoming.worldRewards])].sort((a, b) => a - b),
    shop
  };
}

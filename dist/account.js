// The player's account: Google sign-in, the cloud save and coin top-ups.
//
// game.js owns the save and the screens; this module talks to the API
// server and to Firebase Auth, and tells the game (window.PupaGame) when the
// account or the cloud save changes. On localhost, or when Firebase is not
// configured, sign-in is a pretend "dev:<name>" account that the dev-mode
// API server accepts.

const config = window.PUPA_CONFIG || {};
const onLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);
const API = (onLocalhost ? config.devApiBase || "http://localhost:8787" : config.apiBase || "").replace(/\/$/, "");
const DEV_AUTH = onLocalhost || !config.firebase;
const DEV_USER_KEY = "superPupaRunDevUser";
const PENDING_KEY = "superPupaRunPendingTopup";
const SYNC_DELAY = 2500;

const state = { available: Boolean(API) && (DEV_AUTH ? onLocalhost : true), ready: false, user: null, busy: false, topupCoins: 0, error: null };
let firebaseAuth = null;
let getIdToken = async () => null;
let syncTimer = 0;
let syncing = null;
let devName = null;

const game = () => window.PupaGame;
const changed = () => window.dispatchEvent(new CustomEvent("pupa-account", { detail: state }));
const storage = {
  get: (key) => { try { return localStorage.getItem(key); } catch { return null; } },
  set: (key, value) => { try { value == null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* ignore */ } }
};

// ---- Talking to the API ----

export class ApiError extends Error {
  constructor(status, body) { super(body?.message || body?.error || `HTTP ${status}`); this.status = status; this.code = body?.error || "http_error"; this.body = body; }
}

async function api(path, { method = "GET", body, keepalive = false } = {}) {
  const token = await getIdToken();
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(API + path, { method, headers, body: body && JSON.stringify(body), keepalive });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

// ---- Signing in ----

async function setupFirebase() {
  const [{ initializeApp }, auth] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")
  ]);
  const app = initializeApp(config.firebase);
  firebaseAuth = { ...auth, instance: auth.getAuth(app) };
  getIdToken = async () => firebaseAuth.instance.currentUser ? firebaseAuth.instance.currentUser.getIdToken() : null;
  // A sign-in that went through a redirect (phones) lands back here.
  await auth.getRedirectResult(firebaseAuth.instance).catch(() => null);
  auth.onAuthStateChanged(firebaseAuth.instance, (user) => { user ? afterSignIn() : afterSignOut(); });
}

function setupDevAuth() {
  devName = storage.get(DEV_USER_KEY);
  getIdToken = async () => devName ? "dev:" + devName : null;
  if (devName) afterSignIn();
}

export async function signIn() {
  if (!state.available || state.busy) return;
  state.busy = true; state.error = null; changed();
  try {
    if (DEV_AUTH) {
      devName = (storage.get(DEV_USER_KEY) || "tester").toLowerCase().replace(/[^a-z0-9_-]/g, "") || "tester";
      storage.set(DEV_USER_KEY, devName);
      await afterSignIn();
    } else {
      const provider = new firebaseAuth.GoogleAuthProvider();
      try {
        await firebaseAuth.signInWithPopup(firebaseAuth.instance, provider);
      } catch (error) {
        // Popups are often blocked in installed web apps; a redirect works there.
        if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(error.code)) {
          await firebaseAuth.signInWithRedirect(firebaseAuth.instance, provider);
        } else if (error.code !== "auth/popup-closed-by-user") throw error;
      }
      // onAuthStateChanged finishes the job.
    }
  } catch (error) {
    state.error = "เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง";
    console.warn("sign-in failed", error);
  } finally {
    state.busy = false; changed();
  }
}

export async function signOut() {
  if (DEV_AUTH) { devName = null; storage.set(DEV_USER_KEY, null); afterSignOut(); }
  else await firebaseAuth.signOut(firebaseAuth.instance);
}

async function afterSignIn() {
  state.busy = true; state.error = null; changed();
  try {
    const me = await api("/api/login", { method: "POST" });
    state.user = me.user;
    state.topupCoins = me.topupCoins || 0;
    changed();
    // The first sync joins this device's progress with the account's.
    await sync(true);
    resumePendingTopup();
  } catch (error) {
    state.user = null;
    state.error = error.code === "not_configured" ? "เซิร์ฟเวอร์ยังไม่พร้อมรับการเข้าสู่ระบบ" : "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้";
    console.warn("login failed", error);
  } finally {
    state.busy = false; changed();
  }
}

function afterSignOut() {
  state.user = null;
  state.topupCoins = 0;
  window.clearTimeout(syncTimer);
  changed();
}

// ---- Cloud save ----

// Send this device's save and take back the account's merged copy. `full`
// (right after signing in) applies everything; a routine sync only
// corrects the coin balance so a top-up credited elsewhere shows up.
export async function sync(full = false) {
  const g = game();
  if (!state.user || !g) return null;
  if (syncing) return syncing;
  const sentCoins = g.save.coins;
  const body = { save: g.exportSave(), baseCoins: g.cloudBase(state.user.uid), syncId: crypto.randomUUID() };
  syncing = api("/api/save", { method: "PUT", body }).then(result => {
    g.applyCloudSave(result.save, state.user.uid, sentCoins, full);
    state.topupCoins = result.topupCoins || 0;
    changed();
    return result;
  }).catch(error => { console.warn("sync failed", error); return null; }).finally(() => { syncing = null; });
  return syncing;
}

function scheduleSync() {
  if (!state.user) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => sync(), SYNC_DELAY);
}

// Leaving the page: push what has not been sent yet, without waiting.
async function flushSync() {
  const g = game();
  if (!state.user || !g || document.visibilityState !== "hidden") return;
  window.clearTimeout(syncTimer);
  if (g.save.cloud?.uid === state.user.uid && g.save.cloud.coins === g.save.coins) return;
  const body = { save: g.exportSave(), baseCoins: g.cloudBase(state.user.uid), syncId: crypto.randomUUID() };
  const sentCoins = g.save.coins;
  g.markSynced(state.user.uid, sentCoins);
  api("/api/save", { method: "PUT", body, keepalive: true }).catch(() => { /* next visit syncs again */ });
}

// ---- Top-ups ----

export const PACKS = [
  { id: "p19", baht: 19, coins: 200, name: "ถุงเหรียญเล็ก" },
  { id: "p39", baht: 39, coins: 450, name: "ถุงเหรียญกลาง", tag: "คุ้มกว่า" },
  { id: "p79", baht: 79, coins: 1000, name: "หีบเหรียญใหญ่", tag: "คุ้มสุด" }
];

// Start a payment. Returns the order: for TrueMoney an `authorizeUri` to
// send the player to, for PromptPay a `qrImage` to show.
export async function createTopup(pack, method, phone) {
  const order = await api("/api/topup", { method: "POST", body: { pack, method, phone } });
  if (order.status === "pending") storage.set(PENDING_KEY, order.orderId);
  return order;
}

export const getOrder = (id) => api(`/api/orders/${encodeURIComponent(id)}`);

// Ask about an order every few seconds until it is paid or failed. Calls
// `onUpdate` with each answer; resolves with the final one (or null when
// stopped or timed out).
export function watchOrder(orderId, onUpdate, { every = 3000, forMs = 20 * 60_000 } = {}) {
  let stopped = false;
  const done = new Promise(resolve => {
    const started = Date.now();
    const tick = async () => {
      if (stopped) return resolve(null);
      let order = null;
      try { order = await getOrder(orderId); } catch (error) { if (error.status === 404) { stopped = true; return resolve(null); } }
      if (order) {
        onUpdate?.(order);
        if (order.status !== "pending") {
          storage.set(PENDING_KEY, null);
          if (order.status === "paid") await sync();
          return resolve(order);
        }
      }
      if (Date.now() - started > forMs) { stopped = true; return resolve(null); }
      window.setTimeout(tick, every);
    };
    tick();
  });
  return { done, stop: () => { stopped = true; } };
}

// Back from TrueMoney (?topup=<orderId>), or a QR left open last time.
function resumePendingTopup() {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get("topup");
  if (fromUrl) {
    params.delete("topup");
    const query = params.toString();
    history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + location.hash);
  }
  const orderId = fromUrl || storage.get(PENDING_KEY);
  if (orderId) game()?.resumeTopup?.(orderId, Boolean(fromUrl));
}

// ---- Wiring ----

async function start() {
  if (!state.available) { state.ready = true; changed(); return; }
  try {
    if (DEV_AUTH) setupDevAuth();
    else await setupFirebase();
  } catch (error) {
    state.available = false;
    console.warn("account setup failed", error);
  }
  state.ready = true;
  changed();
  game()?.onSaveWritten?.(scheduleSync);
  document.addEventListener("visibilitychange", flushSync);
  window.addEventListener("pagehide", flushSync);
}

window.PupaAccount = { state, signIn, signOut, sync, createTopup, getOrder, watchOrder, PACKS, devAuth: DEV_AUTH };
start();

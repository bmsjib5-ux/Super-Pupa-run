// Settings come from the environment. On Render every setting is required;
// on a developer's machine the server runs in "dev mode" instead: an
// in-memory store, make-believe sign-in tokens and a pretend payment page.
const env = process.env;

export const DEV_MODE = env.DEV_MODE === "1" || (!env.RENDER && !env.FIREBASE_SERVICE_ACCOUNT);
export const PORT = Number(env.PORT) || 8787;

// Where the game is served from; only these origins may call the API.
export const APP_ORIGINS = (env.APP_ORIGINS || "https://super-pupa-run.onrender.com,https://bmsjib5-ux.github.io,http://localhost:5173,http://127.0.0.1:5173")
  .split(",").map(s => s.trim()).filter(Boolean);
// The page a payment returns to, with ?topup=<orderId> added.
export const APP_RETURN_URL = env.APP_RETURN_URL || (DEV_MODE ? "http://localhost:5173/" : "https://super-pupa-run.onrender.com/");
// This server's own address, used for the dev payment page links.
export const PUBLIC_URL = (env.PUBLIC_URL || env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, "");

export const OMISE_SECRET_KEY = env.OMISE_SECRET_KEY || "";
export const FIREBASE_SERVICE_ACCOUNT = env.FIREBASE_SERVICE_ACCOUNT || "";

// Coin packs for sale. Prices are in satang (1 baht = 100 satang); Opn
// refuses PromptPay and TrueMoney charges under 20 baht.
export const PACKS = {
  p20: { id: "p20", baht: 20, amount: 2000, coins: 200, name: "ถุงเหรียญเล็ก" },
  p39: { id: "p39", baht: 39, amount: 3900, coins: 450, name: "ถุงเหรียญกลาง" },
  p79: { id: "p79", baht: 79, amount: 7900, coins: 1000, name: "หีบเหรียญใหญ่" }
};
export const METHODS = ["truemoney", "promptpay"];

// Does FIREBASE_SERVICE_ACCOUNT look like a service-account key? Only the
// shape is checked here (nothing secret is reported), so /api/health can
// say whether the pasted JSON is usable before the server is fully set up.
export function firebaseKeyStatus() {
  if (!FIREBASE_SERVICE_ACCOUNT) return "missing";
  let key;
  try { key = JSON.parse(FIREBASE_SERVICE_ACCOUNT); } catch { return "not_json"; }
  if (key?.type !== "service_account" || !key.client_email || !String(key.private_key || "").includes("PRIVATE KEY")) return "not_a_service_account";
  return "ok:" + key.project_id;
}

// What is still missing for real payments. Empty means ready.
export function missingSettings() {
  if (DEV_MODE) return [];
  const missing = [];
  if (!FIREBASE_SERVICE_ACCOUNT) missing.push("FIREBASE_SERVICE_ACCOUNT");
  if (!OMISE_SECRET_KEY) missing.push("OMISE_SECRET_KEY");
  return missing;
}

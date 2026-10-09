import { createApp } from "./app.js";
import { DEV_MODE, PORT, APP_ORIGINS, PUBLIC_URL, OMISE_SECRET_KEY, FIREBASE_SERVICE_ACCOUNT, missingSettings } from "./config.js";
import { MemoryStore, FirestoreStore } from "./store.js";
import { OmiseClient, FakeOmise } from "./omise.js";
import { devVerifier, firebaseVerifier } from "./auth.js";

async function main() {
  let store, omise, verify;
  if (DEV_MODE) {
    store = new MemoryStore();
    omise = new FakeOmise(PUBLIC_URL);
    verify = devVerifier();
    console.log("dev mode: memory store, dev:<name> tokens, pretend payments at " + PUBLIC_URL + "/dev/pay/...");
  } else if (missingSettings().length) {
    // Boot anyway so /api/health can say what is missing.
    store = new MemoryStore();
    omise = new FakeOmise(PUBLIC_URL);
    verify = async () => null;
    console.warn("not configured, missing: " + missingSettings().join(", "));
  } else {
    const admin = await import("firebase-admin");
    const app = admin.default.initializeApp({ credential: admin.default.credential.cert(JSON.parse(FIREBASE_SERVICE_ACCOUNT)) });
    store = new FirestoreStore(admin.default.firestore(app));
    omise = new OmiseClient(OMISE_SECRET_KEY);
    verify = firebaseVerifier(admin.default.auth(app));
  }
  const app = createApp({ store, omise, verify, origins: APP_ORIGINS, devMode: DEV_MODE });
  app.listen(PORT, () => console.log(`Super Pupa Run API on :${PORT}`));
}

main().catch(error => { console.error(error); process.exit(1); });

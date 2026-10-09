// The HTTP API. Everything under /api answers JSON; the game calls it with
// a Firebase ID token in the Authorization header.
//
//   GET  /api/health              what is configured
//   GET  /api/packs               coin packs for sale
//   POST /api/login               who am I + my cloud save
//   PUT  /api/save                sync this device's save (see merge.js)
//   POST /api/topup               start a payment for a pack
//   GET  /api/orders/:id          how a payment is going (settles it too)
//   POST /api/webhooks/omise      Opn tells us a charge finished

import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { PACKS, METHODS, APP_RETURN_URL, missingSettings, firebaseKeyStatus } from "./config.js";
import { cleanSave, mergeSave } from "./merge.js";
import { chargeOutcome, OmiseError } from "./omise.js";
import { requireUser } from "./auth.js";

const MAX_PENDING_ORDERS = 5;
const PHONE = /^0[689]\d{8}$/;

export function createApp({ store, omise, verify, origins, devMode = false, returnUrl = APP_RETURN_URL, log = console }) {
  const app = express();
  app.set("trust proxy", 1);
  app.use(cors({ origin: origins, methods: ["GET", "POST", "PUT"], allowedHeaders: ["Authorization", "Content-Type"] }));
  app.use(express.json({ limit: "100kb" }));

  const missing = missingSettings();
  const auth = requireUser(verify);
  // Until the keys are in place, only health answers.
  const ready = (req, res, next) => missing.length ? res.status(503).json({ error: "not_configured", missing }) : next();

  app.get("/api/health", (req, res) => res.json({ ok: missing.length === 0, devMode, missing, firebaseKey: devMode ? "dev" : firebaseKeyStatus(), time: Date.now() }));
  app.get("/api/packs", (req, res) => res.json({ packs: Object.values(PACKS).map(({ amount, ...pack }) => pack), methods: METHODS }));

  // The account's view of a user: profile plus the save the game loads.
  function present(profile, user) {
    return { user: { uid: profile.uid, name: profile.name, email: profile.email, picture: profile.picture }, save: user?.save ?? null, topupCoins: user?.topupCoins || 0 };
  }

  app.post("/api/login", ready, auth, async (req, res, next) => {
    try {
      const user = await store.updateUser(req.user.uid, current => ({
        uid: req.user.uid, save: null, topupCoins: 0, createdAt: Date.now(), ...current,
        email: req.user.email, name: req.user.name, picture: req.user.picture, lastSeen: Date.now()
      }));
      res.json(present(req.user, user));
    } catch (error) { next(error); }
  });

  app.put("/api/save", ready, auth, async (req, res, next) => {
    try {
      const incoming = cleanSave(req.body?.save);
      const syncId = typeof req.body?.syncId === "string" ? req.body.syncId.slice(0, 64) : null;
      if (!incoming || !syncId) return res.status(400).json({ error: "bad_save" });
      const baseCoins = Number(req.body.baseCoins) || 0;
      const user = await store.updateUser(req.user.uid, current => {
        const base = current ?? { uid: req.user.uid, save: null, topupCoins: 0, createdAt: Date.now() };
        // The same sync sent twice (a lost reply) must not count twice.
        if (base.lastSyncId === syncId) return base;
        return { ...base, save: mergeSave(base.save, incoming, baseCoins), lastSyncId: syncId, updatedAt: Date.now() };
      });
      res.json({ save: user.save, topupCoins: user.topupCoins || 0 });
    } catch (error) { next(error); }
  });

  app.post("/api/topup", ready, auth, async (req, res, next) => {
    try {
      const pack = PACKS[req.body?.pack];
      const method = req.body?.method;
      const phone = String(req.body?.phone || "").replace(/[\s-]/g, "");
      if (!pack || !METHODS.includes(method)) return res.status(400).json({ error: "bad_request" });
      if (method === "truemoney" && !PHONE.test(phone)) return res.status(400).json({ error: "bad_phone" });
      if ((await store.pendingOrders(req.user.uid)).length >= MAX_PENDING_ORDERS) return res.status(429).json({ error: "too_many_pending" });

      const id = randomUUID();
      const charge = await omise.createCharge({
        amount: pack.amount, method, phone: method === "truemoney" ? phone : undefined,
        returnUri: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}topup=${id}`,
        description: `Super Pupa Run · ${pack.coins} เหรียญ (${pack.name})`,
        metadata: { orderId: id, uid: req.user.uid, pack: pack.id, coins: pack.coins }
      });
      const order = {
        id, uid: req.user.uid, pack: pack.id, coins: pack.coins, amount: pack.amount, method,
        chargeId: charge.id, status: chargeOutcome(charge), createdAt: Date.now(), paidAt: null
      };
      await store.putOrder(order);
      if (order.status === "paid") await store.settleOrder(id, "paid");
      res.json(orderView(order, charge));
    } catch (error) { next(error); }
  });

  app.get("/api/orders/:id", ready, auth, async (req, res, next) => {
    try {
      let order = await store.getOrder(req.params.id);
      if (!order || order.uid !== req.user.uid) return res.status(404).json({ error: "not_found" });
      let charge = null;
      if (order.status === "pending") {
        // Ask Opn directly, so a missed webhook never leaves a paid order hanging.
        charge = await omise.getCharge(order.chargeId);
        const outcome = chargeOutcome(charge);
        if (outcome !== "pending") order = await store.settleOrder(order.id, outcome);
      }
      const user = await store.getUser(req.user.uid);
      res.json({ ...orderView(order, charge), balance: user?.save?.coins ?? null });
    } catch (error) { next(error); }
  });

  // Opn posts { key: "charge.complete", data: <charge> }. The body is not
  // signed, so the charge is fetched again from Opn before anything is credited.
  app.post("/api/webhooks/omise", ready, async (req, res, next) => {
    try {
      const chargeId = req.body?.data?.id;
      if (req.body?.key !== "charge.complete" || typeof chargeId !== "string") return res.json({ ignored: true });
      const charge = await omise.getCharge(chargeId);
      const orderId = charge.metadata?.orderId;
      const outcome = chargeOutcome(charge);
      if (orderId && outcome !== "pending") {
        const order = await store.settleOrder(orderId, outcome);
        log.info?.(`order ${orderId} ${order?.status} (${chargeId})`);
      }
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  // Dev mode: the make-believe bank.
  if (devMode && omise.finish) {
    app.get("/dev/pay/:id", async (req, res) => {
      const charge = omise.charges.get(req.params.id);
      if (!charge) return res.status(404).send("no such charge");
      res.type("html").send(devPayPage(charge));
    });
    app.post("/dev/pay/:id/:outcome", (req, res) => {
      const charge = omise.finish(req.params.id, req.params.outcome);
      if (!charge) return res.status(404).send("no such charge");
      if (req.get("accept")?.includes("json")) return res.json(charge);
      res.redirect(charge.return_uri || "/");
    });
    app.get("/dev/qr/:id.svg", (req, res) => {
      res.type("svg").send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="#fff"/><rect x="20" y="20" width="200" height="200" fill="none" stroke="#000" stroke-width="8" stroke-dasharray="12 10"/><text x="120" y="110" font-family="sans-serif" font-size="20" text-anchor="middle">DEV QR</text><text x="120" y="140" font-family="sans-serif" font-size="12" text-anchor="middle">${req.params.id.slice(0, 18)}</text></svg>`);
    });
  }

  app.use("/api", (req, res) => res.status(404).json({ error: "not_found" }));
  app.use((error, req, res, next) => { // eslint-disable-line no-unused-vars
    if (error instanceof OmiseError) {
      log.warn?.(`omise: ${error.code} ${error.message}`);
      return res.status(502).json({ error: "payment_provider", message: error.message });
    }
    if (error.type === "entity.parse.failed" || error.type === "entity.too.large") return res.status(400).json({ error: "bad_request" });
    log.error?.(error);
    res.status(500).json({ error: "server_error" });
  });
  return app;
}

// What the game needs to show and follow a payment.
function orderView(order, charge) {
  const view = { orderId: order.id, pack: order.pack, coins: order.coins, amount: order.amount, method: order.method, status: order.status };
  if (charge && order.status === "pending") {
    if (charge.authorize_uri) view.authorizeUri = charge.authorize_uri;
    const qr = charge.source?.scannable_code?.image?.download_uri;
    if (qr) view.qrImage = qr;
    if (charge.expires_at) view.expiresAt = charge.expires_at;
  }
  return view;
}

function devPayPage(charge) {
  const baht = (charge.amount / 100).toFixed(2);
  return `<!doctype html><meta charset="utf-8"><title>Dev bank</title>
<body style="font-family:system-ui;max-width:28rem;margin:3rem auto;text-align:center">
<h1>ธนาคารจำลอง (dev)</h1><p>${charge.source.type} · ${baht} บาท<br><small>${charge.id}</small></p>
<form method="post" action="/dev/pay/${charge.id}/success"><button style="font-size:1.2rem;padding:.6rem 1.4rem">จ่ายสำเร็จ</button></form><br>
<form method="post" action="/dev/pay/${charge.id}/fail"><button style="font-size:1rem;padding:.4rem 1rem">ล้มเหลว</button></form></body>`;
}

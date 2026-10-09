// Opn Payments (Omise) charges: TrueMoney Wallet and PromptPay.
// https://docs.opn.ooo/charges-api
//
// A charge is created with its payment source inline. TrueMoney answers
// with an `authorize_uri` the player is sent to; PromptPay answers with a
// QR code image. Either way the charge is "pending" until Opn tells us
// (webhook) or we ask (GET /charges/:id) that it became "successful".

import { randomUUID } from "node:crypto";

const API = "https://api.omise.co";

export class OmiseError extends Error {
  constructor(message, code, status) { super(message); this.code = code; this.status = status; }
}

export class OmiseClient {
  constructor(secretKey) { this.auth = "Basic " + Buffer.from(secretKey + ":").toString("base64"); }

  async call(path, body) {
    const res = await fetch(API + path, {
      method: body ? "POST" : "GET",
      headers: { Authorization: this.auth, "Content-Type": "application/json", Accept: "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.object === "error") throw new OmiseError(json.message || res.statusText, json.code || "omise_error", res.status);
    return json;
  }

  createCharge({ amount, method, phone, returnUri, description, metadata }) {
    const source = method === "truemoney" ? { type: "truemoney", phone_number: phone } : { type: "promptpay" };
    return this.call("/charges", { amount, currency: "thb", source, return_uri: returnUri, description, metadata });
  }

  getCharge(id) { return this.call(`/charges/${encodeURIComponent(id)}`); }
}

// Dev mode stand-in: charges live in memory and the "bank" is a page on
// this server with a "paid" and a "failed" button.
export class FakeOmise {
  constructor(publicUrl) { this.publicUrl = publicUrl; this.charges = new Map(); }

  async createCharge({ amount, method, phone, returnUri, description, metadata }) {
    const id = "chrg_test_" + randomUUID().replace(/-/g, "").slice(0, 19);
    const charge = {
      object: "charge", id, amount, currency: "thb", status: "pending", paid: false, description, metadata,
      return_uri: returnUri, created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
      source: { type: method, phone_number: phone ?? null }
    };
    if (method === "truemoney") charge.authorize_uri = `${this.publicUrl}/dev/pay/${id}`;
    else charge.source.scannable_code = { image: { download_uri: `${this.publicUrl}/dev/qr/${id}.svg` } };
    this.charges.set(id, charge);
    return structuredClone(charge);
  }

  async getCharge(id) {
    const charge = this.charges.get(id);
    if (!charge) throw new OmiseError("charge not found", "not_found", 404);
    return structuredClone(charge);
  }

  // What the buttons on the dev page do.
  finish(id, outcome) {
    const charge = this.charges.get(id);
    if (!charge || charge.status !== "pending") return charge ?? null;
    charge.status = outcome === "success" ? "successful" : "failed";
    charge.paid = charge.status === "successful";
    if (!charge.paid) charge.failure_code = "payment_rejected";
    return charge;
  }
}

// Has this charge reached a final state, and which?
export function chargeOutcome(charge) {
  if (charge.status === "successful" && charge.paid) return "paid";
  if (charge.status === "failed" || charge.status === "expired" || charge.status === "reversed") return "failed";
  return "pending";
}

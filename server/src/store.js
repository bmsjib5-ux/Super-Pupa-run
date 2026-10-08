// Where accounts and orders live: Firestore on Render, memory in dev mode.
//
// A user is { uid, email, name, picture, save, topupCoins, lastSyncId,
// createdAt, updatedAt }; `save` is the game's save object with the
// server-owned coin balance inside it, or null before the first sync.
// An order is { id, uid, pack, coins, amount, method, chargeId, status
// ("pending" | "paid" | "failed"), createdAt, paidAt }.

export class MemoryStore {
  constructor() { this.users = new Map(); this.orders = new Map(); }
  async getUser(uid) { return this.users.get(uid) ?? null; }
  // Read-modify-write under a lock per user, so two requests cannot both
  // start from the same balance.
  async updateUser(uid, change) {
    const user = this.users.get(uid) ?? null;
    const next = change(user ? structuredClone(user) : null);
    if (next) this.users.set(uid, next);
    return next;
  }
  async getOrder(id) { return this.orders.get(id) ?? null; }
  async putOrder(order) { this.orders.set(order.id, structuredClone(order)); return order; }
  async pendingOrders(uid) { return [...this.orders.values()].filter(o => o.uid === uid && o.status === "pending"); }
  // Mark an order paid and credit its coins, once.
  async settleOrder(id, status) {
    const order = this.orders.get(id);
    if (!order || order.status !== "pending") return order ?? null;
    order.status = status;
    if (status === "paid") {
      order.paidAt = Date.now();
      await this.updateUser(order.uid, user => creditUser(user, order));
    }
    return structuredClone(order);
  }
}

export class FirestoreStore {
  constructor(db) { this.db = db; }
  async getUser(uid) { const doc = await this.db.collection("users").doc(uid).get(); return doc.exists ? doc.data() : null; }
  async updateUser(uid, change) {
    const ref = this.db.collection("users").doc(uid);
    return this.db.runTransaction(async tx => {
      const doc = await tx.get(ref);
      const next = change(doc.exists ? doc.data() : null);
      if (next) tx.set(ref, next);
      return next;
    });
  }
  async getOrder(id) { const doc = await this.db.collection("orders").doc(id).get(); return doc.exists ? doc.data() : null; }
  async putOrder(order) { await this.db.collection("orders").doc(order.id).set(order); return order; }
  async pendingOrders(uid) {
    const snap = await this.db.collection("orders").where("uid", "==", uid).where("status", "==", "pending").get();
    return snap.docs.map(d => d.data());
  }
  async settleOrder(id, status) {
    const orderRef = this.db.collection("orders").doc(id);
    return this.db.runTransaction(async tx => {
      const orderDoc = await tx.get(orderRef);
      if (!orderDoc.exists) return null;
      const order = orderDoc.data();
      if (order.status !== "pending") return order;
      const userRef = this.db.collection("users").doc(order.uid);
      const userDoc = await tx.get(userRef);
      order.status = status;
      if (status === "paid") {
        order.paidAt = Date.now();
        tx.set(userRef, creditUser(userDoc.exists ? userDoc.data() : null, order));
      }
      tx.set(orderRef, order);
      return order;
    });
  }
}

// Add an order's coins to the account. The coins wait in the save even if
// the player has never synced a save yet.
export function creditUser(user, order) {
  const next = user ?? { uid: order.uid, save: null, topupCoins: 0, createdAt: Date.now() };
  next.save = next.save ?? { best: 0, points: 0, coins: 0, plays: 0, wins: 0, cleared: [], shop: { owned: [], items: {}, petLevels: {}, bring: {} } };
  next.save.coins = (next.save.coins || 0) + order.coins;
  next.topupCoins = (next.topupCoins || 0) + order.coins;
  next.updatedAt = Date.now();
  return next;
}

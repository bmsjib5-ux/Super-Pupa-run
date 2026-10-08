// Who is calling: a Firebase ID token from Google sign-in, or in dev mode
// a made-up "dev:<name>" token.

export function devVerifier() {
  return async (token) => {
    const match = /^dev:([a-z0-9_-]{1,30})$/i.exec(token);
    if (!match) return null;
    const name = match[1].toLowerCase();
    return { uid: "dev-" + name, name, email: `${name}@dev.local`, picture: null };
  };
}

export function firebaseVerifier(auth) {
  return async (token) => {
    try {
      const decoded = await auth.verifyIdToken(token);
      return { uid: decoded.uid, name: decoded.name || decoded.email || "ผู้เล่น", email: decoded.email || null, picture: decoded.picture || null };
    } catch {
      return null;
    }
  };
}

// Express middleware: puts the caller on req.user or answers 401.
export function requireUser(verify) {
  return async (req, res, next) => {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    const user = token ? await verify(token) : null;
    if (!user) return res.status(401).json({ error: "unauthorized" });
    req.user = user;
    next();
  };
}

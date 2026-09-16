// Shared admin-session verification for every protected API route.
// The session cookie is `<timestamp>.<hmac-signature>`, signed with
// ADMIN_PASSWORD so no separate secret needs to be provisioned. Signing key
// stays fixed to ADMIN_PASSWORD even after the login password is changed
// (see setPassword) so changing the password doesn't need to re-sign
// already-issued sessions.
//
// The actual login password lives in D1 (admin_auth table, salted PBKDF2
// hash) so it can be changed from the admin console. Until it's changed for
// the first time, login falls back to comparing against ADMIN_PASSWORD.

export const SESSION_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

export async function isAuthed(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!match) return false;
  return await verifyToken(match[1], env.ADMIN_PASSWORD);
}

async function verifyToken(token, secret) {
  if (!secret) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const age = Date.now() - Number(payload);
  if (!Number.isFinite(age) || age < 0 || age > SESSION_MAX_AGE_MS) return false;
  const expected = await sign(payload, secret);
  return timingSafeEqual(expected, sig);
}

export async function sign(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sigBuf))).replace(/[+/=]/g, "");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function ensureAuthTables(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS admin_auth (
      id TEXT PRIMARY KEY,
      salt TEXT NOT NULL,
      hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      ip TEXT,
      action TEXT NOT NULL
    )`
  ).run();
}

async function hashPassword(password, saltB64) {
  const salt = saltB64
    ? Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0))
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
  const usedSalt = saltB64 || btoa(String.fromCharCode(...salt));
  return { hash, salt: usedSalt };
}

export async function verifyPassword(candidate, env) {
  await ensureAuthTables(env);
  const row = await env.DB.prepare("SELECT salt, hash FROM admin_auth WHERE id = 'default'").first();
  if (!row) return candidate === env.ADMIN_PASSWORD; // bootstrap: haven't changed it yet
  const { hash } = await hashPassword(candidate, row.salt);
  return timingSafeEqual(hash, row.hash);
}

export async function setPassword(newPassword, env) {
  await ensureAuthTables(env);
  const { hash, salt } = await hashPassword(newPassword);
  await env.DB.prepare(
    `INSERT INTO admin_auth (id, salt, hash, updated_at) VALUES ('default', ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET salt = excluded.salt, hash = excluded.hash, updated_at = excluded.updated_at`
  ).bind(salt, hash).run();
}

// Records who (IP) did what security-relevant action and when. Best-effort —
// a logging failure must never block the actual admin action.
export async function logAdminAction(context, action) {
  try {
    const { request, env } = context;
    await ensureAuthTables(env);
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
    await env.DB.prepare(
      "INSERT INTO admin_audit_log (created_at, ip, action) VALUES (datetime('now'), ?, ?)"
    ).bind(ip, action).run();
    await env.DB.prepare(
      "DELETE FROM admin_audit_log WHERE id NOT IN (SELECT id FROM admin_audit_log ORDER BY id DESC LIMIT 500)"
    ).run();
  } catch {
    // ignore
  }
}

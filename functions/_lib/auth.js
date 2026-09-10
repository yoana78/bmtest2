// Shared admin-session verification for every protected API route.
// The session cookie is `<timestamp>.<hmac-signature>`, signed with
// ADMIN_PASSWORD so no separate secret needs to be provisioned.

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
  // Sessions are valid for 24 hours.
  const age = Date.now() - Number(payload);
  if (!Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000) return false;
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

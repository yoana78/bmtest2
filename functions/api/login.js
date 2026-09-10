import { sign } from "../_lib/auth.js";

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD) {
    return new Response("ADMIN_PASSWORD is not configured", { status: 500 });
  }
  const { password } = await request.json().catch(() => ({}));
  if (password !== env.ADMIN_PASSWORD) {
    return new Response("Invalid password", { status: 401 });
  }
  const payload = String(Date.now());
  const sig = await sign(payload, env.ADMIN_PASSWORD);
  const token = `${payload}.${sig}`;
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
    },
  });
}

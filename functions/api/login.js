import { sign, verifyPassword, logAdminAction, SESSION_MAX_AGE_MS } from "../_lib/auth.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.ADMIN_PASSWORD) {
    return new Response("ADMIN_PASSWORD is not configured", { status: 500 });
  }
  const { password } = await request.json().catch(() => ({}));
  const ok = await verifyPassword(password, env);
  if (!ok) {
    await logAdminAction(context, "login_fail");
    return new Response("Invalid password", { status: 401 });
  }
  await logAdminAction(context, "login_success");
  const payload = String(Date.now());
  const sig = await sign(payload, env.ADMIN_PASSWORD);
  const token = `${payload}.${sig}`;
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": `admin_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`,
    },
  });
}

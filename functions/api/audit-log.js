import { isAuthed } from "../_lib/auth.js";

// GET /api/audit-log — login/password-change history with IP addresses (admin only).
export async function onRequestGet({ request, env }) {
  if (!(await isAuthed(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const table = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'admin_audit_log'"
  ).first();
  if (!table) return Response.json({ logs: [] }, { headers: { "Cache-Control": "no-store" } });

  const { results } = await env.DB.prepare(
    "SELECT created_at, ip, action FROM admin_audit_log ORDER BY id DESC LIMIT 100"
  ).all();
  return Response.json({ logs: results || [] }, { headers: { "Cache-Control": "no-store" } });
}

import { isAuthed } from "../../_lib/auth.js";

export async function onRequestGet({ params, env }) {
  if (!env.DB) return new Response("Not configured", { status: 500 });
  const row = await env.DB.prepare('SELECT content_type, data FROM assets WHERE id = ?').bind(params.id).first();
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(row.data, {
    headers: {
      "Content-Type": row.content_type || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function onRequestDelete({ request, params, env }) {
  if (!(await isAuthed(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.DB) return new Response("Not configured", { status: 500 });
  await env.DB.prepare('DELETE FROM assets WHERE id = ?').bind(params.id).run();
  return Response.json({ ok: true });
}

import { isAuthed } from "./auth.js";

// Shared GET/PUT handlers for a D1-backed content document. GET is public
// (every visitor reads the same JSON, falling back to the build-time default
// if nothing has been saved yet); PUT requires an admin session and writes
// straight through to D1 so the change is live for everyone.
export function makeContentApi(contentKey, defaultContent) {
  async function onRequestGet({ env }) {
    let content = defaultContent;
    if (env.DB) {
      const row = await env.DB.prepare('SELECT data FROM content WHERE key = ?').bind(contentKey).first();
      if (row) content = JSON.parse(row.data);
    }
    return Response.json(content, { headers: { "Cache-Control": "no-store" } });
  }

  async function onRequestPut({ request, env }) {
    if (!(await isAuthed(request, env))) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!env.DB) {
      return new Response("DB binding is not configured", { status: 500 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    await env.DB.prepare(
      "INSERT INTO content (key, data, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at"
    ).bind(contentKey, JSON.stringify(body)).run();
    return Response.json({ ok: true });
  }

  return { onRequestGet, onRequestPut };
}

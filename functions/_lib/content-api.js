import { isAuthed } from "./auth.js";

// Shared GET/PUT handlers for a KV-backed content document. GET is public
// (every visitor reads the same JSON); PUT requires an admin session and
// writes straight through to KV so the change is live for everyone.
export function makeContentApi(kvKey, defaultContent) {
  async function onRequestGet({ env }) {
    let content = defaultContent;
    if (env.CONTENT_KV) {
      const stored = await env.CONTENT_KV.get(kvKey, "json");
      if (stored) content = stored;
    }
    return Response.json(content, { headers: { "Cache-Control": "no-store" } });
  }

  async function onRequestPut({ request, env }) {
    if (!(await isAuthed(request, env))) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (!env.CONTENT_KV) {
      return new Response("CONTENT_KV binding is not configured", { status: 500 });
    }
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }
    await env.CONTENT_KV.put(kvKey, JSON.stringify(body));
    return Response.json({ ok: true });
  }

  return { onRequestGet, onRequestPut };
}

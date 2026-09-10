import { isAuthed } from "../../_lib/auth.js";

export async function onRequestGet({ params, env }) {
  if (!env.CONTENT_KV) return new Response("Not configured", { status: 500 });
  const key = `asset:${params.id}`;
  const stored = await env.CONTENT_KV.getWithMetadata(key, "arrayBuffer");
  if (!stored || !stored.value) return new Response("Not found", { status: 404 });
  const contentType = stored.metadata?.contentType || "application/octet-stream";
  return new Response(stored.value, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function onRequestDelete({ request, params, env }) {
  if (!(await isAuthed(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.CONTENT_KV) return new Response("Not configured", { status: 500 });
  await env.CONTENT_KV.delete(`asset:${params.id}`);
  return Response.json({ ok: true });
}

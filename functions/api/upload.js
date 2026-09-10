import { isAuthed } from "../_lib/auth.js";

// Admin image uploads. Images are stored as BLOBs in D1 (no R2 bucket
// needed for this site's scale) and served back out through
// /api/asset/:id with the right content-type.
const MAX_BYTES = 5 * 1024 * 1024; // 5MB per image is plenty for web use

export async function onRequestPost({ request, env }) {
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

  const { filename, dataBase64, contentType } = body;
  if (!dataBase64 || !contentType || !contentType.startsWith("image/")) {
    return new Response("Expected { filename, dataBase64, contentType: image/* }", { status: 400 });
  }

  let bytes;
  try {
    const binary = atob(dataBase64);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    return new Response("Invalid base64 data", { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return new Response("Image too large (max 5MB)", { status: 413 });
  }

  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO assets (id, content_type, filename, data) VALUES (?, ?, ?, ?)')
    .bind(id, contentType, filename || id, bytes)
    .run();

  return Response.json({ id, url: `/api/asset/${id}` });
}

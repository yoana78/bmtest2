import { isAuthed } from "../_lib/auth.js";

const KV_KEY = "contact-submissions";
const MAX_STORED = 300;

export async function onRequestPost({ request, env }) {
  if (!env.CONTENT_KV) {
    return new Response("CONTENT_KV binding is not configured", { status: 500 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const company = String(body.company || "").trim().slice(0, 200);
  const name = String(body.name || "").trim().slice(0, 100);
  const phone = String(body.phone || "").trim().slice(0, 50);
  const email = String(body.email || "").trim().slice(0, 200);
  const message = String(body.message || "").trim().slice(0, 3000);
  // Honeypot field: real visitors never fill this hidden input.
  const honeypot = String(body.website || "").trim();

  if (honeypot) {
    // Silently accept to not tip off bots, but don't store anything.
    return Response.json({ ok: true });
  }
  if (!company || !name || !phone || !message) {
    return new Response("Missing required fields", { status: 400 });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response("Invalid email", { status: 400 });
  }

  const existing = (await env.CONTENT_KV.get(KV_KEY, "json")) || [];
  existing.unshift({
    id: crypto.randomUUID(),
    company,
    name,
    phone,
    email,
    message,
    submittedAt: new Date().toISOString(),
    read: false,
  });
  await env.CONTENT_KV.put(KV_KEY, JSON.stringify(existing.slice(0, MAX_STORED)));

  return Response.json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  if (!(await isAuthed(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const list = env.CONTENT_KV ? (await env.CONTENT_KV.get(KV_KEY, "json")) || [] : [];
  return Response.json(list, { headers: { "Cache-Control": "no-store" } });
}

export async function onRequestPut({ request, env }) {
  // Admin marks a submission read/unread, or deletes one, by id.
  if (!(await isAuthed(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.CONTENT_KV) {
    return new Response("CONTENT_KV binding is not configured", { status: 500 });
  }
  const { id, action } = await request.json().catch(() => ({}));
  if (!id || !["markRead", "markUnread", "delete"].includes(action)) {
    return new Response("Invalid request", { status: 400 });
  }
  let list = (await env.CONTENT_KV.get(KV_KEY, "json")) || [];
  if (action === "delete") {
    list = list.filter((item) => item.id !== id);
  } else {
    list = list.map((item) => (item.id === id ? { ...item, read: action === "markRead" } : item));
  }
  await env.CONTENT_KV.put(KV_KEY, JSON.stringify(list));
  return Response.json({ ok: true });
}

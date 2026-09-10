import { isAuthed } from "../_lib/auth.js";

const MAX_STORED = 300;

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return new Response("DB binding is not configured", { status: 500 });
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

  await env.DB.prepare(
    'INSERT INTO contacts (id, company, name, phone, email, message, submitted_at, read) VALUES (?, ?, ?, ?, ?, ?, ?, 0)'
  ).bind(crypto.randomUUID(), company, name, phone, email, message, new Date().toISOString()).run();

  // Keep the table from growing unbounded — drop anything past the newest MAX_STORED.
  await env.DB.prepare(
    `DELETE FROM contacts WHERE id NOT IN (SELECT id FROM contacts ORDER BY submitted_at DESC LIMIT ?)`
  ).bind(MAX_STORED).run();

  return Response.json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  if (!(await isAuthed(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.DB) return Response.json([], { headers: { "Cache-Control": "no-store" } });
  const { results } = await env.DB.prepare('SELECT * FROM contacts ORDER BY submitted_at DESC').all();
  const items = results.map((row) => ({ ...row, read: !!row.read }));
  return Response.json(items, { headers: { "Cache-Control": "no-store" } });
}

export async function onRequestPut({ request, env }) {
  // Admin marks a submission read/unread, or deletes one, by id.
  if (!(await isAuthed(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.DB) {
    return new Response("DB binding is not configured", { status: 500 });
  }
  const { id, action } = await request.json().catch(() => ({}));
  if (!id || !["markRead", "markUnread", "delete"].includes(action)) {
    return new Response("Invalid request", { status: 400 });
  }
  if (action === "delete") {
    await env.DB.prepare('DELETE FROM contacts WHERE id = ?').bind(id).run();
  } else {
    await env.DB.prepare('UPDATE contacts SET read = ? WHERE id = ?').bind(action === "markRead" ? 1 : 0, id).run();
  }
  return Response.json({ ok: true });
}

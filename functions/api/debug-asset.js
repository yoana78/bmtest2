export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get("id");
  const row = await env.DB.prepare('SELECT content_type, data FROM assets WHERE id = ?').bind(id).first();
  if (!row) return Response.json({ error: "not found" });
  const info = {
    dataType: Object.prototype.toString.call(row.data),
    isArrayBuffer: row.data instanceof ArrayBuffer,
    constructorName: row.data?.constructor?.name,
    length: row.data?.byteLength ?? row.data?.length,
  };
  return Response.json(info);
}

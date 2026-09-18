import { isAuthed } from "../_lib/auth.js";

// 업로드된 이미지는 assets 테이블에 저장되고, 그 주소(/api/asset/<id>)가
// content 테이블의 각 문서 JSON 안에 문자열로 들어간다. 브랜드나 제품을 지우면
// 문서에서 주소만 빠지고 이미지 자체는 남아 용량만 차지하므로, 지워진 레코드가
// 쓰던 id를 받아 "이제 아무 문서에서도 안 쓰는" 것만 정리한다.
//
// POST /api/assets-cleanup  { ids: ["<uuid>", ...] }  (관리자 전용)
export async function onRequestPost({ request, env }) {
  if (!(await isAuthed(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!env.DB) return new Response("DB binding is not configured", { status: 500 });

  let ids;
  try {
    ({ ids } = await request.json());
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(ids)) return Response.json({ error: "ids must be an array" }, { status: 400 });

  const valid = ids.filter(id => typeof id === "string" && /^[0-9a-fA-F-]{36}$/.test(id));
  let removed = 0;
  for (const id of valid) {
    const row = await env.DB.prepare(
      'SELECT COUNT(*) AS refs FROM content WHERE data LIKE ?1'
    ).bind(`%/api/asset/${id}%`).first();
    if (row && Number(row.refs) === 0) {
      await env.DB.prepare('DELETE FROM assets WHERE id = ?').bind(id).run();
      removed++;
    }
  }
  return Response.json({ ok: true, removed });
}

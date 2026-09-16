import { isAuthed, verifyPassword, setPassword, logAdminAction } from "../_lib/auth.js";

// POST /api/change-password — change the admin password (admin only, current password required).
export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await isAuthed(request, env))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json().catch(() => ({}));
  if (!currentPassword || !newPassword || String(newPassword).length < 4) {
    return Response.json({ error: "입력값을 확인해주세요 (새 비밀번호는 4자 이상)" }, { status: 400 });
  }

  const ok = await verifyPassword(currentPassword, env);
  if (!ok) {
    return Response.json({ error: "현재 비밀번호가 일치하지 않습니다." }, { status: 401 });
  }

  await setPassword(String(newPassword), env);
  await logAdminAction(context, "password_change");

  return Response.json({ ok: true });
}

// 세션 읽기·만들기·지우기와 권한 확인 (Data Access Layer)
// Design Ref: §7 — proxy.ts로 1차 차단 + 화면·API마다 여기서 다시 확인 (PRD 7장 "서버에서 한 번 더 확인")
import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_SECONDS, sealSession, unsealSession, type Role, type SessionData } from "./seal";

export type { Role, SessionData };

export async function createSession(role: Role): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await sealSession({ role }), {
    httpOnly: true, // 브라우저 스크립트에서 읽을 수 없게
    secure: Boolean(process.env.VERCEL), // 배포본(https)에서만 secure (로컬 http에서도 로그인되도록)
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** 현재 세션 (없으면 null). cookies()를 읽으므로 화면에서는 <Suspense> 안에서 부른다. */
export async function getSession(): Promise<SessionData | null> {
  const cookieValue = (await cookies()).get(SESSION_COOKIE)?.value;
  // 쿠키 만료 확인에 현재 시각(Date.now)을 쓰므로, 미리 그려 두지 말고 요청 때 계산하도록 표시한다
  await connection();
  return unsealSession(cookieValue);
}

/** 화면용: 로그인하지 않았으면 /login으로 보낸다 */
export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** 화면용: 역할이 다르면 첫 화면으로 보낸다 (예: 경영진이 /upload 접근) */
export async function requireRole(role: Role): Promise<SessionData> {
  const session = await requireSession();
  if (session.role !== role) redirect("/");
  return session;
}

/** API용: 화면 이동 대신 오류 응답을 돌려준다 */
export async function checkApiAccess(role?: Role): Promise<
  { ok: true; session: SessionData } | { ok: false; response: Response }
> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: apiError(401, "UNAUTHORIZED", "로그인이 필요합니다.") };
  }
  if (role && session.role !== role) {
    return { ok: false, response: apiError(403, "FORBIDDEN", "담당자만 할 수 있는 작업입니다.") };
  }
  return { ok: true, session };
}

/** Design Ref: §6.2 — 오류 응답 형식 */
export function apiError(status: number, code: string, message: string, details: object = {}): Response {
  return Response.json({ error: { code, message, details } }, { status });
}

// 접근 막기 (PLAN 작업 14, PRD 7장) — Next.js 16에서는 middleware 대신 proxy를 쓴다
// 로그인하지 않은 사용자는 모든 화면에서 /login으로, API는 401로 막는다.
// 여기서는 쿠키만 확인하는 1차 차단이고, 화면·API마다 lib/auth/session.ts에서 다시 확인한다.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, unsealSession } from "@/lib/auth/seal";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await unsealSession(request.cookies.get(SESSION_COOKIE)?.value);
  const isLoginPage = pathname === "/login";

  if (!session) {
    if (isLoginPage) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "로그인이 필요합니다.", details: {} } },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  // 이미 로그인했으면 로그인 화면 대신 첫 화면으로
  if (isLoginPage) return NextResponse.redirect(new URL("/", request.nextUrl));
  return NextResponse.next();
}

export const config = {
  // 정적 파일(빌드 결과물·이미지·아이콘)과 robots.txt(검색엔진 차단 안내)는 검사하지 않는다
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|svg|jpg|jpeg|ico)$).*)"],
};

// 공통 헤더: 로고·서비스 이름·역할·로그아웃 (+담당자에게만 파일 관리)
// 세션을 읽으므로 <Suspense> 안에서 쓴다 (Cache Components 규칙)
import Image from "next/image";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import { APP_NAME, APP_SUBTITLE } from "@/lib/app-info";
import { ROLE_LABEL } from "@/lib/auth/seal";
import { requireSession } from "@/lib/auth/session";

export async function AppHeader() {
  const session = await requireSession();

  return (
    // 한양대 로고 네이비 헤더 — 글씨는 흰색
    <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-navy px-4 py-3 text-white">
      <Link href="/" className="flex items-center gap-2">
        {/* 네이비 바탕에서도 로고가 보이도록 흰 원 위에 올린다 */}
        <span className="rounded-full bg-white p-0.5">
          <Image src="/hanyang-logo.png" alt="한양대학교 로고" width={36} height={36} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-lg font-semibold">{APP_NAME}</span>
          <span className="text-xs font-medium text-navy-mist">{APP_SUBTITLE}</span>
        </span>
      </Link>
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-full bg-white/15 px-3 py-1">{ROLE_LABEL[session.role]}</span>
        {session.role === "manager" && (
          <Link href="/upload" className="rounded-md border border-white/40 px-3 py-1 hover:bg-white/10">
            파일 관리
          </Link>
        )}
        <form action={logout}>
          <button type="submit" className="rounded-md px-3 py-1 text-white/80 hover:bg-white/10 hover:text-white">
            로그아웃
          </button>
        </form>
      </div>
    </header>
  );
}

export function AppHeaderFallback() {
  return <div className="h-[73px] bg-navy" aria-hidden />;
}

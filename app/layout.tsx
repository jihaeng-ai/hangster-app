import type { Metadata } from "next";
import { APP_NAME, APP_SUBTITLE } from "@/lib/app-info";
import "./globals.css";

// 서비스 기본 정보 (브라우저 탭 제목 등) — 화면별 제목은 "화면 이름 | 노무 현황 관리표"
export const metadata: Metadata = {
  title: { default: `${APP_NAME} — ${APP_SUBTITLE}`, template: `%s | ${APP_NAME}` },
  description: `${APP_SUBTITLE}: 노사협력팀 노무 현황과 리스크 신호를 한눈에 보는 관리표`,
  // 내부용 서비스 — 검색엔진에 등록하지 않는다 (보안 점검 SEC-05)
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

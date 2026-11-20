import { Suspense } from "react";
import { AppHeader, AppHeaderFallback } from "@/components/AppHeader";

// 로그인 후 화면 공통 틀: 네이비 헤더 + 같은 네이비 바탕 (네모칸들은 흰색으로 그대로)
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-navy dark:bg-zinc-950">
      <Suspense fallback={<AppHeaderFallback />}>
        <AppHeader />
      </Suspense>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">{children}</main>
    </div>
  );
}

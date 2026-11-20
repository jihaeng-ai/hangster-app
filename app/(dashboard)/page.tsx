import Image from "next/image";
import { Suspense } from "react";
import { AskBox } from "@/components/AskBox";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { requireSession } from "@/lib/auth/session";
import { MAX_SUMMARY_CARDS } from "@/lib/metrics/definitions";
import { getDashboardData } from "@/lib/metrics/series";

// 첫 화면: 핵심 지표 숫자 카드 (PLAN 작업 19, 22)
export default function HomePage() {
  return (
    <div className="relative flex flex-col gap-6">
      {/* 넓은 화면의 양옆 빈 곳에 캐릭터 (2026-11-20 사용자 요청: 왼쪽 의사 사자, 오른쪽 크리스마스 사자, 흰 바탕은 투명하게 처리한 그림)
          내용을 가리지 않도록 양옆 여백이 충분한 1440px 이상 화면에서만 보인다. 꾸밈용이라 화면 읽기 프로그램에는 숨긴다 */}
      <Image
        src="/character-doctor.png"
        alt=""
        aria-hidden
        width={246}
        height={257}
        priority
        className="pointer-events-none absolute top-1/2 right-full mr-6 hidden h-auto w-44 -translate-y-1/2 select-none min-[1440px]:block min-[1700px]:w-56"
      />
      <Image
        src="/character-christmas.png"
        alt=""
        aria-hidden
        width={241}
        height={278}
        priority
        className="pointer-events-none absolute top-1/2 left-full ml-6 hidden h-auto w-44 -translate-y-1/2 select-none min-[1440px]:block min-[1700px]:w-56"
      />
      {/* 제목과 질문창을 하나의 네모로 */}
      <AskBox>
        <div>
          <h1 className="text-2xl font-semibold text-navy dark:text-white">노무 현황 요약</h1>
          <p className="mt-1 text-sm text-zinc-500">카드를 누르면 차트와 변화 설명을 볼 수 있습니다. 궁금한 것은 아래에 물어보세요.</p>
        </div>
      </AskBox>
      <Suspense fallback={<CardsFallback />}>
        <SummaryCards />
      </Suspense>
    </div>
  );
}

async function SummaryCards() {
  // 화면마다 로그인을 다시 확인한다 (proxy와 별개, PRD 7장)
  const session = await requireSession();
  const data = await getDashboardData();

  if (data.isEmpty) return <EmptyState role={session.role} />;

  return (
    <section aria-label="핵심 지표" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.series.slice(0, MAX_SUMMARY_CARDS).map((s) => (
        <MetricCard key={s.metric.id} series={s} />
      ))}
    </section>
  );
}

function CardsFallback() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  );
}

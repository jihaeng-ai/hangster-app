import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChangeSummary } from "@/components/ChangeSummary";
import { MetricChart } from "@/components/charts/MetricChart";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { OfficerOrgChart } from "@/components/OfficerOrgChart";
import { SourceNote } from "@/components/SourceNote";
import { requireSession } from "@/lib/auth/session";
import type { MetricId } from "@/lib/data/types";
import { METRICS } from "@/lib/metrics/definitions";
import { getDashboardData } from "@/lib/metrics/series";

// 지표 상세 화면 (PLAN 작업 20, 21) — 차트 + 출처 + 변화 설명 (+ 전임자 명단)
export function generateStaticParams() {
  return METRICS.map((m) => ({ metricId: m.id }));
}

export default function MetricPage({ params }: PageProps<"/metrics/[metricId]">) {
  return (
    <>
      <Link href="/" className="w-fit text-sm text-navy-mist hover:text-white hover:underline">
        ← 첫 화면으로
      </Link>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" aria-hidden />}>
        <MetricDetail params={params} />
      </Suspense>
    </>
  );
}

async function MetricDetail({ params }: { params: Promise<{ metricId: string }> }) {
  const { metricId } = await params;
  const metric = METRICS.find((m) => m.id === metricId);
  if (!metric) notFound();

  const session = await requireSession();
  const data = await getDashboardData();
  const series = data.series.find((s) => s.metric.id === (metricId as MetricId));
  if (!series) notFound();

  const hasData = series.totals.length > 0;

  return (
    <article className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold text-white">{series.metric.label}</h1>

      {hasData && metric.id === "union-officers" ? (
        // 전임간부 현황: 차트 대신 연도 → 기간별 조직도 (2026-11-19 사용자 요청)
        // 변화 설명 칸은 두지 않는다 (2026-11-20 사용자 요청)
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <OfficerOrgChart officers={data.officers} />
          <div className="mt-4">
            <SourceNote sources={series.sources} />
          </div>
        </div>
      ) : hasData && series.sections ? (
        // 투표율: 임단협 찬반투표 / 임원(지부장) 선거를 구역 2개로 나눠 각각 차트·출처·표·변화 설명 (2026-11-20 사용자 요청)
        series.sections.map((sec) => (
          <section key={sec.name} className="flex flex-col gap-3" aria-labelledby={`sec-${sec.name}`}>
            <h2 id={`sec-${sec.name}`} className="text-lg font-semibold text-white">{sec.name}</h2>
            {sec.totals.length > 0 ? (
              <>
                <div className="rounded-xl border border-zinc-200 bg-[var(--viz-surface)] p-4 dark:border-zinc-800">
                  <MetricChart chart={series.metric.chart} unit={series.metric.unit} rows={sec.rows} categories={[]} label={`${sec.name} 투표율`} />
                  <div className="mt-3 flex flex-col gap-3">
                    <SourceNote sources={sec.sources} />
                    <DataTable rows={sec.rows} categories={[]} unit={series.metric.unit} />
                  </div>
                </div>
                <ChangeSummary sentences={sec.description} />
              </>
            ) : (
              <p className="rounded-xl bg-white p-5 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">이 구분은 아직 올라온 데이터가 없습니다. 담당자에게 문의하세요</p>
            )}
          </section>
        ))
      ) : hasData ? (
        <>
          <div className="rounded-xl border border-zinc-200 bg-[var(--viz-surface)] p-4 dark:border-zinc-800">
            <MetricChart
              chart={series.metric.chart}
              unit={series.metric.unit}
              rows={series.rows}
              categories={series.categories}
              label={series.metric.label}
            />
            <div className="mt-3 flex flex-col gap-3">
              <SourceNote sources={series.sources} />
              <DataTable rows={series.rows} categories={series.categories} unit={series.metric.unit} />
            </div>
          </div>
          <ChangeSummary sentences={series.description} />
        </>
      ) : (
        <EmptyState role={session.role} message={data.isEmpty ? undefined : "이 지표는 아직 올라온 데이터가 없습니다. 담당자에게 문의하세요"} />
      )}
    </article>
  );
}

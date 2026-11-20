import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChangeSummary } from "@/components/ChangeSummary";
import { MetricChart } from "@/components/charts/MetricChart";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { OfficerOrgChart } from "@/components/OfficerOrgChart";
import { SourceNote } from "@/components/SourceNote";
import { MembershipBoard, type MembershipPeriod } from "@/components/MembershipBoard";
import { VehicleBusBoard } from "@/components/VehicleBusBoard";
import { VoteSections } from "@/components/VoteSections";
import { requireSession } from "@/lib/auth/session";
import type { MetricId } from "@/lib/data/types";
import { METRICS } from "@/lib/metrics/definitions";
import { describeChange } from "@/lib/metrics/describe";
import { getDashboardData, type MetricSeries } from "@/lib/metrics/series";

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
      ) : hasData && metric.id === "workforce" ? (
        // 조합원 현황: 연도 → 월 → 의료원(서울+구리) 아래 두 병원, 그리고 연도별 비교 차트 (2026-11-20 사용자 요청)
        <>
          <MembershipBoard periods={membershipPeriods(series)} unit={series.metric.unit} />
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <SourceNote sources={series.sources} />
            <DataTable rows={series.rows} categories={series.categories} unit={series.metric.unit} />
          </div>
          <ChangeSummary sentences={series.description} />
        </>
      ) : metric.id === "union-vehicles" && (hasData || data.vehicles.length > 0) ? (
        // 차량 지원: 차트 대신 연도 → 버스 픽토그램 + 지원일시·장소 (2026-11-20 사용자 요청)
        <>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <VehicleBusBoard counts={series.totals} trips={data.vehicles} unit={series.metric.unit} />
            <div className="mt-4">
              <SourceNote sources={[...series.sources, ...data.vehicleSources]} />
            </div>
          </div>
          <ChangeSummary sentences={series.description} />
        </>
      ) : hasData && series.sections ? (
        // 투표율: 네모 칸 2개(임단협 찬반투표 / 임원(지부장) 선거) → 칸을 누르면 연도 버튼 → 그해 투표율 (2026-11-20 사용자 요청)
        <VoteSections sections={series.sections} unit={series.metric.unit} chart={series.metric.chart} />
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

/** 조합원 현황 화면용: 기간마다 의료원 합계 · 병원별 값 · 직전 달 대비 문장 (문장은 서버가 문장 틀로 만든다) */
function membershipPeriods(series: MetricSeries): MembershipPeriod[] {
  return series.rows.map((row, i) => ({
    period: row.period,
    total: typeof row.value === "number" ? row.value : null,
    hospitals: series.categories.map((name) => ({ name, value: typeof row[name] === "number" ? (row[name] as number) : null })),
    sentence:
      describeChange("의료원 조합원", series.metric.unit, series.metric.periodUnit, series.totals.slice(0, i + 1))[0] ?? "",
  }));
}

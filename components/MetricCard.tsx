// 첫 화면 숫자 카드 — 누르면 지표 상세 화면으로 (버튼 1번, PRD Must1-3)
// 숫자 카드도 차트 형태의 하나이므로 기준 날짜·출처 파일·PDF 쪽 번호를 함께 보여준다 (PRD Must1-5, 10)
import Link from "next/link";
import { formatPeriod, formatWithUnit } from "@/lib/metrics/format";
import type { MetricSeries } from "@/lib/metrics/series";

export function MetricCard({ series }: { series: MetricSeries }) {
  const { metric, latest, sources } = series;
  const pdfPages = [...new Set(sources.filter((s) => s.kind === "pdf").flatMap((s) => s.pages))].sort((a, b) => a - b);
  const baseDates = [...new Set(sources.map((s) => s.baseDate))];
  const fileNames = [...new Set(sources.map((s) => s.fileName))];

  return (
    <Link
      href={`/metrics/${metric.id}`}
      prefetch={true}
      className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-5 transition border-t-4 border-t-navy hover:border-navy hover:shadow-md dark:border-zinc-800 dark:border-t-navy-mist dark:bg-zinc-900 dark:hover:border-navy-mist"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
        {metric.label}
        {pdfPages.length > 0 && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
            PDF 추출 · p.{pdfPages.join(", ")}
          </span>
        )}
      </span>
      <span className="text-3xl font-semibold tabular-nums">{latest ? formatWithUnit(latest.value, metric.unit) : "데이터 없음"}</span>
      {latest && <span className="text-xs text-zinc-500">{formatPeriod(latest.period)} 기준</span>}
      {sources.length > 0 && (
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          기준일 {baseDates.join(", ")} · 출처 {fileNames.join(", ")}
        </span>
      )}
    </Link>
  );
}

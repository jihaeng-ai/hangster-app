// 첫 화면 숫자 카드 — 누르면 지표 상세 화면으로 (버튼 1번, PRD Must1-3)
// 카드 아래에는 기준일과 PDF 쪽 번호만 보여준다 — 출처 파일 이름은 빼기로 함 (2026-11-20 사용자 요청, 상세 화면에는 남아 있음)
import Link from "next/link";
import { formatPeriod, formatWithUnit } from "@/lib/metrics/format";
import type { MetricSeries } from "@/lib/metrics/series";

export function MetricCard({ series }: { series: MetricSeries }) {
  const { metric, latest, sources, sections } = series;
  const pdfPages = [...new Set(sources.filter((s) => s.kind === "pdf").flatMap((s) => s.pages))].sort((a, b) => a - b);
  const baseDates = [...new Set(sources.map((s) => s.baseDate))];

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
      {sections ? (
        // 갈래가 있는 지표(투표율): 갈래마다 가장 최근 값 한 줄씩 (2026-11-20)
        <span className="flex flex-col gap-1.5">
          {sections.map((s) => (
            <span key={s.name} className="flex items-baseline justify-between gap-3">
              <span className="text-xs text-zinc-500">
                {s.name}
                {s.latest && <> · {formatPeriod(s.latest.period)}</>}
              </span>
              <span className="text-xl font-semibold tabular-nums">{s.latest ? formatWithUnit(s.latest.value, metric.unit) : "데이터 없음"}</span>
            </span>
          ))}
        </span>
      ) : (
        <>
          <span className="text-3xl font-semibold tabular-nums">{latest ? formatWithUnit(latest.value, metric.unit) : "데이터 없음"}</span>
          {latest && <span className="text-xs text-zinc-500">{formatPeriod(latest.period)} 기준</span>}
        </>
      )}
      {sources.length > 0 && (
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          기준일 {baseDates.join(", ")}
        </span>
      )}
    </Link>
  );
}

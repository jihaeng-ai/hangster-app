"use client";
// 노동조합 투표율 상세 (2026-11-20 사용자 요청)
// 1) 네모 칸 2개: 임단협 찬반투표 / 임원(지부장) 선거  2) 칸을 누르면 연도 버튼  3) 연도를 누르면 그해 투표율
// 전임간부 현황(OfficerOrgChart)과 같은 버튼 모양을 쓴다. 숫자·문장은 모두 서버가 만든 값을 그대로 보여준다.
import { useState } from "react";
import { formatPeriod, formatWithUnit } from "@/lib/metrics/format";
import type { ChartType } from "@/lib/metrics/definitions";
import type { SectionSeries } from "@/lib/metrics/series";
import { ChangeSummary } from "./ChangeSummary";
import { MetricChart } from "./charts/MetricChart";
import { DataTable } from "./DataTable";
import { SourceNote } from "./SourceNote";

const pill = (selected: boolean) =>
  `rounded-full border px-4 py-1.5 text-sm font-medium transition ${
    selected
      ? "border-navy bg-navy text-white"
      : "border-zinc-300 bg-white text-zinc-700 hover:border-navy hover:text-navy dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
  }`;

export function VoteSections({ sections, unit, chart }: { sections: SectionSeries[]; unit: string; chart: ChartType }) {
  const [name, setName] = useState<string | null>(null);
  const [period, setPeriod] = useState<string | null>(null);

  const current = sections.find((s) => s.name === name) ?? null;
  const chosen = current?.byPeriod.find((p) => p.period === period) ?? current?.byPeriod.at(-1) ?? null;

  const choose = (sec: SectionSeries) => {
    setName(sec.name);
    setPeriod(sec.byPeriod.at(-1)?.period ?? null); // 가장 최근 연도를 먼저 보여준다
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1단계: 네모 칸 2개 */}
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((sec) => {
          const selected = sec.name === name;
          const baseDates = [...new Set(sec.sources.map((s) => s.baseDate))];
          return (
            <button
              key={sec.name}
              type="button"
              aria-pressed={selected}
              onClick={() => choose(sec)}
              className={`flex flex-col gap-2 rounded-xl border border-t-4 bg-white p-5 text-left transition hover:shadow-md dark:bg-zinc-900 ${
                selected
                  ? "border-navy border-t-navy ring-2 ring-navy-mist"
                  : "border-zinc-200 border-t-navy hover:border-navy dark:border-zinc-800 dark:border-t-navy-mist"
              }`}
            >
              <span className="text-sm font-medium text-zinc-600 dark:text-zinc-300">{sec.name}</span>
              <span className="text-3xl font-semibold tabular-nums" title={sec.latest ? formatPeriod(sec.latest.period) : undefined}>
                {sec.latest ? formatWithUnit(sec.latest.value, unit) : "데이터 없음"}
              </span>
              {baseDates.length > 0 && <span className="text-xs text-zinc-400 dark:text-zinc-500">기준일 {baseDates.join(", ")}</span>}
            </button>
          );
        })}
      </div>

      {!current ? (
        <p className="text-sm text-navy-mist">위 네모 칸을 누르면 연도별 투표율을 볼 수 있습니다.</p>
      ) : current.byPeriod.length === 0 ? (
        <p className="rounded-xl bg-white p-5 text-sm text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          이 구분은 아직 올라온 데이터가 없습니다. 담당자에게 문의하세요
        </p>
      ) : (
        <section aria-label={`${current.name} 연도별 투표율`} className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold">{current.name}</h2>

          {/* 2단계: 연도 */}
          <div role="tablist" aria-label="연도 선택" className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">연도</span>
            {current.byPeriod.map((p) => (
              <button key={p.period} type="button" role="tab" aria-selected={p.period === chosen?.period} onClick={() => setPeriod(p.period)} className={pill(p.period === chosen?.period)}>
                {formatPeriod(p.period)}
              </button>
            ))}
          </div>

          {/* 3단계: 그해 투표율 */}
          {chosen && (
            <div role="tabpanel" aria-label={`${formatPeriod(chosen.period)} ${current.name} 투표율`} className="flex flex-col gap-1 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">{formatPeriod(chosen.period)} {current.name} 투표율</span>
              <span className="text-4xl font-semibold tabular-nums text-navy dark:text-white">{formatWithUnit(chosen.value, unit)}</span>
              {chosen.sentence && <span className="text-sm text-zinc-600 dark:text-zinc-300">{chosen.sentence}</span>}
            </div>
          )}

          {/* 전체 흐름: 차트 · 출처 · 표 · 변화 설명 */}
          <div className="rounded-xl border border-zinc-200 bg-[var(--viz-surface)] p-4 dark:border-zinc-800">
            <MetricChart chart={chart} unit={unit} rows={current.rows} categories={[]} label={`${current.name} 투표율`} />
            <div className="mt-3 flex flex-col gap-3">
              <SourceNote sources={current.sources} />
              <DataTable rows={current.rows} categories={[]} unit={unit} />
            </div>
          </div>
          <ChangeSummary sentences={current.description} />
        </section>
      )}
    </div>
  );
}

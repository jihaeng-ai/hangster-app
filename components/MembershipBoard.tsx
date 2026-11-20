"use client";
// 노동조합 조합원 현황 (2026-11-20 사용자 요청, 자료: 연도별 조합원 현황.xlsx)
// 1) 기간별: 연도 버튼 → 월 버튼 → 의료원(서울+구리) 아래에 서울병원 · 구리병원 (의료원 산하 두 병원)
// 2) 연도별 비교 차트: 꺾은선, 해마다 점 하나(그해 마지막 달 값) (2026-11-20 사용자 요청으로 막대 → 꺾은선) (의료원 / 서울병원 / 구리병원 골라 보기)
// 숫자와 문장은 서버가 원본 값으로 만든 것을 그대로 보여준다.
import { useState } from "react";
import { formatPeriod, formatWithUnit } from "@/lib/metrics/format";
import type { ChartRow } from "@/lib/metrics/series";
import { MetricChart } from "./charts/MetricChart";

export interface MembershipPeriod {
  period: string; // "2024-02"
  total: number | null; // 의료원 = 병원 합 (원본 의료원 값과 같음을 읽을 때 확인)
  hospitals: { name: string; value: number | null }[];
  /** 직전 달 대비 문장 (서버가 문장 틀로 만듦) */
  sentence: string;
}

const TOTAL_LABEL = "의료원";

const pill = (selected: boolean) =>
  `rounded-full border px-4 py-1.5 text-sm font-medium transition ${
    selected
      ? "border-navy bg-navy text-white"
      : "border-zinc-300 bg-white text-zinc-700 hover:border-navy hover:text-navy dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
  }`;

export function MembershipBoard({ periods, unit }: { periods: MembershipPeriod[]; unit: string }) {
  const years = [...new Set(periods.map((p) => p.period.slice(0, 4)))].sort();
  const hospitalNames = [...new Set(periods.flatMap((p) => p.hospitals.map((h) => h.name)))];
  const [year, setYear] = useState(years.at(-1) ?? "");
  const [period, setPeriod] = useState(periods.at(-1)?.period ?? "");
  const [target, setTarget] = useState<string>(TOTAL_LABEL);

  if (periods.length === 0) return <p className="text-sm text-zinc-500">데이터 없음</p>;

  const inYear = periods.filter((p) => p.period.startsWith(year));
  const current = inYear.find((p) => p.period === period) ?? inYear.at(-1)!;
  const chooseYear = (y: string) => {
    setYear(y);
    setPeriod(periods.filter((p) => p.period.startsWith(y)).at(-1)?.period ?? ""); // 그해 마지막 달을 먼저
  };

  // 연도별 비교 차트 데이터: 해마다 값 하나 = 그해 마지막 달 값 (2026-11-20 사용자 요청: 월별은 빼고 연도로만)
  // 평균 등 새 숫자를 만들지 않고 원본 값을 쓴다. 어느 달 값인지 막대 이름에 적는다 (예: "2024년 (2월)")
  const valueOf = (p: MembershipPeriod) => (target === TOTAL_LABEL ? p.total : (p.hospitals.find((h) => h.name === target)?.value ?? null));
  const compareRows: ChartRow[] = years.map((y) => {
    const last = periods.filter((p) => p.period.startsWith(y)).at(-1)!;
    return { period: `${y}년 (${Number(last.period.slice(5))}월)`, value: valueOf(last) };
  });
  // 세로축 범위: 값 범위만 꽉 채우면 기울기가 지나치게 가팔라 보인다 (2026-11-20 사용자 요청)
  // 위아래로 "값 범위"와 "최댓값의 10%" 중 큰 만큼 여유를 두고 100 단위로 맞춘다 (예: 2,367~2,620명 → 2,100~2,900)
  const shown = compareRows.map((r) => r.value).filter((v): v is number => typeof v === "number");
  const yDomain: [number, number] | "auto" = shown.length > 0
    ? (() => {
        const min = Math.min(...shown);
        const max = Math.max(...shown);
        const pad = Math.max(max - min, max * 0.1);
        return [Math.max(0, Math.floor((min - pad) / 100) * 100), Math.ceil((max + pad) / 100) * 100];
      })()
    : "auto";

  return (
    <div className="flex flex-col gap-6">
      {/* 1) 기간별 */}
      <section aria-label="기간별 조합원 현황" className="flex flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">기간별 조합원 현황</h2>
        <div role="tablist" aria-label="연도 선택" className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">연도</span>
          {years.map((y) => (
            <button key={y} type="button" role="tab" aria-selected={y === year} onClick={() => chooseYear(y)} className={pill(y === year)}>
              {y}년
            </button>
          ))}
        </div>
        <div role="tablist" aria-label={`${year}년 월 선택`} className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
          <span className="mr-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">기간</span>
          {inYear.map((p) => (
            <button key={p.period} type="button" role="tab" aria-selected={p.period === current.period} onClick={() => setPeriod(p.period)} className={pill(p.period === current.period)}>
              {Number(p.period.slice(5))}월
            </button>
          ))}
        </div>

        {/* 의료원 → 산하 병원 */}
        <div role="tabpanel" aria-label={`${formatPeriod(current.period)} 조합원 현황`} className="flex flex-col items-center gap-0 pt-2">
          <div className="flex min-w-56 flex-col items-center rounded-xl border-2 border-navy bg-navy px-6 py-4 text-white">
            <span className="text-sm opacity-90">{formatPeriod(current.period)} · 의료원 (서울+구리)</span>
            <span className="text-3xl font-semibold tabular-nums">{formatWithUnit(current.total, unit)}</span>
          </div>
          <div className="h-5 w-0.5 bg-zinc-300 dark:bg-zinc-600" aria-hidden />
          <div className="relative flex w-full max-w-lg justify-center gap-6">
            {current.hospitals.length > 1 && <div className="absolute top-0 right-1/4 left-1/4 h-0.5 bg-zinc-300 dark:bg-zinc-600" aria-hidden />}
            {current.hospitals.map((h) => (
              <div key={h.name} className="flex flex-1 flex-col items-center">
                <div className="h-5 w-0.5 bg-zinc-300 dark:bg-zinc-600" aria-hidden />
                <div className="flex w-full flex-col items-center rounded-xl border border-navy/40 bg-navy-soft/40 px-4 py-3 dark:border-navy-mist/40 dark:bg-zinc-800">
                  <span className="text-sm text-zinc-600 dark:text-zinc-300">{h.name}</span>
                  <span className="text-2xl font-semibold tabular-nums">{formatWithUnit(h.value, unit)}</span>
                </div>
              </div>
            ))}
          </div>
          {current.sentence && <p className="mt-4 text-center text-sm text-zinc-600 dark:text-zinc-300">{current.sentence}</p>}
        </div>
      </section>

      {/* 2) 연도별 비교 차트 */}
      <section aria-label="연도별 비교 차트" className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">연도별 비교</h2>
        <div role="tablist" aria-label="비교할 곳 선택" className="flex flex-wrap items-center gap-2">
          {[TOTAL_LABEL, ...hospitalNames].map((name) => (
            <button key={name} type="button" role="tab" aria-selected={name === target} onClick={() => setTarget(name)} className={pill(name === target)}>
              {name === TOTAL_LABEL ? "의료원 (서울+구리)" : name}
            </button>
          ))}
        </div>
        <div className="rounded-xl border border-zinc-200 bg-[var(--viz-surface)] p-4 dark:border-zinc-800">
          <MetricChart chart="line" unit={unit} rows={compareRows} categories={[]} label={`${target === TOTAL_LABEL ? "의료원" : target} 조합원`} yDomain={yDomain} />
        </div>
        <p className="text-xs text-zinc-500">해마다 그해 마지막 달 값입니다 (괄호 안이 기준 달).</p>
      </section>
    </div>
  );
}

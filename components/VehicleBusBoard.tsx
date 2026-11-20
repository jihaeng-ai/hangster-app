"use client";
// 노동조합 차량 지원 현황 (2026-11-20 사용자 요청: 차트 대신 버스 픽토그램)
// 연도 버튼 → 그해 지원 한 건마다 버스 픽토그램 1개, 밑에 지원일시·장소
// 위쪽 "지원 대수"는 원본(PDF) 값 그대로, 버스는 차량 지원 내역(엑셀) 한 줄씩. 둘이 다르면 다르다고 알린다.
import { useState } from "react";
import { formatPeriod, formatWithUnit } from "@/lib/metrics/format";
import type { VehicleRow } from "@/lib/metrics/series";
import { BusIcon } from "./BusIcon";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** "2026-03-15" → "2026.03.15 (일)" */
function dateLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${date.replaceAll("-", ".")} (${WEEKDAY[new Date(y, m - 1, d).getDay()]})`;
}

const pill = (selected: boolean) =>
  `rounded-full border px-4 py-1.5 text-sm font-medium transition ${
    selected
      ? "border-navy bg-navy text-white"
      : "border-zinc-300 bg-white text-zinc-700 hover:border-navy hover:text-navy dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
  }`;

export function VehicleBusBoard({
  counts,
  trips,
  unit,
}: {
  counts: { period: string; value: number | null }[];
  trips: VehicleRow[];
  unit: string;
}) {
  const years = [...new Set([...counts.map((c) => c.period), ...trips.map((t) => t.year)])].sort();
  const [year, setYear] = useState(years.at(-1) ?? "");

  if (years.length === 0) return <p className="text-sm text-zinc-500">데이터 없음</p>;

  const count = counts.find((c) => c.period === year);
  const inYear = trips.filter((t) => t.year === year);
  const mismatch = count?.value != null && inYear.length > 0 && count.value !== inYear.length;

  return (
    <section aria-label="차량 지원 현황" className="flex flex-col gap-4">
      {/* 1단계: 연도 */}
      <div role="tablist" aria-label="연도 선택" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">연도</span>
        {years.map((y) => (
          <button key={y} type="button" role="tab" aria-selected={y === year} onClick={() => setYear(y)} className={pill(y === year)}>
            {formatPeriod(y)}
          </button>
        ))}
      </div>

      {/* 2단계: 그해 지원 내역 */}
      <div role="tabpanel" aria-label={`${formatPeriod(year)} 차량 지원`} className="flex flex-col gap-4 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800/50">
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {formatPeriod(year)} 지원 대수{" "}
          <span className="text-2xl font-semibold tabular-nums text-navy dark:text-white">{formatWithUnit(count?.value ?? null, unit)}</span>
        </p>

        {inYear.length > 0 ? (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {inYear.map((t, i) => (
              <li key={`${t.date}-${t.time}-${i}`} className="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 bg-white p-3 text-center dark:border-zinc-700 dark:bg-zinc-900">
                <BusIcon size={72} title={`${t.place} 지원 버스`} />
                <span className="mt-1 text-sm font-semibold tabular-nums">{dateLabel(t.date)}</span>
                {t.time && <span className="text-xs tabular-nums text-zinc-500">{t.time}</span>}
                <span className="text-sm text-zinc-700 dark:text-zinc-200">{t.place}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">이 해의 지원 일시·장소 내역이 없습니다 (데이터 없음).</p>
        )}

        {mismatch && (
          <p className="text-xs text-amber-700 dark:text-amber-300">
            원본의 지원 대수({formatWithUnit(count!.value, unit)})와 내역 건수({inYear.length}건)가 다릅니다. 담당자에게 확인해 주세요.
          </p>
        )}
      </div>
    </section>
  );
}

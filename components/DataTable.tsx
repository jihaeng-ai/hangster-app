// 차트 값을 표로도 보여준다 (색으로만 구분하지 않도록 — 접근성)
import { formatPeriod, formatWithUnit } from "@/lib/metrics/format";
import type { ChartRow } from "@/lib/metrics/series";

export function DataTable({ rows, categories, unit }: { rows: ChartRow[]; categories: string[]; unit: string }) {
  const columns = categories.length > 0 ? [...categories, "value"] : ["value"];
  const header = (c: string) => (c === "value" ? (categories.length > 0 ? "합계" : "값") : c);
  const cell = (v: ChartRow[string]) => formatWithUnit(typeof v === "number" ? v : null, unit);

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">표로 보기</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-right">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="px-2 py-1 text-left">기간</th>
              {columns.map((c) => (
                <th key={c} className="px-2 py-1">{header(c)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-2 py-1 text-left">{formatPeriod(r.period)}</td>
                {columns.map((c) => (
                  <td key={c} className="px-2 py-1 tabular-nums">{cell(r[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

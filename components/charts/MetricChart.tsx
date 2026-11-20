"use client";
// 지표 차트 — 지표 정의의 형태(꺾은선·막대·누적 막대·원형)대로 그린다 (PRD Must1-9)
// 계산은 하지 않는다. 서버가 만든 rows를 그대로 그리고, null(데이터 없음)은 점·막대를 그리지 않는다.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartType } from "@/lib/metrics/definitions";
import { formatPeriod, formatWithUnit } from "@/lib/metrics/format";
import type { ChartRow } from "@/lib/metrics/series";

const SERIES_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];
const axisStyle = { fontSize: 12, fill: "var(--viz-text)" };

interface Props {
  chart: ChartType;
  unit: string;
  rows: ChartRow[];
  categories: string[];
  /** 차트 설명 (화면 읽기 프로그램용) */
  label: string;
  /** 세로축: "zero"(0부터, 기본) / "auto"(값 범위에 맞춤) / [최소, 최대](직접 지정 — 2026-11-20 조합원 연도별 비교, 기울기를 완만하게) */
  yDomain?: "zero" | "auto" | [number, number];
}

function tooltipValue(unit: string) {
  return (value: unknown) => formatWithUnit(typeof value === "number" ? value : null, unit);
}

export function MetricChart({ chart, unit, rows, categories, label, yDomain = "zero" }: Props) {
  const formatter = tooltipValue(unit);
  const tooltip = (
    <Tooltip
      formatter={(v) => formatter(v)}
      labelFormatter={(p) => formatPeriod(String(p))}
      contentStyle={{ background: "var(--viz-surface)", borderColor: "var(--viz-grid)", fontSize: 13 }}
    />
  );
  const axes = (
    <>
      <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
      <XAxis dataKey="period" tick={axisStyle} tickLine={false} axisLine={{ stroke: "var(--viz-grid)" }} />
      <YAxis
        tick={axisStyle}
        tickLine={false}
        axisLine={false}
        width={56}
        unit={unit === "%" ? "%" : undefined}
        domain={Array.isArray(yDomain) ? yDomain : yDomain === "auto" && chart === "line" ? ["dataMin - 20", "dataMax + 20"] : undefined}
        allowDecimals={unit === "%"}
        tickFormatter={(v: number) => v.toLocaleString("ko-KR")}
      />
    </>
  );

  let body: React.ReactElement;
  if (chart === "stacked-bar" && categories.length > 0) {
    body = (
      <BarChart data={rows}>
        {axes}
        {tooltip}
        <Legend wrapperStyle={{ fontSize: 13, color: "var(--viz-text)" }} />
        {categories.map((c, i) => (
          <Bar
            key={c}
            dataKey={c}
            name={c}
            stackId="total"
            fill={SERIES_COLORS[i % SERIES_COLORS.length]}
            stroke="var(--viz-surface)"
            strokeWidth={2}
            radius={i === categories.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    );
  } else if (chart === "bar") {
    body = (
      <BarChart data={rows}>
        {axes}
        {tooltip}
        <Bar dataKey="value" name={label} fill="var(--series-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    );
  } else if (chart === "pie" && rows.length > 0 && categories.length > 0 && categories.length <= 5) {
    // 원형은 항목 5개 이하일 때만 (PRD Must1-9) — 최근 기간의 비중
    const last = rows[rows.length - 1];
    const slices = categories.map((c) => ({ name: c, value: typeof last[c] === "number" ? (last[c] as number) : 0 }));
    body = (
      <PieChart>
        {tooltip}
        <Legend wrapperStyle={{ fontSize: 13, color: "var(--viz-text)" }} />
        <Pie data={slices} dataKey="value" nameKey="name" stroke="var(--viz-surface)" strokeWidth={2}>
          {slices.map((s, i) => (
            <Cell key={s.name} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    );
  } else {
    // 구분(직종 등)이 있는 꺾은선 지표(예: 직종별 인상률)는 더하지 않고 구분마다 선을 따로 그린다 (Gap 2)
    const lines = categories.length > 0 ? categories : ["value"];
    body = (
      <LineChart data={rows}>
        {axes}
        {tooltip}
        {categories.length > 0 && <Legend wrapperStyle={{ fontSize: 13, color: "var(--viz-text)" }} />}
        {lines.map((key, i) => {
          const color = SERIES_COLORS[i % SERIES_COLORS.length];
          return (
            <Line
              key={key}
              type="linear"
              dataKey={key}
              name={key === "value" ? label : key}
              stroke={color}
              strokeWidth={2}
              dot={{ r: 4, fill: color, stroke: "var(--viz-surface)", strokeWidth: 2 }}
              activeDot={{ r: 6 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          );
        })}
      </LineChart>
    );
  }

  return (
    <figure role="img" aria-label={`${label} 차트`} className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {body}
      </ResponsiveContainer>
    </figure>
  );
}

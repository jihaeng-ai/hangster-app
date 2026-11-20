// 저장소의 값을 지표별 차트 데이터로 묶는다 (화면은 계산하지 않고 이 결과만 그린다)
import "server-only";
import { cacheTag } from "next/cache";
import { loadStore } from "@/lib/data/store";
import type { DataPoint, MetricId, SourceRef, Store, UnionOfficer } from "@/lib/data/types";
import { describeChange } from "./describe";
import { METRICS, type MetricDefinition } from "./definitions";

/** 업로드·교체·삭제 후 이 태그로 캐시를 비운다 (Design §4.1) */
export const DATASET_TAG = "dataset";

export interface SourceSummary {
  fileName: string;
  baseDate: string;
  kind: SourceRef["kind"];
  /** PDF에서 온 값의 페이지 번호들 */
  pages: number[];
}

/** 차트 한 줄(한 기간). 카테고리가 있으면 카테고리 이름이 열이 된다 */
export type ChartRow = { period: string } & Record<string, number | string | null>;

export interface MetricSeries {
  metric: Pick<MetricDefinition, "id" | "label" | "unit" | "chart" | "periodUnit">;
  /** 기간별 합계 (카테고리 중 하나라도 null이면 합계도 null — 추정 금지) */
  totals: { period: string; value: number | null }[];
  /** 누적 막대용 카테고리 이름 (없으면 빈 배열) */
  categories: string[];
  rows: ChartRow[];
  latest: { period: string; value: number | null } | null;
  sources: SourceSummary[];
  hasPdf: boolean;
  /** 변화 설명 (최대 3문장) */
  description: string[];
  /** 갈래가 있는 지표(예: 투표율)는 갈래마다 따로 계산한 값 */
  sections?: SectionSeries[];
}

/** 한 카드 안의 갈래 하나 (예: 임단협 찬반투표) */
export interface SectionSeries {
  name: string;
  totals: { period: string; value: number | null }[];
  rows: ChartRow[];
  latest: { period: string; value: number | null } | null;
  sources: SourceSummary[];
  description: string[];
}

/** 화면(조직도)으로 보내는 전임간부 한 명 */
export interface OfficerRow {
  year: string;
  name: string;
  department: string;
  /** 재직 기간 (기간 정보가 없는 명단은 그해 1월 1일~12월 31일) */
  periodStart: string;
  periodEnd: string;
  group: "유급" | "무급" | null;
  role: string | null;
  order: number | null;
}

/** 기간 정보가 없는 예전 명단은 그해 전체를 한 기간으로 본다 */
export function toOfficerRow(o: UnionOfficer): OfficerRow {
  return {
    year: o.year,
    name: o.name,
    department: o.department,
    periodStart: o.periodStart ?? `${o.year}-01-01`,
    periodEnd: o.periodEnd ?? `${o.year}-12-31`,
    group: o.group ?? null,
    role: o.role ?? null,
    order: o.order ?? null,
  };
}

/**
 * 연도별 전임간부 수 = 그해 마지막 기간의 인원 (유급+무급) — 2026-11-19 결정
 * 같은 해에도 기간마다 전임간부가 바뀌므로, 연말 기준 인원을 그해 인원으로 쓴다
 */
export function officerCountByYear(rows: OfficerRow[]): { period: string; value: number }[] {
  const years = [...new Set(rows.map((r) => r.year))].sort();
  return years.map((year) => {
    const inYear = rows.filter((r) => r.year === year);
    const lastStart = inYear.map((r) => r.periodStart).sort().at(-1);
    return { period: year, value: inYear.filter((r) => r.periodStart === lastStart).length };
  });
}

export interface DashboardData {
  series: MetricSeries[];
  officers: OfficerRow[];
  officerSources: SourceSummary[];
  isEmpty: boolean;
}

function summarizeSources(sources: SourceRef[]): SourceSummary[] {
  const map = new Map<string, SourceSummary>();
  for (const s of sources) {
    const key = `${s.fileId}|${s.baseDate}`;
    const entry = map.get(key) ?? { fileName: s.fileName, baseDate: s.baseDate, kind: s.kind, pages: [] };
    if (s.page !== undefined && !entry.pages.includes(s.page)) entry.pages.push(s.page);
    map.set(key, entry);
  }
  return [...map.values()].map((e) => ({ ...e, pages: e.pages.sort((a, b) => a - b) }));
}

/**
 * 한 기간의 대표값 (Gap 2·3) — 지표 정의의 aggregate 설정을 따른다. 확실하지 않으면 null (PRD Must1-1: 추정 금지)
 * - sum (예: 인력): 모든 구분(직종)의 값이 있어야 합계. 하나라도 비었거나 그해에 빠졌으면 null
 * - single (예: 임금 인상률 %): 더하지 않는다. 구분 없는 값이 딱 하나 있을 때만 그 값, 아니면 null
 */
export function periodTotal(
  aggregate: MetricDefinition["aggregate"],
  inPeriod: Pick<DataPoint, "category" | "value">[],
  categories: string[],
): number | null {
  if (aggregate === "sum") {
    if (categories.length === 0) {
      return inPeriod.length === 1 ? inPeriod[0].value : null;
    }
    let total = 0;
    for (const c of categories) {
      const hits = inPeriod.filter((p) => p.category === c);
      if (hits.length !== 1 || hits[0].value === null) return null; // 빠졌거나·비었거나·중복이면 합계를 만들지 않는다
      total += hits[0].value;
    }
    return total;
  }
  const overall = inPeriod.filter((p) => p.category === null);
  return overall.length === 1 ? overall[0].value : null;
}

export function buildNumericSeries(metric: MetricDefinition, points: DataPoint[]): Omit<MetricSeries, "description"> {
  const periods = [...new Set(points.map((p) => p.period))].sort();
  const categories = [...new Set(points.map((p) => p.category).filter((c): c is string => c !== null))];
  const unit = points[0]?.unit ?? metric.unit;

  const rows: ChartRow[] = [];
  const totals: MetricSeries["totals"] = [];
  for (const period of periods) {
    const inPeriod = points.filter((p) => p.period === period);
    const row: ChartRow = { period };
    if (categories.length > 0) {
      for (const c of categories) row[c] = inPeriod.find((p) => p.category === c)?.value ?? null;
    }
    const total = periodTotal(metric.aggregate, inPeriod, categories);
    row.value = total;
    rows.push(row);
    totals.push({ period, value: total });
  }

  return {
    metric: { id: metric.id, label: metric.label, unit, chart: metric.chart, periodUnit: metric.periodUnit },
    totals,
    categories,
    rows,
    latest: totals.at(-1) ?? null,
    sources: summarizeSources(points.map((p) => p.source)),
    hasPdf: points.some((p) => p.source.kind === "pdf"),
  };
}

/** 전임자 현황: 연도별 인원수 = 명단 수 */
function buildOfficerSeries(metric: MetricDefinition, store: Store): Omit<MetricSeries, "description"> {
  const totals = officerCountByYear(store.officers.map(toOfficerRow));
  return {
    metric: { id: metric.id, label: metric.label, unit: metric.unit, chart: metric.chart, periodUnit: metric.periodUnit },
    totals,
    categories: [],
    rows: totals.map((t) => ({ period: t.period, value: t.value })),
    latest: totals.at(-1) ?? null,
    sources: summarizeSources(store.officers.map((o) => o.source)),
    hasPdf: store.officers.some((o) => o.source.kind === "pdf"),
  };
}

/** 대시보드 전체 데이터 — 캐시해서 버튼을 누른 뒤 3초 안에 보이게 한다 (PRD Must1-4) */
/** 갈래가 있는 지표(예: 투표율): 갈래마다 따로 값·변화 설명을 만든다 (두 값을 섞거나 더하지 않음) */
export function buildSectionSeries(metric: MetricDefinition, points: DataPoint[]): SectionSeries[] | undefined {
  return metric.sections?.map((sec) => {
    const pts = points.filter((p) => p.metricId === metric.id && p.category === sec.name);
    const totals = [...new Set(pts.map((p) => p.period))].sort().map((period) => {
      const hits = pts.filter((p) => p.period === period);
      return { period, value: hits.length === 1 ? hits[0].value : null };
    });
    return {
      name: sec.name,
      totals,
      rows: totals.map((t) => ({ period: t.period, value: t.value })),
      latest: totals.at(-1) ?? null,
      sources: summarizeSources(pts.map((p) => p.source)),
      description: describeChange(`${sec.name} 투표율`, metric.unit, metric.periodUnit, totals),
    };
  });
}

export async function getDashboardData(): Promise<DashboardData> {
  "use cache";
  cacheTag(DATASET_TAG);

  const store = await loadStore();
  const series = METRICS.map((metric) => {
    const base =
      metric.id === "union-officers"
        ? buildOfficerSeries(metric, store)
        : buildNumericSeries(metric, store.points.filter((p) => p.metricId === metric.id));
    const sections = buildSectionSeries(metric, store.points);
    return {
      ...base,
      description: sections ? [] : describeChange(base.metric.label, base.metric.unit, base.metric.periodUnit, base.totals),
      ...(sections ? { sections } : {}),
    };
  });

  return {
    series,
    officers: store.officers
      .map(toOfficerRow)
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart) || (a.order ?? 999) - (b.order ?? 999)),
    officerSources: summarizeSources(store.officers.map((o) => o.source)),
    isEmpty: store.points.length === 0 && store.officers.length === 0,
  };
}

export async function getMetricSeries(id: MetricId): Promise<MetricSeries | undefined> {
  return (await getDashboardData()).series.find((s) => s.metric.id === id);
}

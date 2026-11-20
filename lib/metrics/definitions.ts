// Design Ref: §3.2 — 지표 정의. 지표를 추가할 때는 이 파일만 고친다.
import type { MetricId } from "@/lib/data/types";

/** 차트 형태 (PRD Must1-9) */
export type ChartType = "line" | "bar" | "stacked-bar" | "pie" | "card";

export interface MetricDefinition {
  id: MetricId;
  label: string;
  unit: string;
  /** 기간 단위: 연도별이면 "전년 대비", 월별이면 "전월 대비" (PRD Must1-11) */
  periodUnit: "year" | "month";
  /** 상세 화면 차트 형태 */
  chart: ChartType;
  /** 카테고리가 여러 개일 때 첫 화면 카드·변화 설명은 합계를 쓴다 */
  aggregate: "sum" | "single";
  /** 엑셀 시트 이름으로 지표를 알아보는 데 쓰는 이름들 */
  sheetNames: string[];
  /** PDF "[지표] …" 줄로 지표를 알아보는 데 쓰는 이름들 */
  pdfTitles: string[];
}

/** 첫 화면 핵심 지표는 최대 6개 (PRD Must1-2) */
export const MAX_SUMMARY_CARDS = 6;

export const METRICS: readonly MetricDefinition[] = [
  {
    id: "wage-increase",
    label: "연도별 임금 인상률",
    unit: "%",
    periodUnit: "year",
    chart: "line",
    aggregate: "single",
    sheetNames: ["임금인상률", "임금 인상률"],
    pdfTitles: ["임금 인상률", "연도별 임금 인상률"],
  },
  {
    id: "workforce",
    label: "의료원 인력 현황",
    unit: "명",
    periodUnit: "year",
    chart: "stacked-bar",
    aggregate: "sum",
    sheetNames: ["인력현황", "인력 현황"],
    pdfTitles: ["인력 현황", "의료원 인력 현황"],
  },
  {
    id: "union-officers",
    label: "노동조합 전임간부 현황", // 2026-11-19 사용자 요청으로 "전임자" → "전임간부"
    unit: "명",
    periodUnit: "year",
    chart: "line",
    aggregate: "single",
    sheetNames: ["전임자", "노조전임자", "노동조합 전임자", "전임간부", "노동조합 전임간부"],
    pdfTitles: ["노동조합 전임자 현황", "노동조합 전임간부 현황"],
  },
  {
    id: "union-vehicles",
    label: "노동조합 차량 지원 현황",
    unit: "대",
    periodUnit: "year",
    chart: "line",
    aggregate: "single",
    sheetNames: ["차량지원", "노조차량지원"],
    pdfTitles: ["노동조합 차량 지원 현황", "차량 지원 현황"],
  },
];

export function getMetric(id: MetricId): MetricDefinition {
  const metric = METRICS.find((m) => m.id === id);
  if (!metric) throw new Error(`알 수 없는 지표: ${id}`);
  return metric;
}

/** 기간이 지표의 기간 단위와 맞는지 (Gap 4): 연도별은 "2024", 월별은 "2024-03" */
export function periodMatchesUnit(period: string, unit: MetricDefinition["periodUnit"]): boolean {
  return unit === "year" ? /^\d{4}$/.test(period) : /^\d{4}-\d{2}$/.test(period);
}

/** 기간이 [from, to] 범위 안인지 — 연도("2024")로 물어도 월 기간("2024-03")을 포함한다 (Gap 4) */
export function periodInRange(period: string, from: string | null, to: string | null): boolean {
  if (from && period.slice(0, from.length) < from) return false;
  if (to && period.slice(0, to.length) > to) return false;
  return true;
}

/** 이름 비교용: 공백을 없앤다 */
const normalize = (s: string) => s.replace(/\s+/g, "");

export function findMetricBySheetName(name: string): MetricDefinition | undefined {
  const key = normalize(name);
  return METRICS.find((m) => m.sheetNames.some((n) => normalize(n) === key));
}

export function findMetricByPdfTitle(title: string): MetricDefinition | undefined {
  const key = normalize(title);
  return METRICS.find((m) => m.pdfTitles.some((n) => normalize(n) === key));
}

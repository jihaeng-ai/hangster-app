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
  /**
   * 한 카드 안에서 따로 보여줄 갈래 (예: 투표율 = 임단협 찬반투표 / 임원 선거)
   * name은 데이터의 구분 값과 같아야 하고, aliases는 AI 질문에서 이 갈래를 알아보는 낱말이다
   */
  sections?: { name: string; aliases: string[] }[];
}

/** 첫 화면 핵심 지표는 최대 6개 (PRD Must1-2) */
export const MAX_SUMMARY_CARDS = 6;

// 이 배열 순서가 첫 화면 카드 순서다 — 전임간부 → 조합원 → 임금 인상률 → 차량 지원 → 투표율 (2026-11-20 사용자 요청)
export const METRICS: readonly MetricDefinition[] = [
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
    id: "workforce",
    label: "노동조합 조합원 현황", // 2026-11-20 사용자 요청으로 "의료원 인력 현황" → "노동조합 조합원 현황"
    unit: "명",
    periodUnit: "year",
    chart: "stacked-bar",
    aggregate: "sum",
    // 예전 이름(인력현황)으로 만든 파일도 계속 읽는다
    sheetNames: ["인력현황", "인력 현황", "조합원현황", "조합원 현황", "노동조합 조합원 현황"],
    pdfTitles: ["인력 현황", "의료원 인력 현황", "조합원 현황", "노동조합 조합원 현황"],
  },
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
    id: "union-vehicles",
    label: "노동조합 차량 지원 현황",
    unit: "대",
    periodUnit: "year",
    chart: "line",
    aggregate: "single",
    sheetNames: ["차량지원", "노조차량지원"],
    pdfTitles: ["노동조합 차량 지원 현황", "차량 지원 현황"],
  },
  {
    // 2026-11-20 사용자 요청: 투표율 카드 하나에 두 갈래
    id: "union-votes",
    label: "노동조합 투표율",
    unit: "%",
    periodUnit: "year",
    chart: "line",
    aggregate: "single", // 두 투표율을 더하지 않는다
    sheetNames: ["투표율", "노동조합 투표율"],
    pdfTitles: ["투표율", "노동조합 투표율"],
    sections: [
      { name: "임단협 찬반투표", aliases: ["임단협", "찬반", "단체협약", "임금협약", "단협", "협약"] },
      { name: "임원(지부장) 선거", aliases: ["선거", "임원", "지부장", "위원장"] },
    ],
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

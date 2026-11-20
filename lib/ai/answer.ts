// Design Ref: §8.4 — 답변 만들기. 숫자 계산·문장·차트는 모두 서버에서 데이터로 만든다 (PRD Must2-1, 2, 7)
import "server-only";
import { periodInRange, type ChartType } from "@/lib/metrics/definitions";
import { describeChange } from "@/lib/metrics/describe";
import { directionParticle, formatPeriod, formatValue, formatWithUnit, topicParticle } from "@/lib/metrics/format";
import type { ChartRow, DashboardData, MetricSeries } from "@/lib/metrics/series";
import { EXAMPLE_QUESTIONS } from "./examples";
import type { Interpretation } from "./interpret";

export type AskStatus =
  | "answered"
  | "no_data"
  | "blocked_id_number"
  | "refused_person"
  | "refused_officers"
  | "refused_legal"
  | "not_understood"
  | "rate_limited"; // 질문 횟수 한도 초과 (화면에서만 씀, SEC-02)

export interface AskResponse {
  status: AskStatus;
  /** 최대 3문장 */
  sentences: string[];
  basis?: { metricLabel: string; baseDates: string[]; fileNames: string[]; pdf: boolean };
  chart?: { chart: ChartType; unit: string; rows: ChartRow[]; categories: string[]; label: string };
  link?: string;
  examples?: readonly string[];
}

export const MESSAGES = {
  no_data: "해당 데이터가 없습니다.",
  blocked_id_number: "사번·주민번호처럼 보이는 숫자가 있어 질문을 보내지 않았습니다. 숫자를 빼고 다시 물어봐 주세요.",
  refused_person: "개인 단위로는 답하지 않습니다. 부서·직종 단위로 물어봐 주세요.",
  refused_officers: "노동조합 전임간부 명단은 AI 질문으로 다루지 않습니다. 대시보드의 '노동조합 전임간부 현황'에서 확인해 주세요.",
  legal_notice: "위법 여부 같은 노무·법률 판단은 하지 않습니다. 담당자에게 확인해 주세요.",
  not_understood: "질문을 이해하지 못했습니다. 아래 예시처럼 물어보시거나, 대시보드의 지표 버튼을 눌러 확인해 주세요.",
} as const;

export function simpleResponse(status: Exclude<AskStatus, "answered" | "rate_limited">): AskResponse {
  if (status === "not_understood") {
    return { status, sentences: [MESSAGES.not_understood], examples: EXAMPLE_QUESTIONS };
  }
  if (status === "refused_officers") {
    return { status, sentences: [MESSAGES.refused_officers], link: "/metrics/union-officers" };
  }
  if (status === "refused_legal") return { status, sentences: [MESSAGES.legal_notice] };
  return { status, sentences: [MESSAGES[status]] };
}

const normalize = (s: string) => s.replace(/\s+/g, "");
/** AI가 붙이는 뜻 없는 구분 낱말 (무시) */
const GENERIC_CATEGORY = /^(직종|직종별|항목|항목별|구분|부서|부서별|전체|전체인원|인원)$/;

type Point = { period: string; value: number | null };

export function buildAnswer(interp: Interpretation, data: DashboardData, legalFlag: boolean): AskResponse {
  const result = buildAnswerInner(interp, data, legalFlag);
  // 법률 질문이면 데이터가 없을 때도 "법률 판단은 하지 않는다" 안내를 붙인다 (PRD Must2-5)
  const legal = legalFlag || interp.intent === "legal";
  if (legal && result.status === "no_data" && !result.sentences.includes(MESSAGES.legal_notice)) {
    return { ...result, sentences: [...result.sentences.slice(0, 2), MESSAGES.legal_notice] };
  }
  return result;
}

function buildAnswerInner(interp: Interpretation, data: DashboardData, legalFlag: boolean): AskResponse {
  if (interp.intent === "person") return simpleResponse("refused_person");
  if (interp.intent === "officers") return simpleResponse("refused_officers");
  const legal = legalFlag || interp.intent === "legal";

  if (!interp.metricId) {
    if (legal) return simpleResponse("refused_legal");
    if (interp.intent === "unavailable") {
      const available = data.series.map((s) => s.metric.label).join(", ");
      return { status: "no_data", sentences: [MESSAGES.no_data, `지금 볼 수 있는 자료는 ${available}입니다.`] };
    }
    return simpleResponse("not_understood");
  }

  const series = data.series.find((s) => s.metric.id === interp.metricId);
  if (!series || series.totals.length === 0) return simpleResponse("no_data");

  // 카테고리(직종 등) 맞추기 — 데이터에 없는 카테고리를 물으면 "해당 데이터가 없습니다"
  const rawCategory = interp.category && !GENERIC_CATEGORY.test(normalize(interp.category)) ? interp.category : null;
  let category: string | null = null;
  if (rawCategory && interp.aggregation !== "breakdown" && !normalize(series.metric.label).includes(normalize(rawCategory))) {
    category =
      series.categories.find((c) => normalize(rawCategory).includes(normalize(c)) || normalize(c).includes(normalize(rawCategory))) ?? null;
    if (!category) return simpleResponse("no_data");
  }

  const allPoints: Point[] = category
    ? series.rows.map((r) => ({ period: r.period, value: typeof r[category] === "number" ? (r[category] as number) : null }))
    : series.totals;
  const inRange = allPoints.filter(
    (p) => periodInRange(p.period, interp.periodFrom, interp.periodTo), // 연도로 물어도 월 기간을 포함 (Gap 4)
  );
  // "최근 N년" → 마지막 N개 기간만
  const points = interp.recentCount ? inRange.slice(-interp.recentCount) : inRange;
  if (points.length === 0) return simpleResponse("no_data");

  const { unit, periodUnit } = series.metric;
  const label = category ? `${series.metric.label} 중 ${category}` : series.metric.label;
  // AI가 무엇을 골랐든 항목별 나눠 보기로 답하는 경우:
  //  - "직종별", "항목별"처럼 "~별"로 물을 때
  //  - "가장 많은 직종은?"처럼 구분 낱말(직종·항목·부서)과 최고·최저를 함께 물을 때
  const generic = interp.category ? normalize(interp.category) : "";
  const asksBreakdown =
    /별$/.test(generic) ||
    (GENERIC_CATEGORY.test(generic) && (interp.aggregation === "max" || interp.aggregation === "min"));
  const aggregation = asksBreakdown && series.categories.length > 0 ? "breakdown" : (interp.aggregation ?? "latest");
  let sentences: string[];
  let chart: AskResponse["chart"];

  if (aggregation === "breakdown" && series.categories.length > 0) {
    ({ sentences, chart } = breakdown(series, interp.periodTo ?? interp.periodFrom));
  } else if (aggregation === "max" || aggregation === "min") {
    sentences = [extreme(label, unit, points, aggregation)];
  } else if (aggregation === "trend") {
    sentences = describeChange(label, unit, periodUnit, points);
  } else {
    // latest / compare: 기간을 하나 콕 집어 물으면 그 값, 아니면 최근 값과 직전 대비 증감
    const single = interp.periodFrom && interp.periodFrom === interp.periodTo;
    const valid = points.filter((p) => p.value !== null);
    if (single || valid.length < 2) {
      const p = points[points.length - 1];
      sentences = [
        p.value === null
          ? `${formatPeriod(p.period)} ${label} 값은 원본에서 확인되지 않았습니다(데이터 없음).`
          : `${formatPeriod(p.period)} ${label}${topicParticle(label)} ${formatWithUnit(p.value, unit)}입니다.`,
      ];
    } else {
      sentences = describeChange(label, unit, periodUnit, allPointsUpTo(allPoints, points)).slice(0, 1);
    }
  }

  chart ??= {
    chart: category ? "line" : series.metric.chart,
    unit,
    rows: category ? points.map((p) => ({ period: p.period, value: p.value })) : series.rows.filter((r) => points.some((p) => p.period === r.period)),
    categories: category ? [] : series.categories,
    label,
  };

  if (legal) sentences = [...sentences.slice(0, 2), MESSAGES.legal_notice];

  return {
    status: "answered",
    sentences: sentences.slice(0, 3),
    basis: {
      metricLabel: series.metric.label,
      baseDates: [...new Set(series.sources.map((s) => s.baseDate))],
      fileNames: [...new Set(series.sources.map((s) => s.fileName))],
      pdf: series.hasPdf,
    },
    chart,
    link: `/metrics/${series.metric.id}`,
  };
}

/** 직전 기간과 비교하려면 범위 앞의 기간도 필요하다 (예: "2024년은 작년보다?") */
function allPointsUpTo(all: Point[], filtered: Point[]): Point[] {
  const last = filtered[filtered.length - 1].period;
  return all.filter((p) => p.period <= last);
}

function extreme(label: string, unit: string, points: Point[], kind: "max" | "min"): string {
  const valid = points.filter((p): p is { period: string; value: number } => p.value !== null);
  if (valid.length === 0) return MESSAGES.no_data;
  const target = kind === "max" ? Math.max(...valid.map((p) => p.value)) : Math.min(...valid.map((p) => p.value));
  const when = valid.filter((p) => p.value === target).map((p) => formatPeriod(p.period)).join("·");
  const range = `${formatPeriod(valid[0].period)}~${formatPeriod(valid[valid.length - 1].period)}`;
  return `${range} 중 ${label}${topicParticle(label)} ${when}에 ${formatValue(target, unit)}${unit}${directionParticle(unit)} 가장 ${kind === "max" ? "높았습니다" : "낮았습니다"}.`;
}

function breakdown(series: MetricSeries, period: string | null): { sentences: string[]; chart: AskResponse["chart"] } {
  const row = (period && series.rows.find((r) => r.period === period)) || series.rows[series.rows.length - 1];
  const { unit, label } = series.metric;
  const items = series.categories
    .map((c) => ({ name: c, value: typeof row[c] === "number" ? (row[c] as number) : null }))
    .filter((i): i is { name: string; value: number } => i.value !== null);
  if (items.length === 0) return { sentences: [MESSAGES.no_data], chart: undefined };

  const max = items.reduce((a, b) => (b.value > a.value ? b : a));
  const min = items.reduce((a, b) => (b.value < a.value ? b : a));
  const sentences = [
    `${formatPeriod(row.period)} ${label}에서 가장 많은 항목은 ${max.name}(${formatWithUnit(max.value, unit)}), 가장 적은 항목은 ${min.name}(${formatWithUnit(min.value, unit)})입니다.`,
  ];
  if (typeof row.value === "number") sentences.push(`전체 합계는 ${formatWithUnit(row.value, unit)}입니다.`);
  return {
    sentences,
    chart: { chart: "bar", unit, rows: items.map((i) => ({ period: i.name, value: i.value })), categories: [], label: `${formatPeriod(row.period)} ${label}` },
  };
}

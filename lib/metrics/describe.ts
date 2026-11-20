// Design Ref: §8.1 — 변화 설명. 외부 AI 없이 정해진 문장 틀에 숫자만 채운다 (PRD Must1-6~8, 11)
import { directionParticle, formatPeriod, formatValue, topicParticle } from "./format";

export const NO_PREVIOUS_DATA = "비교할 이전 데이터가 없습니다.";

/** 평가·예측 표현 금지 (PRD Must1-7) — 문장 틀에 처음부터 넣지 않고, 혹시 섞이면 개발 중 오류로 알린다 */
const FORBIDDEN = /심각|우려|위험|예상|전망|급증|급감/;

type Total = { period: string; value: number | null };

function isConsecutive(prev: string, latest: string, unit: "year" | "month"): boolean {
  if (unit === "year") return Number(latest) - Number(prev) === 1;
  const [py, pm] = prev.split("-").map(Number);
  const [ly, lm] = latest.split("-").map(Number);
  return ly * 12 + lm - (py * 12 + pm) === 1;
}

/** 증감 크기 (방향은 "증가/감소" 낱말로 말하므로 부호는 붙이지 않는다) */
function magnitude(value: number, digits: number): string {
  return Math.abs(value).toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 지표 하나의 변화 설명 (최대 3문장) */
export function describeChange(label: string, unit: string, periodUnit: "year" | "month", totals: Total[]): string[] {
  const valid = totals.filter((t): t is { period: string; value: number } => t.value !== null);
  const missing = totals.filter((t) => t.value === null);
  if (totals.length === 0) return []; // 기간 자체가 없으면 화면이 "아직 올라온 데이터가 없습니다"를 보여준다
  const missingNote = missing.length > 0
    ? `${missing.map((m) => formatPeriod(m.period)).join(", ")} 값은 원본에서 확인되지 않아 비교에서 제외했습니다.`
    : null;
  // 비교할 값이 2개 미만이면(값이 모두 비어 있는 경우 포함) 안내 문구를 보여준다 (PRD Must1-8)
  if (valid.length < 2) return missingNote ? [NO_PREVIOUS_DATA, missingNote] : [NO_PREVIOUS_DATA];

  const sentences: string[] = [];
  const latest = valid[valid.length - 1];
  const prev = valid[valid.length - 2];

  // 문장 1: 직전 기간 대비 증감 (수치와 %)
  const diff = latest.value - prev.value;
  const diffUnit = unit === "%" ? "%p" : unit;
  const diffDigits = unit === "%" ? 1 : 0;
  const rate = prev.value !== 0 ? `(${magnitude((diff / prev.value) * 100, 1)}%)` : "";
  const base = isConsecutive(prev.period, latest.period, periodUnit)
    ? `${periodUnit === "year" ? "전년" : "전월"}(${formatPeriod(prev.period)})`
    : formatPeriod(prev.period);
  const verb = diff > 0 ? "증가했습니다" : diff < 0 ? "감소했습니다" : "변동이 없습니다";
  const valueText = `${formatValue(latest.value, unit)}${unit}`;
  sentences.push(
    diff === 0
      ? `${formatPeriod(latest.period)} ${label}${topicParticle(label)} ${valueText}${directionParticle(unit)}, ${base} 대비 ${verb}.`
      : `${formatPeriod(latest.period)} ${label}${topicParticle(label)} ${valueText}${directionParticle(unit)}, ${base} 대비 ${magnitude(diff, diffDigits)}${diffUnit}${rate} ${verb}.`,
  );

  // 문장 2: 전체 기간 중 최고·최저 (기간 3개 이상일 때)
  if (valid.length >= 3) {
    const maxValue = Math.max(...valid.map((v) => v.value));
    const minValue = Math.min(...valid.map((v) => v.value));
    // 같은 값이 여러 시점이면 모두 적는다 (예: "2025년·2026년")
    const when = (value: number) =>
      valid.filter((v) => v.value === value).map((v) => formatPeriod(v.period)).join("·");
    const range = `${formatPeriod(totals[0].period)}~${formatPeriod(totals[totals.length - 1].period)}`;
    sentences.push(
      maxValue === minValue
        ? `전체 기간(${range}) 동안 값이 모두 ${formatValue(maxValue, unit)}${unit}${directionParticle(unit)} 같습니다.`
        : `전체 기간(${range}) 중 가장 높았던 때는 ${when(maxValue)}(${formatValue(maxValue, unit)}${unit}), 가장 낮았던 때는 ${when(minValue)}(${formatValue(minValue, unit)}${unit})입니다.`,
    );
  }

  // 문장 3: 원본에서 확인되지 않은 기간
  if (missingNote) sentences.push(missingNote);

  for (const s of sentences) {
    if (FORBIDDEN.test(s)) throw new Error(`변화 설명에 금지 표현이 들어갔습니다: ${s}`);
  }
  return sentences.slice(0, 3);
}

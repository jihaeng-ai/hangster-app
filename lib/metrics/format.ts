// 숫자·기간·조사 표시 도구 (서버·화면 공통, 계산 없음)

/** 지표 값 표시: %는 소수 첫째 자리, 나머지는 천 단위 쉼표 */
export function formatValue(value: number, unit: string): string {
  const digits = unit === "%" ? 1 : 0;
  return value.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 값 + 단위 ("3.0%", "2,023명"). null이면 "데이터 없음" (PRD Must1-1) */
export function formatWithUnit(value: number | null, unit: string): string {
  return value === null ? "데이터 없음" : `${formatValue(value, unit)}${unit}`;
}

/** "2026" → "2026년", "2026-03" → "2026년 3월" */
export function formatPeriod(period: string): string {
  // 기간 형식이 아니면(예: 직종 이름) 그대로 보여준다
  if (!/^\d{4}(-\d{2})?$/.test(period)) return period;
  const [year, month] = period.split("-");
  return month ? `${year}년 ${Number(month)}월` : `${year}년`;
}

/** 마지막 글자에 받침이 있는지 (한글이 아니면 null) */
function finalConsonant(word: string): number | null {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return null;
  return code % 28; // 0이면 받침 없음, 8이면 ㄹ
}

/** 은/는 */
export function topicParticle(word: string): string {
  const fc = finalConsonant(word);
  return fc === null || fc === 0 ? "는" : "은";
}

/** 으로/로 — 받침이 없거나 ㄹ이면 "로". 단위가 기호(%)면 "로" */
export function directionParticle(word: string): string {
  const fc = finalConsonant(word);
  return fc === null || fc === 0 || fc === 8 ? "로" : "으로";
}

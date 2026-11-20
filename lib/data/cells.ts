// 엑셀·PDF에서 꺼낸 값을 숫자·글자·날짜로 바꾸는 공통 도구
// PRD Must1-1: 숫자로 확실히 바꿀 수 없으면 null — 절대 추정하지 않는다

/** "1,234", "3.5%", " 12 " → 숫자 / "-", "", "약 3" 등 → null */
export function toNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/,/g, "").replace(/%$/, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** 기간 형식 확인: "2024" 또는 "2024-03" (점·슬래시도 허용해 하이픈으로 통일) */
export function toPeriod(raw: unknown): string | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  const m = text.match(/^(\d{4})(?:년)?(?:[-./](\d{1,2})(?:월)?)?$/);
  if (!m) return null;
  return m[2] ? `${m[1]}-${m[2].padStart(2, "0")}` : m[1];
}

/** 날짜 → "YYYY-MM-DD" (Date 객체 또는 "2026-10-31", "2026.10.31" 형태) */
export function toDateString(raw: unknown): string | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

/** 이름 비교용: 공백 제거 */
export const normalizeLabel = (s: string) => s.replace(/\s+/g, "");

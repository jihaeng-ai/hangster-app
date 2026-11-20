// 변화 설명 문장 확인 (PRD Must1-6~8) — 실행: npm run check:describe
import { describeChange, NO_PREVIOUS_DATA } from "@/lib/metrics/describe";

const cases: [string, string[]][] = [
  ["임금(연도 8개)", describeChange("연도별 임금 인상률", "%", "year", [
    { period: "2019", value: 3.1 }, { period: "2020", value: 1.8 }, { period: "2025", value: 3.3 }, { period: "2026", value: 3.0 }])],
  ["차량(중간 빈 값)", describeChange("노동조합 차량 지원 현황", "대", "year", [
    { period: "2023", value: 3 }, { period: "2024", value: null }, { period: "2025", value: 4 }, { period: "2026", value: 5 }])],
  ["인력(명)", describeChange("의료원 인력 현황", "명", "year", [
    { period: "2025", value: 1991 }, { period: "2026", value: 2023 }])],
  ["월별", describeChange("초과근무", "시간", "month", [
    { period: "2026-08", value: 120 }, { period: "2026-09", value: 120 }])],
  ["동률 최고값", describeChange("노동조합 전임자 현황", "명", "year", [
    { period: "2024", value: 3 }, { period: "2025", value: 4 }, { period: "2026", value: 4 }])],
  ["값이 모두 비어 있음", describeChange("노동조합 차량 지원 현황", "대", "year", [
    { period: "2025", value: null }, { period: "2026", value: null }])],
  ["1개 기간", describeChange("의료원 인력 현황", "명", "year", [{ period: "2026", value: 10 }])],
];
let fail = 0;
for (const [name, s] of cases) {
  console.log(`[${name}]`); s.forEach((x) => console.log("  " + x));
  if (s.length > 3) { fail++; console.error("  ❌ 3문장 초과"); }
}
if (cases[5][1][0] !== NO_PREVIOUS_DATA || !cases[5][1][1]?.includes("2025년, 2026년")) { fail++; console.error("❌ 값이 모두 비었을 때 안내 없음 (PRD Must1-8)"); }
if (!cases[4][1][1].includes("2025년·2026년(4명)")) { fail++; console.error("❌ 동률 시점을 모두 적지 않음"); }
if (cases[6][1][0] !== NO_PREVIOUS_DATA) { fail++; console.error("❌ 1개 기간 안내 문구 다름"); }
if (fail) process.exit(1); else console.log("✅ 변화 설명 확인 끝");

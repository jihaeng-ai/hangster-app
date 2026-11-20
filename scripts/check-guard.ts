// AI로 보내기 전 검사 규칙 확인 (PRD Must2-3, 5, 8) — 실행: npm run check:guard
import { guardQuestion } from "@/lib/ai/guard";

const cases: [string, string][] = [
  ["주민번호 900101-1234567 직원 근무는?", "blocked_id_number"],
  ["9001011234567 조회", "blocked_id_number"],
  ["사번 2019034 초과근무 알려줘", "blocked_id_number"],
  // 보안 검토(M1)로 추가: 전각 숫자·끊어 쓴 숫자·짧은 사번·날짜처럼 보이는 8자리
  ["사번 １２３４５６７ 근무시간", "blocked_id_number"],
  ["123-4567 직원 연차", "blocked_id_number"],
  ["12 34 56 확인", "blocked_id_number"],
  ["사번 12345 초과근무", "blocked_id_number"],
  ["20190315 직원 근무", "blocked_id_number"],
  ["202403 임금 인상률은?", "blocked_id_number"], // 형식 없는 6자리는 사번과 구분할 수 없어 막는다
  // 보안 점검 SEC-03: 날짜처럼 시작하지만 숫자가 더 이어지는 번호
  ["2012-34-5678 직원 연차", "blocked_id_number"],
  ["2019-03-15-1234 근무", "blocked_id_number"],
  ["2024-03-15 기준 인원", "ok"],
  ["2024년 1,923명", "ok"],
  ["2024-03 임금 인상률은?", "ok"],
  ["2024년 3월 15일 기준 인원", "ok"],
  ["2024.03.15 기준 인원", "ok"],
  ["2024년 인력 현황", "ok"],
  ["2022년부터 2026년까지 인원", "ok"],
  ["1,923명에서 2,023명으로 늘었어?", "ok"],
  ["김철수 씨 초과근무는?", "refused_person"],
  ["○○○ 과장 근무시간", "refused_person"],
  ["홍길동님 연차는?", "refused_person"],
  ["누가 제일 많이 일했어?", "refused_person"],
  ["올해 노조 전임자 명단 보여줘", "refused_officers"],
  ["전임자 이름이 뭐야?", "refused_officers"],
  ["전임자 수는 몇 명이야?", "ok"],
  ["전임간부 명단 보여줘", "refused_officers"],
  ["올해 전임간부는 몇 명이야?", "ok"],
  ["간호사 인원은?", "ok"],
  ["올해 직종별 인원은?", "ok"],
  ["차량 지원이 위법 아니야?", "ok+legal"],
];

let fail = 0;
for (const [q, expected] of cases) {
  const r = guardQuestion(q);
  const got = r.kind === "ok" ? (r.legal ? "ok+legal" : "ok") : r.kind;
  const ok = got === expected;
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "❌"} ${q} → ${got}${ok ? "" : ` (기대: ${expected})`}`);
}
if (fail) {
  console.error(`❌ ${fail}건 불일치`);
  process.exit(1);
}
console.log(`✅ 검사 규칙 ${cases.length}건 모두 통과`);

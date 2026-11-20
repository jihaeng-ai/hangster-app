// 원본 대조 확인 (PLAN 작업 11, 성공 기준 S1) — 실행: npm run samples:check
// 샘플 파일을 앱과 같은 코드로 읽어, 만들 때 넣은 값과 하나하나 같은지 비교한다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import { parseFile } from "@/lib/data/store";
import { UnreadableFileError, type DataPoint } from "@/lib/data/types";
import {
  EXCEL_FILE_NAME,
  PDF_FILE_NAME,
  SAMPLE_BASE_DATE,
  ROSTER_EXPECT,
  ROSTER_FILE_NAME,
  UNION_VEHICLES,
  UNION_VOTES,
  VEHICLE_LOG,
  WAGE_INCREASE,
  MEMBERSHIP_EXPECT,
  MEMBERSHIP_FILE_NAME,
} from "./sample-data";

const SAMPLES = path.join(process.cwd(), "data", "samples");
let checked = 0;
const failures: string[] = [];

function expectEqual(label: string, actual: unknown, expected: unknown) {
  checked++;
  if (actual !== expected) failures.push(`${label}: 읽은 값 ${String(actual)} ≠ 원본 ${String(expected)}`);
}

function find(points: DataPoint[], metricId: string, period: string, category: string | null = null) {
  return points.find((p) => p.metricId === metricId && p.period === period && p.category === category);
}

async function expectRejected(label: string, fileName: string, data: Uint8Array) {
  checked++;
  try {
    await parseFile(fileName, data, "test");
    failures.push(`${label}: 거부돼야 하는데 통과함`);
  } catch (err) {
    if (err instanceof UnreadableFileError) console.log(`  ✓ ${label} 거부: ${err.message}`);
    else failures.push(`${label}: 예상과 다른 오류 ${String(err)}`);
  }
}

async function main() {
  // 1) 엑셀
  const excel = await parseFile(EXCEL_FILE_NAME, new Uint8Array(readFileSync(path.join(SAMPLES, EXCEL_FILE_NAME))), "x");
  expectEqual("엑셀 기준일", excel.baseDate, SAMPLE_BASE_DATE);
  for (const [year, rate] of Object.entries(WAGE_INCREASE)) {
    expectEqual(`임금 인상률 ${year}`, find(excel.points, "wage-increase", year)?.value, rate);
  }
  expectEqual("임금 인상률 단위", find(excel.points, "wage-increase", "2026")?.unit, "%");
  expectEqual("가짜 직종별 인력 시트는 없음", excel.points.filter((p) => p.metricId === "workforce").length, 0);

  // 조합원 현황 (사용자 파일, 월별·병원별)
  const mem = await parseFile(MEMBERSHIP_FILE_NAME, new Uint8Array(readFileSync(path.join(SAMPLES, MEMBERSHIP_FILE_NAME))), "m");
  const memPeriods = [...new Set(mem.points.map((p) => p.period))].sort();
  expectEqual("조합원 기간 수", memPeriods.length, MEMBERSHIP_EXPECT.months);
  expectEqual("조합원 첫 달", memPeriods[0], MEMBERSHIP_EXPECT.first);
  expectEqual("조합원 마지막 달", memPeriods.at(-1), MEMBERSHIP_EXPECT.last);
  expectEqual("조합원 기준일", mem.baseDate, MEMBERSHIP_EXPECT.baseDate);
  expectEqual("조합원 값 개수(기간 × 병원 2)", mem.points.length, MEMBERSHIP_EXPECT.months * 2);
  for (const [period, [seoul, guri, total]] of Object.entries(MEMBERSHIP_EXPECT.spot)) {
    const s = find(mem.points, "workforce", period, "서울병원")?.value;
    const g = find(mem.points, "workforce", period, "구리병원")?.value;
    expectEqual(`${period} 서울병원`, s, seoul);
    expectEqual(`${period} 구리병원`, g, guri);
    expectEqual(`${period} 의료원(서울+구리) = 원본 의료원`, (s ?? 0) + (g ?? 0), total);
  }
  for (const [kind, byYear] of Object.entries(UNION_VOTES)) {
    for (const [year, rate] of Object.entries(byYear)) {
      expectEqual(`투표율 ${year} ${kind}`, find(excel.points, "union-votes", year, kind)?.value, rate);
    }
  }
  expectEqual("투표율 단위", find(excel.points, "union-votes", "2026", "임단협 찬반투표")?.unit, "%");
  const vlog = excel.vehicles ?? [];
  expectEqual("차량 지원 내역 건수", vlog.length, VEHICLE_LOG.length);
  for (const [i, v] of VEHICLE_LOG.entries()) {
    expectEqual(`차량 내역 ${i + 1} 일시`, `${vlog[i]?.date} ${vlog[i]?.time}`, v.when);
    expectEqual(`차량 내역 ${i + 1} 장소`, vlog[i]?.place, v.place);
  }
  // 연도별 내역 건수 = PDF 지원 대수 (샘플끼리 앞뒤가 맞는지)
  for (const u of UNION_VEHICLES) {
    if (u.value !== null) expectEqual(`${u.year}년 내역 건수 = 지원 대수`, vlog.filter((v) => v.year === u.year).length, u.value);
  }
  expectEqual("엑셀 샘플에는 전임자 명단 없음", excel.officers.length, 0);

  // 전임간부 명단 (사용자 파일, 기간별)
  const roster = await parseFile(ROSTER_FILE_NAME, new Uint8Array(readFileSync(path.join(SAMPLES, ROSTER_FILE_NAME))), "r");
  expectEqual("명단 전체 행 수", roster.officers.length, ROSTER_EXPECT.total);
  expectEqual("기간 수", new Set(roster.officers.map((o) => `${o.periodStart}~${o.periodEnd}`)).size, ROSTER_EXPECT.periods);
  for (const [key, [paid, unpaid]] of Object.entries(ROSTER_EXPECT.counts)) {
    const inPeriod = roster.officers.filter((o) => `${o.periodStart}~${o.periodEnd}` === key);
    expectEqual(`${key} 유급`, inPeriod.filter((o) => o.group === "유급").length, paid);
    expectEqual(`${key} 무급`, inPeriod.filter((o) => o.group === "무급").length, unpaid);
  }
  const f = roster.officers[0];
  for (const k of ["name", "department", "role", "group", "order"] as const) expectEqual(`첫 사람 ${k}`, f[k], ROSTER_EXPECT.first[k]);
  const { officerCountByYear, toOfficerRow } = await import("@/lib/metrics/series");
  for (const { period, value } of officerCountByYear(roster.officers.map(toOfficerRow))) {
    expectEqual(`${period}년 인원(마지막 기간)`, value, ROSTER_EXPECT.byYear[period]);
  }

  // 2) PDF
  const pdf = await parseFile(PDF_FILE_NAME, new Uint8Array(readFileSync(path.join(SAMPLES, PDF_FILE_NAME))), "p");
  expectEqual("PDF 기준일", pdf.baseDate, SAMPLE_BASE_DATE);
  for (const v of UNION_VEHICLES) {
    const point = find(pdf.points, "union-vehicles", v.year);
    expectEqual(`차량 지원 ${v.year} 값`, point?.value, v.value);
    expectEqual(`차량 지원 ${v.year} 페이지`, point?.source.page, v.page);
  }
  expectEqual("PDF 출처 종류", pdf.points[0]?.source.kind, "pdf");

  // 3) 읽을 수 없는 파일은 거부 (PRD 6장)
  console.log("거부 확인:");
  await expectRejected("텍스트 파일", "메모.txt", new TextEncoder().encode("hello"));
  await expectRejected("이름만 PDF인 파일", "가짜.pdf", new TextEncoder().encode("not a pdf"));
  await expectRejected("예전 엑셀 형식", "옛날.xls", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]));
  const blank = await PDFDocument.create();
  blank.addPage();
  await expectRejected("글자 없는(스캔) PDF", "스캔.pdf", await blank.save());

  // 결과
  console.log(`\n읽은 값: 엑셀 ${excel.points.length + excel.officers.length}개, PDF ${pdf.points.length}개`);
  if (failures.length > 0) {
    console.error(`❌ 불일치 ${failures.length}건 / 확인 ${checked}건`);
    for (const f of failures) console.error("  - " + f);
    process.exit(1);
  }
  console.log(`✅ 원본과 모두 일치 (확인 ${checked}건)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

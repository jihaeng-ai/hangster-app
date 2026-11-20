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
  WAGE_INCREASE,
  WORKFORCE,
  WORKFORCE_JOBS,
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
  for (const [year, byJob] of Object.entries(WORKFORCE)) {
    for (const job of WORKFORCE_JOBS) {
      expectEqual(`인력 ${year} ${job}`, find(excel.points, "workforce", year, job)?.value, byJob[job]);
    }
  }
  for (const [kind, byYear] of Object.entries(UNION_VOTES)) {
    for (const [year, rate] of Object.entries(byYear)) {
      expectEqual(`투표율 ${year} ${kind}`, find(excel.points, "union-votes", year, kind)?.value, rate);
    }
  }
  expectEqual("투표율 단위", find(excel.points, "union-votes", "2026", "임단협 찬반투표")?.unit, "%");
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

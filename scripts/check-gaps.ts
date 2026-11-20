// Gap 분석 높음·중간 4건 수정 확인 — 실행: npm run check:gaps
// 저장소 시험은 임시 폴더에서 하므로 프로젝트의 data/ 폴더를 건드리지 않는다.
import { cpSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { buildAnswer } from "@/lib/ai/answer";
import type { Interpretation } from "@/lib/ai/interpret";
import type { DataPoint } from "@/lib/data/types";
import { getMetric, periodInRange } from "@/lib/metrics/definitions";
import { buildNumericSeries, periodTotal, type DashboardData } from "@/lib/metrics/series";

let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const src = { fileId: "t", fileName: "t.xlsx", baseDate: "2026-10-31", kind: "excel" as const };
const pt = (metricId: DataPoint["metricId"], period: string, category: string | null, value: number | null, unit = "명"): DataPoint =>
  ({ metricId, period, category, value, unit, source: src });

async function xlsx(sheets: Record<string, (string | number)[][]>): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet("정보").addRows([["항목", "값"], ["기준일", "2026-10-31"]]);
  for (const [name, rows] of Object.entries(sheets)) wb.addWorksheet(name).addRows(rows);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

async function main() {
  console.log("== Gap 2·3: 합계 규칙");
  check("sum: 직종이 모두 있으면 합계", periodTotal("sum", [{ category: "의사", value: 10 }, { category: "간호", value: 20 }], ["의사", "간호"]) === 30);
  check("sum: 그해에 직종 하나가 빠지면 null", periodTotal("sum", [{ category: "의사", value: 10 }], ["의사", "간호"]) === null);
  check("sum: 직종 칸이 비었으면 null", periodTotal("sum", [{ category: "의사", value: 10 }, { category: "간호", value: null }], ["의사", "간호"]) === null);
  check("single(%): 직종별 인상률은 더하지 않음 → null", periodTotal("single", [{ category: "의사", value: 3 }, { category: "간호", value: 4 }], ["의사", "간호"]) === null);
  check("single: 구분 없는 값 하나면 그 값", periodTotal("single", [{ category: null, value: 3.1 }], []) === 3.1);

  const s = buildNumericSeries(getMetric("workforce"), [
    pt("workforce", "2025", "의사", 400), pt("workforce", "2025", "간호", 800),
    pt("workforce", "2026", "의사", 410), // 2026년 간호가 빠짐
  ]);
  check("인력 2026년 간호 누락 → 합계 데이터 없음 (작게 계산하지 않음)", s.totals[1].value === null, `2025=${s.totals[0].value}, 2026=${s.totals[1].value}`);

  console.log("\n== Gap 4: 기간 단위·범위");
  check("연도 2024로 물으면 2024-03 포함", periodInRange("2024-03", "2024", "2024"));
  check("연도 2024로 물으면 2025-01 제외", !periodInRange("2025-01", "2024", "2024"));
  const { parseFile } = await import("@/lib/data/store");
  try {
    await parseFile("월섞임.xlsx", await xlsx({ 임금인상률: [["연도", "인상률(%)"], ["2024", 3], ["2024-03", 1]] }), "t");
    check("연도별 지표에 월 기간 → 거부", false, "통과해 버림");
  } catch (e) {
    check("연도별 지표에 월 기간 → 거부", e instanceof Error && e.name === "UnreadableFileError", (e as Error).message);
  }

  const wage = buildNumericSeries(getMetric("wage-increase"), [pt("wage-increase", "2025", null, 3.3, "%"), pt("wage-increase", "2026", null, 3.0, "%")]);
  const data: DashboardData = { series: [{ ...wage, description: [] }], officers: [], officerSources: [], isEmpty: false };
  const interp: Interpretation = { intent: "metric", metricId: "wage-increase", periodFrom: "2026", periodTo: "2026", category: null, recentCount: null, aggregation: "latest" };
  const ans = buildAnswer(interp, data, false);
  check("AI 답변: 2026년 임금 인상률", ans.sentences[0]?.includes("3.0%") ?? false, ans.sentences[0]);

  console.log("\n== S5 추가: 법률 질문 + 데이터 없음 (PRD Must2-5)");
  const legalNoData = buildAnswer({ ...interp, intent: "legal", periodFrom: "2018", periodTo: "2018" }, data, true);
  check(
    "데이터 없음 + 법률 안내 함께",
    legalNoData.status === "no_data" && legalNoData.sentences.some((s) => s.includes("담당자에게 확인")),
    legalNoData.sentences.join(" / "),
  );

  console.log("\n== Gap 1: 바꾸기는 겹치는 값만 교체 (임시 폴더)");
  // 안전장치: 시험 전후로 프로젝트의 실제 data/store.json이 그대로인지 확인한다
  const realStore = path.join(process.cwd(), "data", "store.json");
  const realBefore = existsSync(realStore) ? readFileSync(realStore, "utf8") : null;
  const dir = mkdtempSync(path.join(tmpdir(), "hangster-gap1-"));
  cpSync(path.join(process.cwd(), "data", "samples"), path.join(dir, "data", "samples"), { recursive: true });
  process.chdir(dir);
  const store = await import("@/lib/data/store");
  const before = await store.loadStore();
  const wageOnly = await xlsx({ 임금인상률: [["연도", "인상률(%)"], ["2025", 3.4], ["2026", 3.1]] });
  let conflict = false;
  try { await store.addFile("임금만.xlsx", wageOnly); } catch (e) { conflict = e instanceof store.SamePeriodError; }
  check("같은 기간 → 바꿀지 묻기(409)", conflict);
  const r = await store.addFile("임금만.xlsx", wageOnly, { replace: true });
  const after = await store.loadStore();
  const count = (st: typeof after, id: string) => st.points.filter((p) => p.metricId === id).length;
  check("인력 값 그대로", count(after, "workforce") === count(before, "workforce"), `${count(before, "workforce")} → ${count(after, "workforce")}`);
  check("전임자 명단 그대로", after.officers.length === before.officers.length, `${before.officers.length} → ${after.officers.length}`);
  const w2026 = after.points.filter((p) => p.metricId === "wage-increase" && p.period === "2026");
  check("임금 2026년은 새 값 하나만", w2026.length === 1 && w2026[0].value === 3.1, w2026.map((p) => p.value).join(","));
  check("임금 2019~2024년(겹치지 않음)은 기존 값 유지", after.points.filter((p) => p.metricId === "wage-increase").length === count(before, "wage-increase"));
  const oldFile = after.files.find((f) => f.fileName === "노무현황_샘플.xlsx");
  const oldWage = after.points.filter((p) => p.source.fileId === oldFile?.id && p.metricId === "wage-increase").map((p) => p.period);
  check(
    "기존 엑셀 파일 기록은 남고, 그 파일의 임금 2025·2026년 값만 빠짐",
    Boolean(oldFile) && !oldWage.includes("2025") && !oldWage.includes("2026") && oldWage.includes("2024") && r.replaced.length === 1,
    `기존 파일 임금 기간: ${oldWage.join(",")}`,
  );

  const realAfter = existsSync(realStore) ? readFileSync(realStore, "utf8") : null;
  check("프로젝트의 실제 data/store.json은 그대로", realBefore === realAfter);

  if (fail) {
    console.error(`\n❌ ${fail}건 실패`);
    process.exit(1);
  }
  console.log("\n✅ Gap 4건 수정 확인 모두 통과");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

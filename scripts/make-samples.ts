// 샘플 엑셀·PDF 만들기 (개발용) — 실행: npm run samples:make
// Design Ref: §3.4 — 서버가 확실히 읽을 수 있도록 헤더가 분명한 단순한 표로 만든다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import {
  EXCEL_FILE_NAME,
  PDF_FILE_NAME,
  SAMPLE_BASE_DATE,
  UNION_VEHICLES,
  UNION_VOTES,
  VEHICLE_LOG,
  VEHICLE_LOG_FILE_SHEET,
  WAGE_INCREASE,
  WORKFORCE,
  WORKFORCE_JOBS,
} from "./sample-data";

const OUT_DIR = path.join(process.cwd(), "data", "samples");

// 한글 PDF용 글꼴: 이 PC에 설치된 글꼴을 쓴다 (내려받지 않음)
const FONT_CANDIDATES = [
  "C:/Windows/Fonts/NotoSansKR-VF.ttf",
  "C:/Windows/Fonts/malgun.ttf",
];

async function makeExcel() {
  const wb = new ExcelJS.Workbook();

  const info = wb.addWorksheet("정보");
  info.addRow(["항목", "값"]);
  info.addRow(["기준일", SAMPLE_BASE_DATE]);
  info.addRow(["설명", "실습용 가짜 데이터입니다"]);

  const wage = wb.addWorksheet("임금인상률");
  wage.addRow(["연도", "인상률(%)"]);
  for (const [year, rate] of Object.entries(WAGE_INCREASE)) wage.addRow([year, rate]);

  const workforce = wb.addWorksheet("인력현황");
  workforce.addRow(["연도", "직종", "인원(명)"]);
  for (const [year, byJob] of Object.entries(WORKFORCE)) {
    for (const job of WORKFORCE_JOBS) workforce.addRow([year, job, byJob[job]]);
  }

  // 투표율: 구분(임단협 찬반투표 / 임원(지부장) 선거)마다 한 줄씩 (2026-11-20)
  const votes = wb.addWorksheet("투표율");
  votes.addRow(["연도", "구분", "투표율(%)"]);
  for (const [kind, byYear] of Object.entries(UNION_VOTES)) {
    for (const [year, rate] of Object.entries(byYear)) votes.addRow([year, kind, rate]);
  }

  // 차량 지원 내역: 한 줄 = 버스 한 대 (지원일시·장소, 2026-11-20). 일시는 글자로 넣어 날짜 칸 시간대 문제를 피한다
  const vlog = wb.addWorksheet(VEHICLE_LOG_FILE_SHEET);
  vlog.addRow(["지원일시", "장소"]);
  for (const v of VEHICLE_LOG) vlog.addRow([v.when, v.place]);

  // 전임간부 명단은 이 파일에 넣지 않는다 — data/samples/연도별 전임간부 현황.xlsx(사용자 제공, 기간별 명단)를 쓴다 (2026-11-19)

  for (const ws of wb.worksheets) {
    ws.getRow(1).font = { bold: true };
    ws.columns.forEach((c) => (c.width = 16));
  }

  const file = path.join(OUT_DIR, EXCEL_FILE_NAME);
  await wb.xlsx.writeFile(file);
  console.log(`엑셀 생성: ${file}`);
}

async function makePdf() {
  const fontPath = FONT_CANDIDATES.find((p) => existsSync(p));
  if (!fontPath) throw new Error("한글 글꼴을 찾을 수 없습니다: " + FONT_CANDIDATES.join(", "));

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(readFileSync(fontPath), { subset: true });

  const pages = [...new Set(UNION_VEHICLES.map((v) => v.page))].sort((a, b) => a - b);
  for (const pageNo of pages) {
    const page = pdf.addPage([595, 842]); // A4
    const black = rgb(0, 0, 0);
    let y = 780;
    const line = (text: string, x: number, size = 12) =>
      page.drawText(text, { x, y, size, font, color: black });

    line("[지표] 노동조합 차량 지원 현황", 60, 16);
    y -= 28;
    line(`기준일: ${SAMPLE_BASE_DATE}`, 60);
    y -= 18;
    line("※ 실습용 가짜 데이터입니다", 60, 10);
    y -= 36;

    // 표 헤더
    line("연도", 60);
    line("지원 대수(대)", 200);
    y -= 6;
    page.drawLine({ start: { x: 55, y }, end: { x: 360, y }, thickness: 0.8, color: black });
    y -= 20;

    for (const row of UNION_VEHICLES.filter((v) => v.page === pageNo)) {
      line(row.year, 60);
      line(row.value === null ? "-" : String(row.value), 200);
      y -= 22;
    }

    y = 60;
    line(`- ${pageNo} -`, 280, 10);
  }

  const file = path.join(OUT_DIR, PDF_FILE_NAME);
  writeFileSync(file, await pdf.save());
  console.log(`PDF 생성: ${file} (글꼴: ${path.basename(fontPath)})`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  await makeExcel();
  await makePdf();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

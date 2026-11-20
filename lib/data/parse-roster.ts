// 전임간부 명단(기간별 표) 읽기 — 예: "연도별 전임간부 현황.xlsx"
// 시트 하나에 여러 기간이 가로·세로로 놓인 양식:
//   [기준일 : 2021.03.01. ~ 2021.04.15.]  ← 기간 머리글 (병합 셀)
//   [유급근로시간면제 전임간부]          ← 구분 (유급 / 무급)
//   [순번 | 이름 | 소속 | 직책]           ← 표 머리글
//   [1 | 장동건 | 서울/간호직 | 지부장]   ← 전임간부
// 실습 데이터는 가짜 이름이다. AI 질문으로는 다루지 않는다 (PRD Must2-3)
import "server-only";
import type ExcelJS from "exceljs";
import { normalizeLabel, toDateString, toNumber } from "./cells";
import type { UnionOfficer } from "./types";

/** 읽은 전임간부 (출처는 parse-excel에서 붙인다) */
export type RosterEntry = Omit<UnionOfficer, "source">;

const PERIOD_HEADER = /기준일\s*[:：]\s*(\d{4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2})\.?\s*~\s*(\d{4}\s*[./-]\s*\d{1,2}\s*[./-]\s*\d{1,2})\.?/;
/** 기간 블록 하나가 차지하는 가로 칸 수 (순번·이름·소속·직책 + 여유) */
const BLOCK_WIDTH = 5;

function text(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return String(v.result ?? "").trim();
    if ("richText" in v) return v.richText.map((t) => t.text).join("").trim();
    if ("text" in v) return String(v.text).trim();
  }
  return String(v).trim();
}

const toDate = (raw: string) => toDateString(raw.replace(/\s+/g, ""));

/** 시트에서 기간별 전임간부를 읽는다. 이 양식이 아니면 빈 배열 */
export function readRosterSheet(ws: ExcelJS.Worksheet): RosterEntry[] {
  const rows = ws.rowCount;
  const cols = ws.columnCount;
  const at = (r: number, c: number) => (r >= 1 && c >= 1 && r <= rows && c <= cols ? text(ws.getRow(r).getCell(c)) : "");

  // 1) 기간 머리글 찾기 — 병합 셀은 같은 글자가 옆 칸에 반복되므로 맨 왼쪽 칸만 쓴다
  const blocks: { row: number; col: number; start: string; end: string }[] = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const t = at(r, c);
      const m = t.match(PERIOD_HEADER);
      if (!m || at(r, c - 1) === t) continue;
      const start = toDate(m[1]);
      const end = toDate(m[2]);
      if (start && end) blocks.push({ row: r, col: c, start, end });
    }
  }

  const entries: RosterEntry[] = [];
  for (const block of blocks) {
    // 같은 열 아래쪽에 다음 기간 머리글이 있으면 그 앞줄까지만 이 기간이다
    const nextRow = blocks.filter((b) => b.col === block.col && b.row > block.row).map((b) => b.row).sort((a, b) => a - b)[0];
    const lastRow = (nextRow ?? rows + 1) - 1;

    let group: "유급" | "무급" | undefined;
    let colOf: { order: number; name: number; dept: number; role: number } | null = null;

    for (let r = block.row + 1; r <= lastRow; r++) {
      const cells = Array.from({ length: BLOCK_WIDTH }, (_, i) => at(r, block.col + i));
      const joined = normalizeLabel(cells.join(""));

      // 구분 줄: "유급근로시간면제 전임간부" / "무급 전임간부"
      if (joined.includes("전임간부") && !joined.includes("이름")) {
        group = joined.includes("무급") ? "무급" : "유급";
        colOf = null;
        continue;
      }
      // 표 머리글: 순번 | 이름 | 소속 | 직책
      const nameIdx = cells.findIndex((c) => normalizeLabel(c) === "이름");
      if (nameIdx >= 0) {
        const find = (label: string) => cells.findIndex((c) => normalizeLabel(c) === label);
        colOf = { order: find("순번"), name: nameIdx, dept: find("소속"), role: find("직책") };
        continue;
      }
      if (!colOf) continue;

      const name = cells[colOf.name] ?? "";
      if (!name) continue; // 빈 줄
      entries.push({
        year: block.start.slice(0, 4),
        name,
        department: (colOf.dept >= 0 ? cells[colOf.dept] : "") || "데이터 없음",
        role: (colOf.role >= 0 ? cells[colOf.role] : "") || undefined,
        group,
        order: colOf.order >= 0 ? (toNumber(cells[colOf.order]) ?? undefined) : undefined,
        periodStart: block.start,
        periodEnd: block.end,
      });
    }
  }
  return entries;
}

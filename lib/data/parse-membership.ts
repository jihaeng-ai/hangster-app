// 조합원 현황(월별·병원별 표) 읽기 — 예: "연도별 조합원 현황.xlsx" (사용자 제공, 2026-11-20)
// 시트 하나 = 한 해:
//   [2021년 조합원 현황]                                   ← 제목 (병합 셀, 연도를 여기서 읽는다)
//   [구 분 | 서울병원 | 구리병원 | 의료원 (서울+구리)]     ← 병원 머리글 (병합 셀)
//   [구 분 | 조합원수 | 조합원수 | 총 조합원수]
//   [3월 | 1519 | 825 | 2344]                              ← 월별 값
// 의료원 = 서울병원 + 구리병원 (의료원 산하에 두 병원). 의료원 값은 원본 칸과 두 병원 합이 같은지 확인만 하고,
// 저장은 병원별 값으로 한다 (합계는 화면에서 sum 규칙으로 만든다 — 원본 의료원 값과 같음을 확인했으므로).
import "server-only";
import type ExcelJS from "exceljs";
import { normalizeLabel, toNumber } from "./cells";
import { UnreadableFileError } from "./types";

export interface MembershipEntry {
  period: string; // "2021-03"
  hospital: string; // "서울병원"
  value: number | null;
}

const TITLE = /(\d{4})\s*년.*조합원/;
const MONTH = /^(\d{1,2})\s*월$/;
/** 합계 칸으로 보는 머리글 (의료원 = 서울+구리) */
const TOTAL_HEADER = /의료원|합계|총계|전체/;

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

function raw(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  return v && typeof v === "object" && !(v instanceof Date) && "result" in v ? v.result : v;
}

/** 이 양식이 아니면 null, 맞으면 읽은 값 (합계가 안 맞으면 이유와 함께 거부) */
export function readMembershipSheet(ws: ExcelJS.Worksheet): MembershipEntry[] | null {
  // 1) 제목에서 연도 (없으면 시트 이름 "2021년")
  let year: string | null = null;
  for (let r = 1; r <= Math.min(3, ws.rowCount) && !year; r++) {
    const m = text(ws.getRow(r).getCell(1)).match(TITLE);
    if (m) year = m[1];
  }
  if (!year) return null;

  // 2) 병원 머리글 줄: 첫 칸이 "구분"이고, 병원 이름이 있는 줄
  let headerRow = 0;
  for (let r = 1; r <= Math.min(8, ws.rowCount) && !headerRow; r++) {
    const row = ws.getRow(r);
    if (normalizeLabel(text(row.getCell(1))) !== "구분") continue;
    for (let c = 2; c <= ws.columnCount; c++) if (/병원/.test(text(row.getCell(c)))) headerRow = r;
  }
  if (!headerRow) return null;

  // 병합 셀은 같은 글자가 여러 칸에 나오므로 이름마다 첫 칸만 쓴다
  const hospitals: { name: string; col: number }[] = [];
  let totalCol = 0;
  const seen = new Set<string>();
  for (let c = 2; c <= ws.columnCount; c++) {
    const name = text(ws.getRow(headerRow).getCell(c));
    const key = normalizeLabel(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    if (TOTAL_HEADER.test(name)) totalCol = c;
    else hospitals.push({ name: name.replace(/\s+/g, ""), col: c });
  }
  if (hospitals.length === 0) return null;

  // 3) 월별 값
  const entries: MembershipEntry[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const m = text(row.getCell(1)).match(MONTH);
    if (!m) continue;
    const month = Number(m[1]);
    if (month < 1 || month > 12) continue;
    const period = `${year}-${String(month).padStart(2, "0")}`;
    const values = hospitals.map((h) => ({ hospital: h.name, value: toNumber(raw(row.getCell(h.col))) }));
    // 의료원 칸이 있으면 두 병원 합과 같은지 확인 (다르면 어느 쪽이 맞는지 모르므로 파일을 거부한다)
    if (totalCol) {
      const total = toNumber(raw(row.getCell(totalCol)));
      const allPresent = values.every((v) => v.value !== null);
      const sum = values.reduce((s, v) => s + (v.value ?? 0), 0);
      if (total !== null && allPresent && total !== sum) {
        throw new UnreadableFileError(
          `'${ws.name}' 시트 ${month}월: 의료원 ${total}명이 ${hospitals.map((h) => h.name).join("+")} 합 ${sum}명과 다릅니다. 원본을 확인해 주세요.`,
        );
      }
    }
    for (const v of values) entries.push({ period, ...v });
  }
  return entries.length > 0 ? entries : null;
}

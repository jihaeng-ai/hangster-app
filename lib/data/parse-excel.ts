// Design Ref: §8.2 — 서버에서 엑셀을 공통 데이터 형식(DataPoint)으로 바꾼다
import "server-only";
import ExcelJS from "exceljs";
import { findMetricBySheetName, periodMatchesUnit } from "@/lib/metrics/definitions";
import { normalizeLabel, toDateString, toNumber, toPeriod } from "./cells";
import { readMembershipSheet, type MembershipEntry } from "./parse-membership";
import { readRosterSheet, type RosterEntry } from "./parse-roster";
import {
  UnreadableFileError,
  type DataPoint,
  type ParsedFile,
  type SourceRef,
  type UnionOfficer,
  type VehicleSupport,
} from "./types";

/** 헤더 이름으로 열을 찾을 때 쓰는 이름들 */
const PERIOD_HEADERS = ["연도", "년도", "기간", "연월", "월"];
const CATEGORY_HEADERS = ["직종", "항목", "구분", "부서"];
const NAME_HEADERS = ["이름", "성명"];
const DEPT_HEADERS = ["부서", "소속"];
/** 차량 지원 내역 시트 (2026-11-20): 시트 이름과 열 이름 */
const VEHICLE_LOG_SHEETS = ["차량지원내역", "차량지원일지", "노조차량지원내역"];
const WHEN_HEADERS = ["지원일시", "일시", "지원일", "날짜", "일자"];
const PLACE_HEADERS = ["장소", "지원장소", "행선지", "목적지"];

/** 일시 셀 → 날짜·시각. 날짜 셀이면 그대로, 글자면 "2026-03-15 09:00", "2026.3.15. 09:00" 같은 모양을 읽는다 */
function readWhen(v: unknown): { date: string; time: string | null } | null {
  const pad = (n: string | number) => String(n).padStart(2, "0");
  if (v instanceof Date) {
    const iso = v.toISOString(); // exceljs 날짜는 화면에 보이는 시각을 UTC로 담는다
    const time = iso.slice(11, 16);
    return { date: iso.slice(0, 10), time: time === "00:00" ? null : time };
  }
  const m = String(v ?? "").match(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*[.일]?\s*(?:\([^)]*\))?\s*(?:(\d{1,2})\s*:\s*(\d{2}))?/);
  if (!m) return null;
  return { date: `${m[1]}-${pad(m[2])}-${pad(m[3])}`, time: m[4] ? `${pad(m[4])}:${m[5]}` : null };
}

/** 셀 값 → 글자 (수식이면 계산 결과, 서식 있는 글자면 이어 붙임) */
function cellValue(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return v.result;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
  }
  return v;
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cellValue(cell);
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** 1행(헤더)에서 이름이 맞는 열 번호를 찾는다 */
function findColumn(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) =>
    candidates.some((c) => normalizeLabel(h).startsWith(normalizeLabel(c))),
  );
}

/** "인원(명)" → "명", "인상률(%)" → "%" */
function unitFromHeader(header: string): string | null {
  return header.match(/\(([^)]+)\)\s*$/)?.[1] ?? null;
}

/** 정보 시트에서 기준일을 찾는다 */
function findBaseDate(wb: ExcelJS.Workbook): string | null {
  for (const ws of wb.worksheets) {
    let found: string | null = null;
    ws.eachRow((row) => {
      if (found) return;
      if (normalizeLabel(cellText(row.getCell(1))) === "기준일") {
        found = toDateString(cellValue(row.getCell(2)));
      }
    });
    if (found) return found;
  }
  return null;
}

export async function parseExcel(data: Uint8Array, file: { id: string; name: string }): Promise<ParsedFile> {
  const wb = new ExcelJS.Workbook();
  try {
    // exceljs 타입은 Node Buffer를 기대한다
    await wb.xlsx.load(Buffer.from(data) as unknown as ExcelJS.Buffer);
  } catch {
    throw new UnreadableFileError("엑셀 파일을 열 수 없습니다. 손상됐거나 .xlsx 형식이 아닙니다.");
  }

  // 기간별 전임간부 명단 양식(시트마다 "기준일 : ~" 머리글)이 있으면 먼저 읽어 둔다
  const rosterSheets = new Set<string>();
  const roster: RosterEntry[] = [];
  for (const ws of wb.worksheets) {
    const entries = readRosterSheet(ws);
    if (entries.length > 0) {
      rosterSheets.add(ws.name);
      roster.push(...entries);
    }
  }

  // 월별·병원별 조합원 현황 양식(시트마다 "YYYY년 조합원 현황" 제목)도 먼저 읽어 둔다 (2026-11-20)
  const membershipSheets = new Set<string>();
  const membership: MembershipEntry[] = [];
  for (const ws of wb.worksheets) {
    if (rosterSheets.has(ws.name)) continue;
    const entries = readMembershipSheet(ws);
    if (entries) {
      membershipSheets.add(ws.name);
      membership.push(...entries);
    }
  }

  // 기준일: '정보' 시트, 없으면 명단의 가장 늦은 기간 끝날, 그것도 없으면 조합원 현황의 마지막 달 말일
  const rosterEnd = roster.map((e) => e.periodEnd ?? "").sort().at(-1) || null;
  const lastMonth = membership.map((e) => e.period).sort().at(-1);
  const membershipEnd = lastMonth
    ? `${lastMonth}-${String(new Date(Date.UTC(Number(lastMonth.slice(0, 4)), Number(lastMonth.slice(5, 7)), 0)).getUTCDate()).padStart(2, "0")}`
    : null;
  const baseDate = findBaseDate(wb) ?? rosterEnd ?? membershipEnd;
  if (!baseDate) {
    throw new UnreadableFileError("기준일을 찾을 수 없습니다. '정보' 시트에 '기준일' 행을 넣어 주세요.");
  }
  const source: SourceRef = { fileId: file.id, fileName: file.name, baseDate, kind: "excel" };

  const points: DataPoint[] = [];
  const officers: UnionOfficer[] = roster.map((e) => ({ ...e, source }));
  const vehicles: VehicleSupport[] = [];
  // 조합원 현황: 병원별 값을 "노동조합 조합원 현황"(workforce) 지표의 구분 값으로 넣는다 (의료원 = 합계)
  for (const e of membership) {
    points.push({ metricId: "workforce", period: e.period, category: e.hospital, value: e.value, unit: "명", source });
  }

  for (const ws of wb.worksheets) {
    if (rosterSheets.has(ws.name)) continue; // 명단 시트는 위에서 읽었다
    if (membershipSheets.has(ws.name)) continue; // 조합원 현황 시트도 위에서 읽었다

    // 차량 지원 내역 시트: 지원일시 · 장소 (한 줄 = 버스 한 대)
    if (VEHICLE_LOG_SHEETS.includes(normalizeLabel(ws.name))) {
      const head: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) head.push(cellText(ws.getRow(1).getCell(c)));
      const whenCol = findColumn(head, WHEN_HEADERS);
      const placeCol = findColumn(head, PLACE_HEADERS);
      if (whenCol < 0 || placeCol < 0) {
        throw new UnreadableFileError(`'${ws.name}' 시트에서 '지원일시'와 '장소' 열을 찾을 수 없습니다. 1행 헤더를 확인해 주세요.`);
      }
      ws.eachRow((row, rowNo) => {
        if (rowNo === 1) return;
        const rawWhen = cellValue(row.getCell(whenCol + 1));
        const place = cellText(row.getCell(placeCol + 1));
        if ((rawWhen === null || rawWhen === undefined || rawWhen === "") && !place) return; // 빈 줄
        const when = readWhen(rawWhen);
        if (!when) {
          throw new UnreadableFileError(`'${ws.name}' 시트 ${rowNo}행의 지원일시를 읽을 수 없습니다. 2026-03-15 09:00처럼 적어 주세요.`);
        }
        vehicles.push({ year: when.date.slice(0, 4), date: when.date, time: when.time, place: place || "데이터 없음", source });
      });
      continue;
    }
    const metric = findMetricBySheetName(ws.name);
    if (!metric) continue; // 알아보지 못한 시트는 건너뛴다

    const headerRow = ws.getRow(1);
    const headers: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) headers.push(cellText(headerRow.getCell(c)));

    const periodCol = findColumn(headers, PERIOD_HEADERS);
    if (periodCol < 0) continue;

    // 전임자 명단 시트: 연도·이름·부서
    if (metric.id === "union-officers") {
      const nameCol = findColumn(headers, NAME_HEADERS);
      const deptCol = findColumn(headers, DEPT_HEADERS);
      if (nameCol < 0 || deptCol < 0) continue;
      ws.eachRow((row, rowNo) => {
        if (rowNo === 1) return;
        const year = toPeriod(cellValue(row.getCell(periodCol + 1)));
        const name = cellText(row.getCell(nameCol + 1));
        const department = cellText(row.getCell(deptCol + 1));
        if (year && name) {
          // 전임자 명단은 연도별 (Gap 4)
          if (!periodMatchesUnit(year, "year")) {
            const period = year;
            throw new UnreadableFileError(`${metric.label}은(는) ${metric.periodUnit === "year" ? "연도별" : "월별"} 지표인데 '${period}' 같은 기간이 있습니다. 기간을 ${metric.periodUnit === "year" ? "2024처럼 연도로" : "2024-03처럼 연-월로"} 적어 주세요.`);
          }
          officers.push({ year, name, department: department || "데이터 없음", source });
        }
      });
      continue;
    }

    // 숫자 지표 시트: 기간 · (구분) · 값
    const categoryCol = findColumn(headers, CATEGORY_HEADERS);
    const valueCol = headers.findIndex((_, i) => i !== periodCol && i !== categoryCol && headers[i] !== "");
    if (valueCol < 0) continue;
    const unit = unitFromHeader(headers[valueCol]) ?? metric.unit;

    ws.eachRow((row, rowNo) => {
      if (rowNo === 1) return;
      const period = toPeriod(cellValue(row.getCell(periodCol + 1)));
      if (!period) return; // 기간이 없는 줄(합계·메모 등)은 건너뛴다
      // 지표의 기간 단위(연/월)와 다르면 섞지 않고 파일 전체를 거부한다 (Gap 4)
      if (!periodMatchesUnit(period, metric.periodUnit)) {
        throw new UnreadableFileError(`${metric.label}은(는) ${metric.periodUnit === "year" ? "연도별" : "월별"} 지표인데 '${period}' 같은 기간이 있습니다. 기간을 ${metric.periodUnit === "year" ? "2024처럼 연도로" : "2024-03처럼 연-월로"} 적어 주세요.`);
      }
      points.push({
        metricId: metric.id,
        period,
        category: categoryCol >= 0 ? cellText(row.getCell(categoryCol + 1)) || null : null,
        value: toNumber(cellValue(row.getCell(valueCol + 1))),
        unit,
        source,
      });
    });
  }

  if (points.length === 0 && officers.length === 0 && vehicles.length === 0) {
    throw new UnreadableFileError(
      "알아볼 수 있는 지표 시트가 없습니다. 시트 이름(예: 임금인상률, 인력현황, 전임자)과 1행 헤더를 확인해 주세요.",
    );
  }

  return { kind: "excel", baseDate, points, officers, vehicles };
}

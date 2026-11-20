// Design Ref: §8.3 — 서버 안에서만 PDF 표의 숫자를 읽는다 (PRD Must1-10)
import "server-only";
import { extractTextItems, getDocumentProxy } from "unpdf";
import { findMetricByPdfTitle, periodMatchesUnit, type MetricDefinition } from "@/lib/metrics/definitions";
import { toDateString, toNumber, toPeriod } from "./cells";
import { UnreadableFileError, type DataPoint, type ParsedFile, type SourceRef } from "./types";

/** 같은 줄로 볼 y 좌표 차이 */
const LINE_TOLERANCE = 2;

/** 한 페이지의 글자 조각을 줄 단위(왼쪽→오른쪽 칸 목록)로 묶는다 */
function toLines(items: { str: string; x: number; y: number }[]): string[][] {
  const rows: { y: number; cells: { x: number; str: string }[] }[] = [];
  for (const item of items) {
    const str = item.str.trim();
    if (!str) continue;
    let row = rows.find((r) => Math.abs(r.y - item.y) <= LINE_TOLERANCE);
    if (!row) {
      row = { y: item.y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ x: item.x, str });
  }
  return rows
    .sort((a, b) => b.y - a.y) // 위쪽 줄부터
    .map((r) => r.cells.sort((a, b) => a.x - b.x).map((c) => c.str));
}

export async function parsePdf(data: Uint8Array, file: { id: string; name: string }): Promise<ParsedFile> {
  let pages: { str: string; x: number; y: number }[][];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(data));
    pages = (await extractTextItems(pdf)).items;
  } catch {
    throw new UnreadableFileError("PDF 파일을 열 수 없습니다. 손상됐거나 암호가 걸려 있습니다.");
  }

  // 글자가 하나도 없으면 스캔한 이미지 PDF로 본다
  if (pages.every((items) => items.every((i) => !i.str.trim()))) {
    throw new UnreadableFileError("글자를 읽을 수 없는 PDF(스캔 이미지)입니다. 글자가 들어 있는 PDF를 올려 주세요.");
  }

  const points: DataPoint[] = [];
  let baseDate: string | null = null;
  // 지표 제목은 다음 페이지로 이어질 수 있으므로 페이지를 넘어 유지한다
  let metric: MetricDefinition | undefined;
  let pageBaseDate: string | null = null;

  pages.forEach((items, index) => {
    const pageNo = index + 1;
    for (const cells of toLines(items)) {
      const text = cells.join(" ");

      const title = text.match(/^\[지표\]\s*(.+)$/);
      if (title) {
        metric = findMetricByPdfTitle(title[1]);
        continue;
      }
      const date = text.match(/^기준일\s*[:：]\s*(.+)$/);
      if (date) {
        pageBaseDate = toDateString(date[1]);
        baseDate ??= pageBaseDate;
        continue;
      }

      // 표 줄: [기간, 값] 또는 [기간, 구분, 값]
      if (!metric || metric.id === "union-officers" || !pageBaseDate) continue;
      const period = toPeriod(cells[0]);
      if (!period || cells.length < 2 || cells.length > 3) continue;
      // 지표의 기간 단위(연/월)와 다르면 섞지 않고 파일 전체를 거부한다 (Gap 4)
      if (!periodMatchesUnit(period, metric.periodUnit)) {
        throw new UnreadableFileError(`${metric.label}은(는) ${metric.periodUnit === "year" ? "연도별" : "월별"} 지표인데 '${period}' 같은 기간이 있습니다. 기간을 ${metric.periodUnit === "year" ? "2024처럼 연도로" : "2024-03처럼 연-월로"} 적어 주세요.`);
      }

      const source: SourceRef = {
        fileId: file.id,
        fileName: file.name,
        baseDate: pageBaseDate,
        kind: "pdf",
        page: pageNo,
      };
      points.push({
        metricId: metric.id,
        period,
        category: cells.length === 3 ? cells[1] : null,
        // 확실히 숫자가 아니면 null → 차트에 넣지 않고 "데이터 없음" (PRD Must1-10)
        value: toNumber(cells[cells.length - 1]),
        unit: metric.unit,
        source,
      });
    }
  });

  if (!baseDate) {
    throw new UnreadableFileError("기준일을 찾을 수 없습니다. PDF에 '기준일: YYYY-MM-DD' 줄을 넣어 주세요.");
  }
  if (points.length === 0) {
    throw new UnreadableFileError(
      "알아볼 수 있는 지표 표가 없습니다. '[지표] 지표 이름' 제목과 '연도 | 값' 표가 있는지 확인해 주세요.",
    );
  }

  return { kind: "pdf", baseDate, points, officers: [] };
}

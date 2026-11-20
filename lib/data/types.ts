// Design Ref: §3.1 — 모든 숫자는 이 공통 형식(DataPoint)으로만 다룬다

/** 지표 ID — 첫 화면 핵심 지표 (최대 6개까지 늘릴 수 있음) */
export type MetricId =
  | "wage-increase" // 연도별 임금 인상률
  | "workforce" // 노동조합 조합원 현황 (예전 이름: 의료원 인력 현황)
  | "union-officers" // 노동조합 전임자 현황
  | "union-vehicles" // 노동조합 차량 지원 현황
  | "union-votes"; // 노동조합 투표율 (임단협 찬반투표 / 임원 선거, 2026-11-20)

/** 기간: 연도별 "2024", 월별 "2024-03" */
export type Period = string;

export type FileKind = "excel" | "pdf";

/** 값의 출처 — 모든 차트에 기준 날짜와 파일 이름을 표시하기 위해 값마다 붙인다 */
export interface SourceRef {
  fileId: string;
  fileName: string;
  /** 기준 날짜 "2026-10-31" */
  baseDate: string;
  kind: FileKind;
  /** PDF일 때 원본 페이지 번호 ("PDF 추출" 표시용) */
  page?: number;
}

/** 모든 숫자의 공통 형식 */
export interface DataPoint {
  metricId: MetricId;
  period: Period;
  /** 직종·항목 구분 (없으면 null = 전체) */
  category: string | null;
  /** 못 읽은 값은 null → 화면에 "데이터 없음" (PRD Must1-1: 추정 금지) */
  value: number | null;
  unit: string;
  source: SourceRef;
}

/** 노동조합 전임자 명단 — 대시보드 버튼으로만 열람, AI 질문 대상 아님 (PRD Must2-3) */
export interface UnionOfficer {
  year: string;
  /** 실습에서는 가짜 이름 */
  name: string;
  /** 소속 (예: "서울/간호직") */
  department: string;
  source: SourceRef;
  /** 재직 기간 — 같은 해에도 기간마다 전임간부가 바뀐다. 기간 정보가 없는 명단은 그해 1월 1일~12월 31일 */
  periodStart?: string; // "2021-03-01"
  periodEnd?: string; // "2021-04-15"
  /** 유급근로시간면제 전임간부 / 무급 전임간부 */
  group?: "유급" | "무급";
  /** 직책 (예: 지부장, 수석부지부장) */
  role?: string;
  /** 원본 순번 (조직도 순서) */
  order?: number;
}

/** 노동조합 차량 지원 내역 한 건 — 상세 화면에서 버스 픽토그램 밑에 일시·장소를 적는다 (2026-11-20) */
export interface VehicleSupport {
  /** 지원 날짜의 연도 (연도 버튼용) */
  year: string;
  /** "2026-03-15" */
  date: string;
  /** "09:00" (원본에 시각이 없으면 null) */
  time: string | null;
  place: string;
  source: SourceRef;
}

/** 올라온 파일 기록 */
export interface StoredFile {
  id: string;
  fileName: string;
  kind: FileKind;
  uploadedAt: string;
  baseDate: string;
  metricIds: MetricId[];
  /** 같은 기간 판정에 사용 */
  periods: Period[];
  /** data/ 기준 상대 경로 (예: "uploads/abc.xlsx", "samples/노무현황_샘플.xlsx") */
  storedPath: string;
}

/** 화면으로 보내는 파일 정보 — 서버 안의 저장 경로는 빼고 보낸다 (보안 검토 L5) */
export type PublicFile = Omit<StoredFile, "storedPath">;

export function toPublicFile(file: StoredFile): PublicFile {
  const { id, fileName, kind, uploadedAt, baseDate, metricIds, periods } = file;
  return { id, fileName, kind, uploadedAt, baseDate, metricIds, periods };
}

/** 저장소 전체 (data/store.json) */
export interface Store {
  files: StoredFile[];
  points: DataPoint[];
  officers: UnionOfficer[];
  /** 차량 지원 내역 (이 기능 전에 만든 store.json에는 없을 수 있다) */
  vehicles?: VehicleSupport[];
}

/** 파일 하나를 읽은 결과 (저장 전) */
export interface ParsedFile {
  kind: FileKind;
  baseDate: string;
  points: DataPoint[];
  officers: UnionOfficer[];
  vehicles?: VehicleSupport[];
}

/** 파일을 읽을 수 없을 때 던지는 오류 — 사용자에게 보여줄 이유를 담는다 */
export class UnreadableFileError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "UnreadableFileError";
  }
}

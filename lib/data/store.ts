// Design Ref: §3.3 — 로컬 data/ 폴더 저장소 (2026-11-19 확정)
//   data/samples/  미리 넣는 샘플 (커밋함)
//   data/uploads/  담당자가 올린 원본 (커밋 안 함)
//   data/store.json 읽은 결과 (커밋 안 함)
import "server-only";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseExcel } from "./parse-excel";
import { parsePdf } from "./parse-pdf";
import { UnreadableFileError, type ParsedFile, type Store, type StoredFile } from "./types";
import { detectFileKind } from "./validate-file";

// 경로는 쓸 때마다 계산한다 (모듈을 불러온 시점의 폴더에 고정되지 않게 — 확인 스크립트가 임시 폴더에서 돌 수 있도록)
const dataDir = () => path.join(process.cwd(), "data");
const samplesDir = () => path.join(dataDir(), "samples");
const uploadsDir = () => path.join(dataDir(), "uploads");
const storeFile = () => path.join(dataDir(), "store.json");

/** Vercel 배포본은 서버에 파일을 계속 저장할 수 없으므로 샘플만 읽는다 (PRD 6장) */
export function isReadOnly(): boolean {
  return Boolean(process.env.VERCEL);
}

/** 같은 지표·같은 기간 데이터가 이미 있을 때 — 화면이 "바꿀까요?" 확인창을 띄운다 */
export class SamePeriodError extends Error {
  constructor(public readonly existingFiles: StoredFile[]) {
    super("이미 같은 기간 데이터가 있습니다. 바꿀까요?");
    this.name = "SamePeriodError";
  }
}

export class ReadOnlyError extends Error {
  constructor() {
    super("배포본에서는 업로드할 수 없습니다.");
    this.name = "ReadOnlyError";
  }
}

export class FileNotFoundError extends Error {
  constructor() {
    super("파일을 찾을 수 없습니다.");
    this.name = "FileNotFoundError";
  }
}

/** 파일 종류에 맞는 방법으로 읽는다 */
export async function parseFile(fileName: string, data: Uint8Array, id: string): Promise<ParsedFile> {
  const kind = detectFileKind(fileName, data);
  return kind === "excel" ? parseExcel(data, { id, name: fileName }) : parsePdf(data, { id, name: fileName });
}

/** 읽은 결과에 들어 있는 "지표|기간" 목록 — 같은 기간 판정에 쓴다 */
function periodKeys(parsed: Pick<Store, "points" | "officers">): Set<string> {
  const keys = new Set(parsed.points.map((p) => `${p.metricId}|${p.period}`));
  for (const o of parsed.officers) keys.add(`union-officers|${o.year}`);
  return keys;
}

function toStoredFile(id: string, fileName: string, parsed: ParsedFile, storedPath: string): StoredFile {
  const metricIds = new Set(parsed.points.map((p) => p.metricId));
  if (parsed.officers.length > 0) metricIds.add("union-officers");
  const periods = new Set([...parsed.points.map((p) => p.period), ...parsed.officers.map((o) => o.year)]);
  return {
    id,
    fileName,
    kind: parsed.kind,
    uploadedAt: new Date().toISOString(),
    baseDate: parsed.baseDate,
    metricIds: [...metricIds],
    periods: [...periods].sort(),
    storedPath,
  };
}

/** data/samples/의 파일로 처음 저장소를 만든다 */
async function buildFromSamples(): Promise<Store> {
  const store: Store = { files: [], points: [], officers: [] };
  if (!existsSync(samplesDir())) return store;
  const names = (await readdir(samplesDir())).filter((n) => /\.(xlsx|pdf)$/i.test(n)).sort();
  for (const [i, name] of names.entries()) {
    const id = `sample-${i + 1}`;
    const parsed = await parseFile(name, new Uint8Array(await readFile(path.join(samplesDir(), name))), id);
    store.files.push(toStoredFile(id, name, parsed, `samples/${name}`));
    store.points.push(...parsed.points);
    store.officers.push(...parsed.officers);
  }
  return store;
}

let readOnlyCache: Promise<Store> | null = null;

/** 저장소 읽기 */
export async function loadStore(): Promise<Store> {
  if (isReadOnly()) {
    readOnlyCache ??= buildFromSamples();
    return readOnlyCache;
  }
  if (existsSync(storeFile())) {
    return JSON.parse(await readFile(storeFile(), "utf8")) as Store;
  }
  const store = await buildFromSamples();
  await saveStore(store);
  return store;
}

/** 중간에 끊겨도 파일이 깨지지 않도록 임시 파일에 쓴 뒤 이름을 바꾼다 */
async function saveStore(store: Store): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  const tmp = `${storeFile()}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(store, null, 2), "utf8");
  await rename(tmp, storeFile());
}

/** 쓰기 작업은 한 번에 하나씩 처리한다 (동시에 올려도 store.json이 꼬이지 않게) */
let writeQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.catch(() => undefined);
  return run;
}

/** 원본 파일 지우기 — 샘플 파일은 디스크에서 지우지 않는다 */
async function removeOriginal(file: StoredFile): Promise<void> {
  if (file.storedPath.startsWith("uploads/")) {
    await rm(path.join(dataDir(), file.storedPath), { force: true });
  }
}

function withoutFile(store: Store, fileId: string): Store {
  return {
    files: store.files.filter((f) => f.id !== fileId),
    points: store.points.filter((p) => p.source.fileId !== fileId),
    officers: store.officers.filter((o) => o.source.fileId !== fileId),
  };
}

/** 한 파일의 값 중 겹치는 "지표|기간" 값만 뺀다 */
function withoutKeys(store: Store, fileId: string, keys: Set<string>): Store {
  return {
    files: store.files,
    points: store.points.filter((p) => p.source.fileId !== fileId || !keys.has(`${p.metricId}|${p.period}`)),
    officers: store.officers.filter((o) => o.source.fileId !== fileId || !keys.has(`union-officers|${o.year}`)),
  };
}

/** 남은 값으로 파일 기록의 지표·기간 목록을 다시 계산한다 */
function summarizeKeys(rest: Pick<Store, "points" | "officers">): Pick<StoredFile, "metricIds" | "periods"> {
  const metricIds = new Set(rest.points.map((p) => p.metricId));
  if (rest.officers.length > 0) metricIds.add("union-officers");
  const periods = new Set([...rest.points.map((p) => p.period), ...rest.officers.map((o) => o.year)]);
  return { metricIds: [...metricIds], periods: [...periods].sort() };
}

export interface AddFileResult {
  file: StoredFile;
  pointCount: number;
  missingCount: number;
  replaced: StoredFile[];
}

/**
 * 파일 올리기 (PRD 6장)
 * - 읽을 수 없으면 UnreadableFileError → 기존 데이터 그대로
 * - 같은 기간이 있고 replace가 아니면 SamePeriodError
 * - replace면 기존 파일에서 겹치는 지표·기간 값만 새 파일 값으로 교체 (나머지는 유지)
 */
export function addFile(fileName: string, data: Uint8Array, options: { replace?: boolean } = {}): Promise<AddFileResult> {
  return serialize(async () => {
    if (isReadOnly()) throw new ReadOnlyError();

    const id = randomUUID();
    const parsed = await parseFile(fileName, data, id); // 실패하면 여기서 끝 (저장소는 건드리지 않음)
    let store = await loadStore();

    const newKeys = periodKeys(parsed);
    const conflicts = store.files.filter((f) => {
      const keys = periodKeys(withoutOthers(store, f.id));
      return [...keys].some((k) => newKeys.has(k));
    });
    if (conflicts.length > 0 && !options.replace) throw new SamePeriodError(conflicts);

    // 바꾸기: 기존 파일에서 "새 파일과 겹치는 지표·기간"의 값만 지운다 (Gap 1)
    // 겹치지 않는 값(예: 다른 지표, 다른 연도)은 그대로 남기고, 남는 값이 없을 때만 기존 파일을 지운다
    for (const old of conflicts) {
      store = withoutKeys(store, old.id, newKeys);
      const remaining = withoutOthers(store, old.id);
      if (remaining.points.length === 0 && remaining.officers.length === 0) {
        store = withoutFile(store, old.id);
        await removeOriginal(old);
      } else {
        store.files = store.files.map((f) => (f.id === old.id ? { ...f, ...summarizeKeys(remaining) } : f));
      }
    }

    const ext = parsed.kind === "excel" ? "xlsx" : "pdf";
    const storedPath = `uploads/${id}.${ext}`; // 원래 이름 대신 ID로 저장 (경로 조작 방지)
    await mkdir(uploadsDir(), { recursive: true });
    await writeFile(path.join(dataDir(), storedPath), data);

    const stored = toStoredFile(id, fileName, parsed, storedPath);
    store.files.push(stored);
    store.points.push(...parsed.points);
    store.officers.push(...parsed.officers);
    await saveStore(store);

    return {
      file: stored,
      pointCount: parsed.points.length + parsed.officers.length,
      missingCount: parsed.points.filter((p) => p.value === null).length,
      replaced: conflicts,
    };
  });
}

/** 한 파일의 값만 남긴 저장소 (같은 기간 판정용) */
function withoutOthers(store: Store, fileId: string): Pick<Store, "points" | "officers"> {
  return {
    points: store.points.filter((p) => p.source.fileId === fileId),
    officers: store.officers.filter((o) => o.source.fileId === fileId),
  };
}

/** 파일 삭제 — 되살리는 기능은 없다 (PRD 6장) */
export function deleteFile(fileId: string): Promise<StoredFile> {
  return serialize(async () => {
    if (isReadOnly()) throw new ReadOnlyError();
    const store = await loadStore();
    const target = store.files.find((f) => f.id === fileId);
    if (!target) throw new FileNotFoundError();
    await saveStore(withoutFile(store, fileId));
    await removeOriginal(target);
    return target;
  });
}

export { UnreadableFileError };

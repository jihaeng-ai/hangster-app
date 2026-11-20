// Design Ref: §7 — 업로드 파일 검사: 확장자와 파일 앞부분 서명을 둘 다 확인한다
import "server-only";
import { UnreadableFileError, type FileKind } from "./types";

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

/** 엑셀(xlsx)·PDF인지 확인하고 종류를 돌려준다. 아니면 이유와 함께 거부한다. */
export function detectFileKind(fileName: string, data: Uint8Array): FileKind {
  if (data.byteLength === 0) throw new UnreadableFileError("빈 파일입니다.");
  if (data.byteLength > MAX_FILE_BYTES) {
    throw new UnreadableFileError("파일이 너무 큽니다. 10MB 이하로 올려 주세요.");
  }

  const ext = fileName.toLowerCase().split(".").pop();
  const head = new TextDecoder("latin1").decode(data.subarray(0, 5));

  if (ext === "xlsx" && head.startsWith("PK")) return "excel"; // xlsx는 zip 형식
  if (ext === "pdf" && head.startsWith("%PDF")) return "pdf";

  if (ext === "xls") {
    throw new UnreadableFileError("예전 엑셀 형식(.xls)은 읽을 수 없습니다. .xlsx로 저장해 올려 주세요.");
  }
  if (ext === "xlsx" || ext === "pdf") {
    throw new UnreadableFileError("파일 이름은 엑셀·PDF지만 내용이 맞지 않습니다. 파일이 손상됐을 수 있습니다.");
  }
  throw new UnreadableFileError("엑셀(.xlsx)이나 PDF 파일만 올릴 수 있습니다.");
}

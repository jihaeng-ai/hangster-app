// 파일 목록·올리기 API (PLAN 작업 23·24) — 담당자만 (Design §4.2)
import { revalidateTag } from "next/cache";
import { apiError, checkApiAccess } from "@/lib/auth/session";
import { addFile, loadStore, ReadOnlyError, SamePeriodError, UnreadableFileError } from "@/lib/data/store";
import { toPublicFile } from "@/lib/data/types";
import { MAX_FILE_BYTES } from "@/lib/data/validate-file";
import { DATASET_TAG } from "@/lib/metrics/series";

export async function GET() {
  const access = await checkApiAccess("manager");
  if (!access.ok) return access.response;

  const store = await loadStore();
  const files = [...store.files].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).map(toPublicFile);
  return Response.json({ data: { files } });
}

export async function POST(request: Request) {
  const access = await checkApiAccess("manager");
  if (!access.ok) return access.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError(400, "VALIDATION_ERROR", "파일을 받지 못했습니다. 다시 올려 주세요.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError(400, "VALIDATION_ERROR", "올릴 파일을 골라 주세요.");
  }
  if (file.size > MAX_FILE_BYTES) {
    return apiError(400, "UNREADABLE_FILE", "파일이 너무 큽니다. 10MB 이하로 올려 주세요.");
  }
  const replace = form.get("replace") === "true";

  try {
    const result = await addFile(file.name, new Uint8Array(await file.arrayBuffer()), { replace });
    // 대시보드가 바로 새 값을 보여주도록 캐시를 즉시 비운다
    revalidateTag(DATASET_TAG, { expire: 0 });
    return Response.json(
      {
        data: {
          file: toPublicFile(result.file),
          pointCount: result.pointCount,
          missingCount: result.missingCount,
          replaced: result.replaced.map((f) => f.fileName),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof SamePeriodError) {
      return apiError(409, "SAME_PERIOD", err.message, {
        existingFiles: err.existingFiles.map((f) => ({ id: f.id, fileName: f.fileName, periods: f.periods })),
      });
    }
    // 읽을 수 없는 파일은 거부하고 기존 데이터는 그대로 둔다 (PRD 6장)
    if (err instanceof UnreadableFileError) return apiError(400, "UNREADABLE_FILE", err.message);
    if (err instanceof ReadOnlyError) return apiError(403, "READ_ONLY", err.message);
    console.error("[upload] 처리 중 오류", err instanceof Error ? err.message : err);
    return apiError(500, "INTERNAL", "잠시 후 다시 시도해 주세요.");
  }
}

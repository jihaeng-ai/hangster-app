// 파일 삭제 API (PLAN 작업 25) — 담당자만, 되살리기 없음 (PRD 6장)
import { revalidateTag } from "next/cache";
import { apiError, checkApiAccess } from "@/lib/auth/session";
import { deleteFile, FileNotFoundError, ReadOnlyError } from "@/lib/data/store";
import { DATASET_TAG } from "@/lib/metrics/series";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/files/[id]">) {
  const access = await checkApiAccess("manager");
  if (!access.ok) return access.response;

  const { id } = await ctx.params;
  try {
    const deleted = await deleteFile(id);
    revalidateTag(DATASET_TAG, { expire: 0 });
    return Response.json({ data: { deletedFileId: deleted.id, fileName: deleted.fileName } });
  } catch (err) {
    if (err instanceof FileNotFoundError) return apiError(404, "NOT_FOUND", err.message);
    if (err instanceof ReadOnlyError) return apiError(403, "READ_ONLY", err.message);
    console.error("[delete] 처리 중 오류", err instanceof Error ? err.message : err);
    return apiError(500, "INTERNAL", "잠시 후 다시 시도해 주세요.");
  }
}

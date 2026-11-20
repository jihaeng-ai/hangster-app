import type { Metadata } from "next";
import { Suspense } from "react";
import { UploadPanel } from "@/components/UploadPanel";
import { requireRole } from "@/lib/auth/session";
import { isReadOnly, loadStore } from "@/lib/data/store";
import { toPublicFile } from "@/lib/data/types";

export const metadata: Metadata = { title: "파일 관리" };

// 파일 관리 화면 (PLAN 작업 23~25) — 담당자 전용
export default function UploadPage() {
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold text-white">파일 관리</h1>
        <p className="mt-1 text-sm text-navy-mist">
          엑셀·PDF를 올리면 대시보드에 바로 반영됩니다. 수정은 파일 단위(올리기·바꾸기·지우기)로만 합니다.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" aria-hidden />}>
        <UploadContent />
      </Suspense>
    </>
  );
}

async function UploadContent() {
  // 경영진이 들어오면 첫 화면으로 돌려보낸다 (서버에서 역할 재확인)
  await requireRole("manager");
  const store = await loadStore();
  const files = [...store.files].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).map(toPublicFile);
  // 네이비 바탕 위에서 읽히도록 흰 네모 안에 넣는다
  return (
    <div className="rounded-xl bg-white p-5 dark:bg-zinc-900">
      <UploadPanel files={files} readOnly={isReadOnly()} />
    </div>
  );
}

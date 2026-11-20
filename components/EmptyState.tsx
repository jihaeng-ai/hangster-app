// 데이터가 하나도 없을 때 안내 (PRD Must1-13) — 담당자에게는 업로드 버튼도 보여준다
import Link from "next/link";
import type { Role } from "@/lib/auth/seal";

export const EMPTY_MESSAGE = "아직 올라온 데이터가 없습니다. 담당자에게 문의하세요";

export function EmptyState({ role, message = EMPTY_MESSAGE }: { role: Role; message?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-zinc-600 dark:text-zinc-400">{message}</p>
      {role === "manager" && (
        <Link href="/upload" className="rounded-md bg-navy px-4 py-2 font-semibold text-white hover:bg-navy-dark">
          파일 올리기
        </Link>
      )}
    </div>
  );
}

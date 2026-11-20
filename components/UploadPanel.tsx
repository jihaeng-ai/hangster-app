"use client";
// 파일 관리: 올리기·같은 기간 교체·삭제 (PLAN 작업 23~25)
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { PublicFile } from "@/lib/data/types";
import { ConfirmDialog } from "./ConfirmDialog";

type Notice = { kind: "success" | "error"; text: string } | null;

interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: { existingFiles?: { fileName: string }[] } };
}

export function UploadPanel({ files, readOnly }: { files: PublicFile[]; readOnly: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [replaceAsk, setReplaceAsk] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PublicFile | null>(null);

  async function upload(replace: boolean) {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    const form = new FormData();
    form.append("file", selected);
    if (replace) form.append("replace", "true");

    try {
      const res = await fetch("/api/files", { method: "POST", body: form });
      const body = await res.json();
      if (res.status === 409) {
        // 같은 기간 데이터가 있으면 바꿀지 묻는다
        const names = (body as ApiErrorBody).error?.details?.existingFiles?.map((f) => f.fileName).join(", ");
        setReplaceAsk(`이미 같은 기간 데이터가 있습니다. 바꿀까요?\n\n기존 파일: ${names ?? "-"}\n바꾸면 겹치는 지표·기간의 값만 새 파일 값으로 교체되고, 기존 파일의 나머지 값은 그대로 남습니다.`);
        return;
      }
      if (!res.ok) {
        // 읽을 수 없는 파일 등 — 이유를 보여주고 기존 데이터는 그대로
        setNotice({ kind: "error", text: (body as ApiErrorBody).error?.message ?? "올리지 못했습니다." });
        return;
      }
      const { pointCount, missingCount, replaced } = body.data as { pointCount: number; missingCount: number; replaced: string[] };
      setNotice({
        kind: "success",
        text:
          `${selected.name}을(를) 올렸습니다. 읽은 값 ${pointCount}개` +
          (missingCount > 0 ? `, 데이터 없음 ${missingCount}개` : "") +
          (replaced.length > 0 ? ` (교체: ${replaced.join(", ")})` : ""),
      });
      setSelected(null);
      setReplaceAsk(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  }

  async function remove(file: PublicFile) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(file.id)}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        setNotice({ kind: "error", text: (body as ApiErrorBody).error?.message ?? "삭제하지 못했습니다." });
        return;
      }
      setNotice({ kind: "success", text: `${file.fileName}을(를) 삭제했습니다.` });
      router.refresh();
    } catch {
      setNotice({ kind: "error", text: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setBusy(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {readOnly ? (
        <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          배포본에서는 업로드할 수 없습니다. 파일 올리기는 내 PC에서 실행할 때만 할 수 있습니다.
        </p>
      ) : (
        <form
          className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
          onSubmit={(e) => {
            e.preventDefault();
            void upload(false);
          }}
        >
          <label className="flex flex-col gap-2 text-sm font-medium">
            엑셀(.xlsx) 또는 PDF 파일 (10MB 이하)
            <input
              ref={inputRef}
              type="file"
              name="file"
              accept=".xlsx,.pdf"
              onChange={(e) => setSelected(e.target.files?.[0] ?? null)}
              className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-2 dark:file:bg-zinc-800"
            />
          </label>
          <button
            type="submit"
            disabled={!selected || busy}
            className="w-fit rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:bg-navy-dark disabled:opacity-50"
          >
            {busy ? "올리는 중…" : "올리기"}
          </button>
        </form>
      )}

      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`rounded-lg p-3 text-sm ${
            notice.kind === "error"
              ? "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200"
              : "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          }`}
        >
          {notice.text}
        </p>
      )}

      <section aria-label="올라온 파일 목록" className="flex flex-col gap-2">
        <h2 className="font-semibold">올라온 파일 ({files.length}개)</h2>
        {files.length === 0 ? (
          <p className="text-sm text-zinc-500">아직 올라온 파일이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-700">
                  <th className="px-2 py-2">파일 이름</th>
                  <th className="px-2 py-2">종류</th>
                  <th className="px-2 py-2">기준일</th>
                  <th className="px-2 py-2">기간</th>
                  <th className="px-2 py-2">올린 시각</th>
                  <th className="px-2 py-2"><span className="sr-only">삭제</span></th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-2 py-2">{f.fileName}</td>
                    <td className="px-2 py-2">{f.kind === "excel" ? "엑셀" : "PDF"}</td>
                    <td className="px-2 py-2 tabular-nums">{f.baseDate}</td>
                    <td className="px-2 py-2 tabular-nums">
                      {f.periods.length > 0 ? `${f.periods[0]}~${f.periods[f.periods.length - 1]}` : "-"}
                    </td>
                    <td className="px-2 py-2 tabular-nums">{new Date(f.uploadedAt).toLocaleString("ko-KR")}</td>
                    <td className="px-2 py-2 text-right">
                      {!readOnly && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setDeleteTarget(f)}
                          className="rounded-md px-3 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950"
                        >
                          삭제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={replaceAsk !== null}
        title="같은 기간 데이터가 있습니다"
        message={replaceAsk ?? ""}
        confirmLabel="바꾸기"
        busy={busy}
        onConfirm={() => void upload(true)}
        onCancel={() => setReplaceAsk(null)}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        title="파일 삭제"
        message={`${deleteTarget?.fileName ?? ""}\n\n삭제한 파일은 되살릴 수 없습니다. 삭제할까요?`}
        confirmLabel="삭제"
        danger
        busy={busy}
        onConfirm={() => deleteTarget && void remove(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

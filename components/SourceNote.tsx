// 기준 날짜·출처 파일·"PDF 추출 p.N" 표시 (PRD Must1-5, 10)
import type { SourceSummary } from "@/lib/metrics/series";

export function SourceNote({ sources }: { sources: SourceSummary[] }) {
  if (sources.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-xs text-zinc-500 dark:text-zinc-400">
      {sources.map((s) => (
        <li key={`${s.fileName}-${s.baseDate}`} className="flex flex-wrap items-center gap-x-2">
          <span>기준일 {s.baseDate}</span>
          <span aria-hidden>·</span>
          <span>출처 {s.fileName}</span>
          {s.kind === "pdf" && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              PDF 추출{s.pages.length > 0 ? ` · p.${s.pages.join(", ")}` : ""}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

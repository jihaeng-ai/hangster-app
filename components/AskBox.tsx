"use client";
// AI에게 말로 묻기 (PLAN 작업 26) — 답변 3문장 + 근거 + 차트 + 자세히 보기
import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { AskResponse } from "@/lib/ai/answer";
import { EXAMPLE_QUESTIONS } from "@/lib/ai/examples";
import { MetricChart } from "./charts/MetricChart";

/** children: 질문창 위에 함께 넣을 제목 등 (첫 화면의 "노무 현황 요약"을 같은 네모 안에 넣기 위해) */
export function AskBox({ children }: { children?: ReactNode }) {
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [answer, setAnswer] = useState<AskResponse | null>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setQuestion(q);
    setPending(true);
    setAnswer(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      if (res.status === 429) {
        // 질문 횟수 한도를 넘음 (보안 점검 SEC-02) — 서버가 보낸 안내 문구를 그대로 보여준다
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setAnswer({
          status: "rate_limited",
          sentences: [body?.error?.message ?? "질문이 너무 많습니다. 잠시 후 다시 물어봐 주세요."],
        });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setAnswer((await res.json()) as AskResponse);
    } catch {
      // 연결 실패도 "이해하지 못했습니다" 안내로 — 대시보드는 계속 쓸 수 있다 (PRD Must2-9)
      setAnswer({
        status: "not_understood",
        sentences: ["질문을 이해하지 못했습니다. 아래 예시처럼 물어보시거나, 대시보드의 지표 버튼을 눌러 확인해 주세요."],
        examples: EXAMPLE_QUESTIONS,
      });
    } finally {
      setPending(false);
    }
  }

  const refused = answer && answer.status !== "answered";

  return (
    <section aria-label="AI에게 묻기" className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      {children}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
      >
        <label htmlFor="ask-input" className="sr-only">궁금한 것을 물어보세요</label>
        <input
          id="ask-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={200}
          placeholder="궁금한 것을 물어보세요 (예: 의료원 조합원은 몇 명이야?)"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className="shrink-0 rounded-md bg-navy px-4 py-2 font-semibold text-white hover:bg-navy-dark disabled:opacity-50"
        >
          {pending ? "찾는 중…" : "질문"}
        </button>
      </form>

      {/* 보안 점검 SEC-03: 질문 문장은 외부 AI로 가므로 개인정보를 넣지 않도록 안내 */}
      <p className="text-xs text-zinc-500">
        개인 이름·사번·주민번호는 넣지 마세요. 질문은 병원·부서 단위로 해 주세요.
      </p>
      {!answer && !pending && <Examples onPick={(q) => void ask(q)} />}
      {pending && <p className="text-sm text-zinc-500" role="status">올라온 데이터에서 답을 찾고 있습니다…</p>}

      {answer && (
        <div className="flex flex-col gap-3" role="status">
          <div className={`rounded-lg p-3 text-sm leading-6 ${refused ? "bg-amber-50 text-amber-950 dark:bg-amber-950/50 dark:text-amber-100" : "bg-zinc-50 dark:bg-zinc-950"}`}>
            {answer.sentences.map((s) => (
              <p key={s}>{s}</p>
            ))}
            {answer.basis && (
              <p className="mt-2 text-xs text-zinc-500">
                근거: {answer.basis.metricLabel} · 기준일 {answer.basis.baseDates.join(", ")} · 출처 {answer.basis.fileNames.join(", ")}
                {answer.basis.pdf && " · PDF 추출 포함"}
              </p>
            )}
          </div>
          {answer.chart && (
            <MetricChart
              chart={answer.chart.chart}
              unit={answer.chart.unit}
              rows={answer.chart.rows}
              categories={answer.chart.categories}
              label={answer.chart.label}
            />
          )}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {answer.link && (
              <Link href={answer.link} className="font-medium text-navy hover:underline dark:text-navy-mist">
                자세히 보기 →
              </Link>
            )}
            {answer.status === "not_understood" && <span className="text-zinc-500">아래 카드를 눌러 지표를 직접 볼 수도 있습니다.</span>}
          </div>
          {answer.examples && <Examples onPick={(q) => void ask(q)} />}
        </div>
      )}
    </section>
  );
}

function Examples({ onPick }: { onPick: (q: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <span className="text-zinc-500">예시:</span>
      {EXAMPLE_QUESTIONS.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => onPick(q)}
          className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {q}
        </button>
      ))}
    </div>
  );
}

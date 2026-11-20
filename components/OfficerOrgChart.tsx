"use client";
// 노동조합 전임간부 조직도 (PRD Must1-12)
// 연도 버튼 → 그해의 기간 버튼(같은 해에도 기간마다 전임간부가 바뀐다) → 그 기간의 조직도
// 조직도: 맨 위 "전임간부 · 기간 · N명" → 유급근로시간면제 / 무급 갈래 → 연두색 조끼 사람 픽토그램 + 직책·이름·소속 (순번 1번을 위에, 2026-11-20)
// 실습 데이터는 가짜 이름. AI 질문으로는 다루지 않고 이 화면에서만 본다 (PRD Must2-3)
import { useState } from "react";
import type { OfficerRow } from "@/lib/metrics/series";
import { PersonIcon } from "./PersonIcon";

const dot = (d: string) => d.replaceAll("-", ".");
const short = (d: string) => d.slice(5).replace("-", "."); // "2021-03-01" → "03.01"

const GROUP_LABEL: Record<string, string> = {
  유급: "유급근로시간면제 전임간부",
  무급: "무급 전임간부",
  기타: "전임간부",
};

function periodsOf(officers: OfficerRow[], year: string) {
  const keys = [...new Set(officers.filter((o) => o.year === year).map((o) => `${o.periodStart}|${o.periodEnd}`))].sort();
  return keys.map((k) => {
    const [start, end] = k.split("|");
    return { key: k, start, end, count: officers.filter((o) => o.periodStart === start && o.periodEnd === end).length };
  });
}

export function OfficerOrgChart({ officers }: { officers: OfficerRow[] }) {
  const years = [...new Set(officers.map((o) => o.year))].sort();
  const latestYear = years[years.length - 1] ?? "";
  const [year, setYear] = useState(latestYear);
  const [periodKey, setPeriodKey] = useState(periodsOf(officers, latestYear).at(-1)?.key ?? "");

  if (years.length === 0) return <p className="text-sm text-zinc-500">데이터 없음</p>;

  const periods = periodsOf(officers, year);
  const current = periods.find((p) => p.key === periodKey) ?? periods[periods.length - 1];
  const members = officers
    .filter((o) => o.periodStart === current.start && o.periodEnd === current.end)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const groups = (["유급", "무급", "기타"] as const)
    .map((g) => ({ g, people: members.filter((m) => (m.group ?? "기타") === g) }))
    .filter((x) => x.people.length > 0);

  const chooseYear = (y: string) => {
    setYear(y);
    setPeriodKey(periodsOf(officers, y).at(-1)?.key ?? ""); // 그해 마지막 기간을 먼저 보여준다
  };

  const pill = (selected: boolean) =>
    `rounded-full border px-4 py-1.5 text-sm font-medium transition ${
      selected
        ? "border-navy bg-navy text-white"
        : "border-zinc-300 bg-white text-zinc-700 hover:border-navy hover:text-navy dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
    }`;

  return (
    <section aria-label="전임간부 조직도" className="flex flex-col gap-4">
      {/* 1단계: 연도 */}
      <div role="tablist" aria-label="연도 선택" className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">연도</span>
        {years.map((y) => (
          <button key={y} type="button" role="tab" aria-selected={y === year} onClick={() => chooseYear(y)} className={pill(y === year)}>
            {y}년
          </button>
        ))}
      </div>

      {/* 2단계: 그해의 기간 */}
      <div role="tablist" aria-label={`${year}년 기간 선택`} className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
        <span className="mr-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">기간</span>
        {periods.map((p) => {
          const selected = p.key === current.key;
          return (
            <button key={p.key} type="button" role="tab" aria-selected={selected} onClick={() => setPeriodKey(p.key)} className={pill(selected)}>
              {short(p.start)} ~ {short(p.end)} <span className={selected ? "text-navy-mist" : "text-zinc-400"}>({p.count}명)</span>
            </button>
          );
        })}
      </div>

      {/* 3단계: 조직도 */}
      <div role="tabpanel" aria-label={`${dot(current.start)} ~ ${dot(current.end)} 조직도`} className="flex flex-col items-center pt-2">
        <div className="rounded-lg bg-navy px-6 py-3 text-center text-white shadow-sm">
          <div className="font-semibold">노동조합 전임간부</div>
          <div className="text-sm text-navy-mist">
            {dot(current.start)} ~ {dot(current.end)} · {members.length}명
          </div>
        </div>
        <div className="h-6 w-px bg-zinc-300 dark:bg-zinc-600" aria-hidden />

        <ul className="flex w-full flex-wrap justify-center gap-x-6 gap-y-8 pt-6">
          {groups.map(({ g, people }, i) => (
            <li key={g} className="relative flex min-w-64 flex-1 flex-col items-center sm:max-w-md">
              {/* 연결선: 가로선은 첫 갈래~마지막 갈래 사이에만 */}
              {i > 0 && <div className="absolute -top-6 -left-3 right-1/2 h-px bg-zinc-300 dark:bg-zinc-600" aria-hidden />}
              {i < groups.length - 1 && <div className="absolute -top-6 left-1/2 -right-3 h-px bg-zinc-300 dark:bg-zinc-600" aria-hidden />}
              <div className="absolute -top-6 h-6 w-px bg-zinc-300 dark:bg-zinc-600" aria-hidden />

              <div className="w-full rounded-t-lg border border-navy/30 bg-navy-soft px-4 py-2 text-center text-sm font-semibold text-navy dark:border-navy-mist/30 dark:bg-zinc-800 dark:text-navy-mist">
                {GROUP_LABEL[g]} <span className="font-normal text-zinc-500">({people.length}명)</span>
              </div>
              {/* 갈래 안의 작은 조직도: 순번 1번(예: 지부장)을 위에 크게, 나머지는 아래 줄에 */}
              <div className="flex w-full flex-col items-center rounded-b-lg border border-t-0 border-zinc-200 bg-white px-3 pt-4 pb-3 dark:border-zinc-700 dark:bg-zinc-900">
                <PersonCard person={people[0]} lead />
                {people.length > 1 && (
                  <>
                    <div className="h-4 w-px bg-zinc-300 dark:bg-zinc-600" aria-hidden />
                    <ul className="flex w-full flex-wrap justify-center gap-x-2 gap-y-3 border-t border-dashed border-zinc-200 pt-3 dark:border-zinc-700">
                      {people.slice(1).map((p) => (
                        <li key={`${p.periodStart}-${p.group}-${p.order}-${p.name}`}>
                          <PersonCard person={p} />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** 사람 한 명: 연두색 조끼 픽토그램 + 직책 + 이름 + 소속 */
function PersonCard({ person, lead = false }: { person: OfficerRow; lead?: boolean }) {
  return (
    <div className={`flex flex-col items-center text-center ${lead ? "w-32" : "w-24"}`}>
      <PersonIcon size={lead ? 64 : 48} />
      <span
        className={`mt-1 rounded-full px-2 py-0.5 font-semibold ${
          lead ? "bg-navy text-xs text-white" : "bg-navy-soft text-[11px] text-navy dark:bg-zinc-800 dark:text-navy-mist"
        }`}
      >
        {person.role ?? "직책 없음"}
      </span>
      <span className={`mt-1 font-semibold ${lead ? "text-base" : "text-sm"}`}>{person.name}</span>
      <span className="text-[11px] text-zinc-500">{person.department}</span>
    </div>
  );
}

// 성공 기준 측정 (PLAN 작업 31, S2·S3·S4) — 실행 중인 서버에 대표 질문 10개를 보내고 시간을 잰다
// 실행: npm run check:success            (기본 http://localhost:3000)
//       npm run check:success -- http://localhost:3002
// 경영진 세션 쿠키는 .env의 AUTH_SECRET으로 이 스크립트가 직접 만든다 (비밀번호 불필요).
import { sealSession } from "@/lib/auth/seal";

const BASE = process.argv[2] ?? "http://localhost:3000";
const PAGE_LIMIT_MS = 3000; // PRD Must1-4
const ASK_LIMIT_MS = 10000; // PRD Must2-4

/** 대표 질문 10개 — 기대 답은 샘플 데이터(scripts/sample-data.ts)에서 계산한 값 */
const QUESTIONS: { q: string; expect: string; page: string; pageText: string }[] = [
  { q: "올해 임금 인상률은?", expect: "3.0%", page: "/", pageText: "3.0%" },
  { q: "임금 인상률이 가장 높았던 해는?", expect: "2022년", page: "/metrics/wage-increase", pageText: "2022년(4.0%)" },
  { q: "올해 전체 조합원은 몇 명이야?", expect: "2,023명", page: "/", pageText: "2,023명" },
  { q: "올해 직종별 조합원 중 가장 많은 직종은?", expect: "간호(812명)", page: "/metrics/workforce", pageText: "812명" },
  { q: "조합원은 작년보다 얼마나 늘었어?", expect: "32명", page: "/metrics/workforce", pageText: "32명(1.6%) 증가" },
  { q: "올해 노조 전임자는 몇 명이야?", expect: "9명", page: "/", pageText: "9명" }, // 2024년 마지막 기간(02.16~02.29) 유급 6 + 무급 3
  { q: "노조 차량 지원은 작년보다 늘었어?", expect: "1대(25.0%) 증가", page: "/metrics/union-vehicles", pageText: "1대(25.0%) 증가" },
  { q: "2024년 노조 차량 지원 대수는?", expect: "데이터 없음", page: "/metrics/union-vehicles", pageText: "2024년 값은 원본에서 확인되지 않아" }, // 버스 화면은 최근 연도를 먼저 보여주므로 변화 설명 문장으로 확인 (2026-11-20)
  { q: "2023년 간호 조합원은 몇 명이야?", expect: "781명", page: "/metrics/workforce", pageText: "781명" },
  { q: "최근 5년 임금 인상률 추이는?", expect: "2022년~2026년", page: "/metrics/wage-increase", pageText: "2022년" },
];

const PAGES = ["/", "/metrics/wage-increase", "/metrics/workforce", "/metrics/union-officers", "/metrics/union-vehicles", "/metrics/union-votes"];

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t = performance.now();
  const r = await fn();
  return [r, Math.round(performance.now() - t)];
}

async function main() {
  const cookie = `hangster_session=${await sealSession({ role: "executive" })}`;
  const get = (path: string) => fetch(BASE + path, { headers: { cookie } }).then(async (r) => ({ status: r.status, html: await r.text() }));

  console.log(`대상: ${BASE}\n`);
  console.log("## S4 화면 응답 시간 (서버 응답 기준, 2회 중 느린 값)\n");
  console.log("| 화면 | 상태 | 시간 | 3초 이내 |\n|---|---|---|---|");
  let pageFail = 0;
  for (const path of PAGES) {
    const [[a, ta], [b, tb]] = [await timed(() => get(path)), await timed(() => get(path))];
    const ms = Math.max(ta, tb);
    const ok = a.status === 200 && b.status === 200 && ms <= PAGE_LIMIT_MS;
    if (!ok) pageFail++;
    console.log(`| ${path} | ${b.status} | ${ms}ms | ${ok ? "✅" : "❌"} |`);
  }

  console.log("\n## S2·S3 대표 질문 10개\n");
  console.log("| # | 질문 | AI 답에 기대값 | AI 시간 | 대시보드(버튼 1번)에서 찾음 |\n|---|---|---|---|---|");
  let aiOk = 0;
  let dashOk = 0;
  let slowest = 0;
  for (const [i, item] of QUESTIONS.entries()) {
    const [res, ms] = await timed(() =>
      fetch(BASE + "/api/ask", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ question: item.q }),
      }).then((r) => r.json() as Promise<{ status: string; sentences: string[] }>),
    );
    slowest = Math.max(slowest, ms);
    const aiHit = res.status === "answered" && res.sentences.join(" ").includes(item.expect) && ms <= ASK_LIMIT_MS;
    const page = await get(item.page);
    const dashHit = page.status === 200 && page.html.includes(item.pageText);
    if (aiHit) aiOk++;
    if (dashHit) dashOk++;
    console.log(`| ${i + 1} | ${item.q} | ${aiHit ? "✅" : `❌ (${res.status}: ${res.sentences?.[0] ?? ""})`} | ${ms}ms | ${dashHit ? `✅ ${item.page}` : `❌ ${item.page}`} |`);
  }

  console.log(`\n- AI 정답: ${aiOk}/10, 가장 느린 답: ${slowest}ms (기준 10초)`);
  console.log(`- 대시보드에서 찾음: ${dashOk}/10 (기준 8개 이상)`);
  console.log(`- 화면 3초 초과: ${pageFail}개`);
  if (pageFail > 0 || dashOk < 8) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

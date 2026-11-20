// AI 질문 횟수 제한 확인 (보안 점검 SEC-02) — 실행: npm run check:ratelimit
import { PER_DAY_TOTAL, PER_MINUTE, resetRateLimit, takeQuestionSlot } from "@/lib/ai/rate-limit";

let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) fail++;
  console.log(`${ok ? "✓" : "❌"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const t0 = 1_000_000_000_000;

// 1) 한 사람: 1분에 10번까지, 11번째는 거절
resetRateLimit();
let okCount = 0;
for (let i = 0; i < PER_MINUTE; i++) if (takeQuestionSlot("executive|1.1.1.1", t0 + i * 1000).ok) okCount++;
check(`1분에 ${PER_MINUTE}번까지 통과`, okCount === PER_MINUTE, `${okCount}번 통과`);
const over = takeQuestionSlot("executive|1.1.1.1", t0 + 15_000);
check("11번째는 거절(1분 한도)", !over.ok && over.reason === "minute", JSON.stringify(over));

// 2) 다른 사람은 따로 센다
check("다른 사람은 바로 통과", takeQuestionSlot("manager|2.2.2.2", t0 + 15_000).ok);

// 3) 1분이 지나면 다시 통과
check("1분 지나면 다시 통과", takeQuestionSlot("executive|1.1.1.1", t0 + 61_000).ok);

// 4) 전체 하루 한도
resetRateLimit();
let total = 0;
for (let i = 0; i < PER_DAY_TOTAL; i++) if (takeQuestionSlot(`user|${i}`, t0 + i).ok) total++;
const dayOver = takeQuestionSlot("user|new", t0 + PER_DAY_TOTAL + 1);
check(`하루 전체 ${PER_DAY_TOTAL}번까지 통과`, total === PER_DAY_TOTAL, `${total}번`);
check("하루 한도를 넘으면 거절", !dayOver.ok && dayOver.reason === "day");
check("24시간 지나면 다시 통과", takeQuestionSlot("user|new", t0 + 24 * 60 * 60_000 + 10).ok);

if (fail) {
  console.error(`❌ ${fail}건 실패`);
  process.exit(1);
}
console.log("✅ 질문 횟수 제한 확인 모두 통과");

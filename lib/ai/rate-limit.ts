// AI 질문 횟수 제한 (보안 점검 SEC-02, 2026-11-20)
// 누가 질문을 자동으로 수천 번 보내도 OpenAI 요금이 계속 나가지 않도록 막는다.
// - 한 사람(로그인 역할 + 접속 주소)당 1분에 10번
// - 전체 합계 하루 300번 (요금 상한 역할)
// 서버 메모리에 기록하므로 서버를 다시 켜면 처음부터 센다.
// (Vercel 배포본은 서버가 여러 개로 나뉠 수 있어 서버마다 따로 센다 — 배포 때는 OpenAI 월 사용 한도도 함께 건다)
import "server-only";

export const PER_MINUTE = 10;
export const PER_DAY_TOTAL = 300;

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;

/** 사람별 최근 1분 질문 시각 */
const recentByKey = new Map<string, number[]>();
/** 전체 질문 시각 (최근 24시간) */
let recentAll: number[] = [];

export type RateLimitResult = { ok: true } | { ok: false; reason: "minute" | "day"; retryAfterSec: number };

/** 질문 한 번을 기록하고, 한도를 넘었으면 거절한다. now는 시험용 */
export function takeQuestionSlot(key: string, now: number = Date.now()): RateLimitResult {
  const mine = (recentByKey.get(key) ?? []).filter((t) => now - t < MINUTE_MS);
  recentAll = recentAll.filter((t) => now - t < DAY_MS);

  if (mine.length >= PER_MINUTE) {
    recentByKey.set(key, mine);
    return { ok: false, reason: "minute", retryAfterSec: Math.ceil((MINUTE_MS - (now - mine[0])) / 1000) };
  }
  if (recentAll.length >= PER_DAY_TOTAL) {
    return { ok: false, reason: "day", retryAfterSec: Math.ceil((DAY_MS - (now - recentAll[0])) / 1000) };
  }

  mine.push(now);
  recentByKey.set(key, mine);
  recentAll.push(now);
  return { ok: true };
}

/** 시험용: 기록 지우기 */
export function resetRateLimit(): void {
  recentByKey.clear();
  recentAll = [];
}

export const RATE_LIMIT_MESSAGE = {
  minute: "질문이 너무 빠르게 이어지고 있습니다. 1분쯤 뒤에 다시 물어봐 주세요. 대시보드의 지표 버튼은 계속 쓸 수 있습니다.",
  day: "오늘 AI 질문 한도를 모두 썼습니다. 내일 다시 이용해 주세요. 대시보드의 지표 버튼은 계속 쓸 수 있습니다.",
} as const;

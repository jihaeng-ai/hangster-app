// AI 질문 API (PLAN 작업 26~30) — 로그인한 사용자만. 결과는 항상 200 + status로 구분 (Design §4.2)
// 단, 질문 횟수 한도를 넘으면 429로 거절한다 (보안 점검 SEC-02)
import { z } from "zod";
import { askQuestion } from "@/lib/ai/ask";
import { RATE_LIMIT_MESSAGE, takeQuestionSlot } from "@/lib/ai/rate-limit";
import { apiError, checkApiAccess } from "@/lib/auth/session";

const AskSchema = z.object({ question: z.string().trim().min(1).max(200) });

export async function POST(request: Request) {
  const access = await checkApiAccess();
  if (!access.ok) return access.response;

  const body = AskSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError(400, "VALIDATION_ERROR", "질문을 1~200자로 입력해 주세요.");

  // 사람별(로그인 역할 + 접속 주소) 1분 한도, 전체 하루 한도 — AI를 부르기 전에 확인한다
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const slot = takeQuestionSlot(`${access.session.role}|${ip}`);
  if (!slot.ok) {
    return Response.json(
      { error: { code: "RATE_LIMITED", message: RATE_LIMIT_MESSAGE[slot.reason], details: { retryAfterSec: slot.retryAfterSec } } },
      { status: 429, headers: { "Retry-After": String(slot.retryAfterSec) } },
    );
  }

  return Response.json(await askQuestion(body.data.question));
}

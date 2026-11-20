// AI 질문 처리 순서 (Design §8.4): 서버 검사 → AI 해석(질문 문장만) → 서버가 데이터로 답변
import "server-only";
import { getDashboardData } from "@/lib/metrics/series";
import { buildAnswer, simpleResponse, type AskResponse } from "./answer";
import { guardQuestion } from "./guard";
import { interpretQuestion } from "./interpret";

export async function askQuestion(question: string): Promise<AskResponse> {
  // 1) 사번·주민번호, 개인, 전임자 명단 질문은 AI로 보내지 않고 여기서 끝낸다
  const guard = guardQuestion(question);
  if (guard.kind !== "ok") return simpleResponse(guard.kind);

  // 2) 질문 문장만 AI로 보내 조회 조건을 받는다. 실패하면 예시 질문 안내 (대시보드는 계속 작동)
  const interpretation = await interpretQuestion(question);
  if (!interpretation) return simpleResponse("not_understood");

  // 3) 답변·숫자·차트는 서버가 올라온 데이터로 만든다
  return buildAnswer(interpretation, await getDashboardData(), guard.legal);
}

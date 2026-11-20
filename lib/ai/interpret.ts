// Design Ref: §8.4 — 질문 해석. 외부 AI에는 [질문 문장 + 지표 이름 목록]만 보낸다 (PRD Must2-6).
// 데이터 파일 내용·수치·답변은 절대 보내지 않는다. AI는 "어떤 자료를 보여줄지"만 정한다.
import "server-only";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { METRICS } from "@/lib/metrics/definitions";

/** AI 응답 시간 제한 — 전체 10초 목표 중 8초 (PRD Must2-4) */
export const AI_TIMEOUT_MS = 8000;

const metricIds = METRICS.map((m) => m.id) as [string, ...string[]];

export const InterpretationSchema = z.object({
  intent: z.enum(["metric", "person", "officers", "legal", "unavailable", "unknown"]),
  metricId: z.enum(metricIds).nullable(),
  periodFrom: z.string().regex(/^\d{4}(-\d{2})?$/).nullable(),
  periodTo: z.string().regex(/^\d{4}(-\d{2})?$/).nullable(),
  category: z.string().max(30).nullable(),
  /** "최근 5년" → 5 */
  recentCount: z.number().int().min(1).max(60).nullable(),
  aggregation: z.enum(["latest", "trend", "max", "min", "compare", "breakdown"]).nullable(),
});
export type Interpretation = z.infer<typeof InterpretationSchema>;

const INSTRUCTIONS = `너는 병원 노무 현황 관리표의 "질문 해석기"다. 답을 만들지 말고, 질문을 조회 조건으로만 바꿔라.
사용할 수 있는 지표 (id: 이름, 단위, 기간 단위):
${METRICS.map((m) => `- ${m.id}: ${m.label}, ${m.unit}, ${m.periodUnit === "year" ? "연도별" : "월별"}`).join("\n")}

규칙:
- intent: 지표 질문이면 "metric". 특정 개인(이름·호칭)에 대한 질문이면 "person". 노동조합 전임자·전임간부의 이름·명단을 묻으면 "officers". 위법·법률 판단을 묻으면 "legal"(관련 지표가 있으면 metricId도 채운다). 노무·인사에 관한 질문이지만 위 목록에 없는 주제(예: 초과근무, 연차, 이직률, 급여 총액)면 "unavailable". 노무와 관계없거나 뜻을 알 수 없으면 "unknown".
- metricId: 위 목록의 id 중 하나. 해당 지표가 없으면 null.
- periodFrom/periodTo: 질문에 "2023년", "2024년 3월"처럼 숫자로 된 연도·월이 직접 나올 때만 "YYYY" 또는 "YYYY-MM". "올해", "작년", "이번 달", "최근 N년"처럼 상대적인 표현이거나 기간이 없으면 반드시 null (연도를 추측하지 말 것). 서버가 가장 최근 데이터를 기준으로 계산한다.
- category: 직종·항목·부서 이름이 나오면 그 낱말 그대로(예: "간호"), 없으면 null.
- aggregation: 최신 값="latest", 추이·변화="trend", 가장 높은 때(시점)="max", 가장 낮은 때(시점)="min", 전년·전월과 비교="compare", 직종·항목별 나눠 보기 또는 "가장 많은/적은 직종·항목은?"="breakdown". 모르면 "latest".
- recentCount: "최근 5년", "지난 3개월"처럼 최근 몇 기간인지 나오면 그 숫자, 없으면 null.
- "최근 N년"이면 aggregation은 "trend"로 하고 periodFrom/periodTo는 null로 둔다.`;

let client: OpenAI | null = null;
function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY가 없습니다.");
  client ??= new OpenAI({ apiKey, timeout: AI_TIMEOUT_MS, maxRetries: 0 });
  return client;
}

export function getModel(): string {
  const model = process.env.OPENAI_MODEL;
  if (!model) throw new Error("OPENAI_MODEL이 없습니다.");
  return model;
}

/** 질문 → 조회 조건. 실패(장애·시간 초과·사용량 초과·형식 오류)하면 null */
export async function interpretQuestion(question: string): Promise<Interpretation | null> {
  try {
    const response = await getClient().responses.parse({
      model: getModel(),
      instructions: INSTRUCTIONS,
      input: question, // 질문 문장만
      text: { format: zodTextFormat(InterpretationSchema, "interpretation") },
      store: false, // OpenAI 쪽에 대화 기록을 남기지 않는다
    });
    const parsed = InterpretationSchema.safeParse(response.output_parsed);
    return parsed.success ? parsed.data : null;
  } catch (err) {
    // 질문 내용은 로그에 남기지 않는다
    const reason = err instanceof Error ? err.name : "unknown";
    console.error(`[ask] 질문 해석 실패: ${reason}`);
    return null;
  }
}

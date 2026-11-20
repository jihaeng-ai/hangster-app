// Design Ref: §8.4 — AI로 보내기 전에 서버가 먼저 거르는 규칙 (PRD Must2-3, 5, 8)
// 여기서 걸린 질문은 외부 AI로 보내지 않는다 (법률 질문 제외 — 관련 수치를 찾기 위해 질문 문장만 보낸다).

export type GuardResult =
  | { kind: "ok"; legal: boolean }
  | { kind: "blocked_id_number" }
  | { kind: "refused_person" }
  | { kind: "refused_officers" };

/** 식별번호를 가리키는 낱말 — 숫자와 함께 나오면 자릿수와 상관없이 막는다 */
const ID_WORD = /사번|직번|사원\s*번호|직원\s*번호|주민|등록\s*번호|개인\s*번호/;
/**
 * 형식이 분명한 날짜·기간 (먼저 지워 두고 검사): 2024-03, 2024.03.15, 2024년 3월 15일
 * 보안 점검 SEC-03: 월은 1~12, 일은 1~31만 날짜로 보고, 날짜 바로 뒤에 숫자가 더 이어지면
 * (예: "2012-34-5678") 날짜가 아니라 번호로 본다.
 */
const DATE_LIKE =
  /(?<!\d)(19|20)\d{2}\s*[-./]\s*(0?[1-9]|1[0-2])(\s*[-./]\s*(0?[1-9]|[12]\d|3[01]))?(?!\s*[-./·_]?\s*\d)|(?<!\d)(19|20)\d{2}\s*년(\s*\d{1,2}\s*월)?(\s*\d{1,2}\s*일)?/g;
/** 숫자 사이의 구분 기호 (123-4567, 12 34 56 → 이어 붙여 검사) */
const DIGIT_SEPARATOR = /(?<=\d)[\s\-.·_]+(?=\d)/g;
/** 이어 붙인 숫자 6자리 이상 = 사번·주민번호로 본다 */
const LONG_NUMBER = /\d{6,}/;

/** 이름 + 호칭 (예: "김OO 씨", "홍길동님", "이영희 과장") */
const PERSON = /[가-힣]{2,4}\s*(씨|님|선생|과장|팀장|부장|대리|주임|교수|간호사)(?![가-힣]*(별|들))/;
/** "○○○", "OOO", "XXX"처럼 가린 이름 */
const MASKED_NAME = /[○◯OＯXＸ*]{2,}/;
/** 개인 단위 질문 표현 */
const PERSONAL = /(누가|누구|어떤 사람|직원 이름|사람 이름|개인별|개인 단위)/;

/** 전임자(전임간부) 명단은 대시보드 버튼으로만 본다 */
const OFFICER_LIST = /전임(자|간부).*(명단|이름|누구|성명|사람)|(명단|이름|누구|성명).*전임(자|간부)/;

/** 노무·법률 판단 요청 */
const LEGAL = /위법|불법|합법|적법|법적|법률|소송|고소|고발|노동법|근로기준법|처벌|부당노동행위|문제\s*(돼|되|없|있)/;

export function hasIdLikeNumber(question: string): boolean {
  // 전각 숫자(１２３) 등을 일반 숫자로 바꾼다
  const text = question.normalize("NFKC");
  if (ID_WORD.test(text) && /\d/.test(text)) return true;
  // 날짜·기간을 지운 뒤, 숫자 사이 구분 기호를 없애고 긴 숫자가 남는지 본다
  const compact = text.replace(DATE_LIKE, " ").replace(DIGIT_SEPARATOR, "");
  return LONG_NUMBER.test(compact);
}

export function guardQuestion(rawQuestion: string): GuardResult {
  if (hasIdLikeNumber(rawQuestion)) return { kind: "blocked_id_number" };
  const question = rawQuestion.normalize("NFKC");
  if (OFFICER_LIST.test(question)) return { kind: "refused_officers" };
  if (PERSON.test(question) || MASKED_NAME.test(question) || PERSONAL.test(question)) {
    return { kind: "refused_person" };
  }
  return { kind: "ok", legal: LEGAL.test(question) };
}

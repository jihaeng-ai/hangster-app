// 세션 쿠키 암호화·복호화 — proxy.ts와 서버 코드가 함께 쓴다
// (proxy에서도 불러야 하므로 next/headers·server-only를 쓰지 않는다. 브라우저 코드에서 불러오지 말 것)
import { sealData, unsealData } from "iron-session";

export type Role = "manager" | "executive";

export const ROLE_LABEL: Record<Role, string> = {
  manager: "담당자",
  executive: "경영진",
};

export interface SessionData {
  role: Role;
}

export const SESSION_COOKIE = "hangster_session";
/** 로그인 유지 시간: 8시간 */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error("AUTH_SECRET이 없거나 32자보다 짧습니다. .env를 확인해 주세요.");
  }
  return value;
}

export function sealSession(data: SessionData): Promise<string> {
  return sealData(data, { password: secret(), ttl: SESSION_TTL_SECONDS });
}

/** 쿠키 값을 풀어 역할을 돌려준다. 없거나·만료되거나·위조됐으면 null */
export async function unsealSession(cookieValue: string | undefined): Promise<SessionData | null> {
  if (!cookieValue) return null;
  try {
    const data = await unsealData<Partial<SessionData>>(cookieValue, {
      password: secret(),
      ttl: SESSION_TTL_SECONDS,
    });
    return data.role === "manager" || data.role === "executive" ? { role: data.role } : null;
  } catch {
    return null;
  }
}

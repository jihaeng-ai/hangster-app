// 계정 2개(담당자·경영진) 확인 — 계정 정보는 .env에만 있다 (PRD 7장)
import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Role } from "./seal";

interface Account {
  role: Role;
  id: string | undefined;
  password: string | undefined;
}

function accounts(): Account[] {
  return [
    { role: "manager", id: process.env.AUTH_MANAGER_ID, password: process.env.AUTH_MANAGER_PASSWORD },
    { role: "executive", id: process.env.AUTH_EXEC_ID, password: process.env.AUTH_EXEC_PASSWORD },
  ];
}

/** 길이가 달라도 걸리는 시간이 같도록 해시를 비교한다 (비밀번호 추측 방지) */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** 아이디·비밀번호가 맞으면 역할, 아니면 null. 비밀번호가 비어 있는 계정은 로그인할 수 없다. */
export function verifyCredentials(id: string, password: string): Role | null {
  let matched: Role | null = null;
  for (const account of accounts()) {
    if (!account.id || !account.password) continue;
    // 모든 계정을 끝까지 비교한다 (어느 계정에서 틀렸는지 시간으로 드러나지 않게)
    // 아이디·비밀번호를 둘 다 비교한 뒤 판정한다 (아이디가 맞는지 응답 시간으로 드러나지 않게 — 보안 검토 L4)
    const idOk = safeEqual(id, account.id);
    const passwordOk = safeEqual(password, account.password);
    if (idOk && passwordOk) matched = account.role;
  }
  return matched;
}

/** 비밀번호가 설정된 계정이 하나라도 있는지 (로그인 화면 안내용) */
export function hasConfiguredAccount(): boolean {
  return accounts().some((a) => Boolean(a.id && a.password));
}

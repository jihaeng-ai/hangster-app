// 로그인 쿠키 ↔ PDF 읽기 충돌 재발 방지 확인 — 실행: npm run check:base64
// PDF를 먼저 읽고(pdf.js가 base64 대용품을 넣는 상황) 그 뒤에 로그인 쿠키를 만들고 푸는지 확인한다.
import { readFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const { parseFile } = await import("@/lib/data/store");
  const pdf = path.join(process.cwd(), "data", "samples", "노조차량지원_샘플.pdf");
  await parseFile("노조차량지원_샘플.pdf", new Uint8Array(readFileSync(pdf)), "b64"); // pdf.js 불러오기
  // 로그인 모듈을 PDF 뒤에 불러온다 (실제 서버에서 문제가 났던 순서)
  const { sealSession, unsealSession } = await import("@/lib/auth/seal");
  const cookie = await sealSession({ role: "executive" });
  const back = await unsealSession(cookie);
  const fromB64 = (Uint8Array as unknown as { fromBase64: (s: string, o: { alphabet: string }) => Uint8Array }).fromBase64;
  const urlSafe = fromB64("-_8", { alphabet: "base64url" });
  const ok = back?.role === "executive" && urlSafe.length === 2 && urlSafe[0] === 0xfb && urlSafe[1] === 0xff;
  console.log(ok ? "✅ PDF를 읽은 뒤에도 로그인 쿠키를 제대로 풂" : `❌ 실패: ${JSON.stringify(back)} ${Array.from(urlSafe)}`);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

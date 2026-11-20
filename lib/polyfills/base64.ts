// Uint8Array base64 함수 보정 (2026-11-20, 로그인 401 원인 수정)
//
// 문제: PDF를 읽는 unpdf(pdf.js)가 Node 24에 없는 Uint8Array.fromBase64 / toBase64 / toHex를 스스로 채워 넣는데,
//       그 대용품은 { alphabet: "base64url" } 옵션을 무시한다. 로그인 쿠키를 푸는 iron-session(iron-webcrypto)은
//       이 함수가 있으면 base64url 옵션을 붙여 그대로 쓰므로, PDF를 한 번 읽은 뒤에는 쿠키를 못 풀어
//       API가 "로그인이 필요합니다"(401)를 돌려줬다 (샘플로 저장소를 처음 만들 때·PDF를 올린 뒤).
// 해결: 옵션을 제대로 지키는 함수를 먼저 넣어 둔다. 브라우저·Node에 진짜(내장) 함수가 있으면 건드리지 않고,
//       pdf.js가 먼저 넣은 대용품이 있으면 이것으로 바꾼다. 로그인 코드(seal.ts)와 PDF 읽기(parse-pdf.ts) 맨 위에서 불러온다.

type Base64Options = { alphabet?: "base64" | "base64url"; omitPadding?: boolean };

const isNative = (fn: unknown) => typeof fn === "function" && Function.prototype.toString.call(fn).includes("[native code]");

function fromBase64(input: string, options: Base64Options = {}): Uint8Array {
  let s = String(input).replace(/\s+/g, "");
  if (options.alphabet === "base64url") s = s.replace(/-/g, "+").replace(/_/g, "/");
  s = s.padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

function toBase64(this: Uint8Array, options: Base64Options = {}): string {
  let binary = "";
  for (let i = 0; i < this.length; i++) binary += String.fromCharCode(this[i]);
  let s = btoa(binary);
  if (options.alphabet === "base64url") s = s.replace(/\+/g, "-").replace(/\//g, "_");
  if (options.omitPadding) s = s.replace(/=+$/, "");
  return s;
}

function toHex(this: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < this.length; i++) hex += this[i].toString(16).padStart(2, "0");
  return hex;
}

const U8 = Uint8Array as unknown as Record<string, unknown>;
const U8P = Uint8Array.prototype as unknown as Record<string, unknown>;
const define = (target: object, name: string, value: unknown) =>
  Object.defineProperty(target, name, { value, writable: true, configurable: true });

if (!isNative(U8.fromBase64)) define(Uint8Array, "fromBase64", fromBase64);
if (!isNative(U8P.toBase64)) define(Uint8Array.prototype, "toBase64", toBase64);
if (!isNative(U8P.toHex)) define(Uint8Array.prototype, "toHex", toHex);

export {};

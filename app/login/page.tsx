import type { Metadata } from "next";
import Image from "next/image";
import { APP_NAME, APP_SUBTITLE } from "@/lib/app-info";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "로그인" };

// 로그인 화면 (PLAN 작업 13) — 회원가입·비밀번호 찾기는 만들지 않는다 (PRD 6장)
export default function LoginPage() {
  return (
    // 배경: 네이비 한 가지 색 (참고 앱과 같은 #162556)
    <main className="flex flex-1 items-center justify-center bg-navy p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-6 rounded-xl border-t-4 border-navy bg-white p-8 shadow-xl dark:bg-zinc-900">
        <Image src="/hanyang-logo.png" alt="한양대학교 로고" width={72} height={72} priority />
        <div className="text-center">
          <h1 className="text-xl font-semibold text-navy dark:text-white">{APP_NAME}</h1>
          <p className="mt-0.5 text-sm font-medium text-navy/80 dark:text-navy-mist">{APP_SUBTITLE}</p>
          <p className="mt-3 text-sm text-zinc-500">담당자·경영진 계정으로 로그인하세요</p>
        </div>
        <LoginForm />
        <p className="text-center text-sm text-zinc-500">
          비밀번호를 잊으셨을 경우,
          <br />
          담당자에게 문의해주세요
        </p>
      </div>
    </main>
  );
}

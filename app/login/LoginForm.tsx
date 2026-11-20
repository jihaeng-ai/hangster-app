"use client";
// 로그인 입력 양식 — 틀리면 오류 문구를 보여준다
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        아이디
        <input
          name="id"
          defaultValue={state.id}
          autoComplete="username"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-base outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        비밀번호
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-md border border-zinc-300 px-3 py-2 text-base outline-none focus:border-navy focus:ring-2 focus:ring-navy/20 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-navy px-4 py-2 font-semibold text-white hover:bg-navy-dark disabled:opacity-60"
      >
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}

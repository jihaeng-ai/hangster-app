"use server";
// 로그인·로그아웃 Server Action (PLAN 작업 13, 16)
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasConfiguredAccount, verifyCredentials } from "@/lib/auth/accounts";
import { createSession, destroySession } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
  id?: string;
}

const LoginSchema = z.object({
  id: z.string().trim().min(1, "아이디를 입력해 주세요.").max(100),
  password: z.string().min(1, "비밀번호를 입력해 주세요.").max(200),
});

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({ id: formData.get("id"), password: formData.get("password") });
  const id = typeof formData.get("id") === "string" ? String(formData.get("id")) : "";
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.", id };
  }

  if (!hasConfiguredAccount()) {
    return { error: "계정 비밀번호가 아직 설정되지 않았습니다. 담당자에게 문의하세요.", id };
  }

  const role = verifyCredentials(parsed.data.id, parsed.data.password);
  if (!role) {
    // 비밀번호 무작위 대입을 늦추기 위해 잠깐 기다린다
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "아이디 또는 비밀번호가 맞지 않습니다.", id };
  }

  await createSession(role);
  redirect("/");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

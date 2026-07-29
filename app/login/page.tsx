"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ErrorPayload = { error?: { message?: string } };

export default function LoginPage() {
  const router = useRouter();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ loginId, password }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
      setMessage(payload.error?.message ?? "로그인하지 못했습니다.");
      setSubmitting(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <section className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">한결물산 ERP</p>
        <h1 className="mt-1 text-2xl font-semibold">로그인</h1>
        <p className="mt-2 text-sm text-muted-foreground">발급받은 로그인 ID와 비밀번호를 입력하세요.</p>
        {message ? <p className="mt-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}
        <form className="mt-6 grid gap-4" onSubmit={submit}>
          <label className="grid gap-1.5 text-sm font-medium">
            로그인 ID
            <input className="form-input" autoComplete="username" required value={loginId} onChange={(event) => setLoginId(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            비밀번호
            <input className="form-input" autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="h-10 rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={submitting} type="submit">
            {submitting ? "로그인 중" : "로그인"}
          </button>
        </form>
      </section>
    </main>
  );
}

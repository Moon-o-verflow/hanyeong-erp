"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function logout() {
    setSubmitting(true);
    await fetch("/api/v1/auth/logout", { method: "POST", credentials: "same-origin" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      className="rounded-md border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      disabled={submitting}
      onClick={() => void logout()}
      type="button"
    >
      로그아웃
    </button>
  );
}

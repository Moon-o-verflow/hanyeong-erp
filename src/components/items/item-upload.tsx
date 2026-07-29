"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type UploadResult = { insertedCount: number; specParseFailedCount: number };
type UploadError = { row: number; field: string; reason: string };
type ErrorPayload = { data?: UploadResult; error?: { message?: string; details?: { errors?: UploadError[] } } };

export function ItemUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<UploadError[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setMessage("업로드할 엑셀 파일을 선택하세요.");
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setErrors([]);
    setResult(null);
    const formData = new FormData();
    formData.set("file", file);
    const response = await fetch("/api/v1/items/bulk-upload", {
      method: "POST",
      credentials: "same-origin",
      body: formData,
    });
    const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
    if (!response.ok) {
      setMessage(payload.error?.message ?? "엑셀 이관에 실패했습니다.");
      setErrors(payload.error?.details?.errors ?? []);
      setSubmitting(false);
      return;
    }

    setResult(payload.data ?? null);
    setSubmitting(false);
  }

  return (
    <section className="mx-auto max-w-2xl space-y-5">
      <div>
        <Link className="text-sm text-blue-700 hover:underline" href="/items">
          품목 관리로 돌아가기
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">품목 엑셀 이관</h1>
        <p className="mt-1 text-sm text-muted-foreground">품목 정보와 초기 재고를 한 번에 등록합니다.</p>
      </div>
      {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}
      {result ? <p className="rounded-md bg-primary/10 p-3 text-sm">품목 {result.insertedCount}건을 등록했습니다. 규격 파싱 실패: {result.specParseFailedCount}건</p> : null}
      <form className="space-y-5 rounded-lg border bg-card p-5" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm font-medium">
          엑셀 파일 (.xlsx)
          <input accept=".xlsx,.xls" className="block text-sm" onChange={(event) => setFile(event.target.files?.[0] ?? null)} required type="file" />
        </label>
        <button className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={submitting} type="submit">
          {submitting ? "이관 중" : "이관 시작"}
        </button>
      </form>
      {errors.length > 0 ? <div className="rounded-lg border bg-card"><h2 className="border-b px-4 py-3 text-sm font-semibold">오류 목록</h2><ul className="divide-y text-sm">{errors.map((error, index) => <li className="px-4 py-3" key={`${error.row}-${error.field}-${index}`}>행 {error.row} · {error.field}: {error.reason}</li>)}</ul></div> : null}
    </section>
  );
}

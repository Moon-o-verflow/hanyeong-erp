"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Role = "ADMIN" | "PURCHASER" | "WAREHOUSE" | "BRANCH";

type Profile = { role: Role };
type ItemOption = { id: number; itemCode: string; itemName: string; packUnit: string };
type Approval = {
  id: number;
  approvedQty: number;
  plannedShipDate: string;
  status: string;
  approvedBy: string;
  approvedAt: string;
  shippedBy: string | null;
  shippedAt: string | null;
};
type InternalOrderEntry = {
  id: number;
  orderNo: string;
  branchName: string;
  item: ItemOption;
  requestedQty: number;
  approvedQty: number;
  canceledQty: number;
  outstandingQty: number;
  requestedDueDate: string;
  status: string;
};
type InternalOrderDetail = InternalOrderEntry & {
  remarks: string | null;
  rejectReason: string | null;
  createdBy: string;
  approvals: Approval[];
};
type ErrorPayload = { error?: { message?: string } };

async function requestMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
  return payload.error?.message ?? fallback;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "승인 대기",
    PARTIALLY_APPROVED: "일부 승인",
    COMPLETED: "종결",
    REJECTED: "반려",
    CANCELED: "취소",
    ALLOCATED: "출고 대기",
    SHIPPED: "출고 완료",
  };
  return labels[status] ?? status;
}

export function InternalOrderList() {
  const [entries, setEntries] = useState<InternalOrderEntry[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [profileResponse, listResponse] = await Promise.all([
      fetch("/api/v1/auth/me", { credentials: "same-origin" }),
      fetch("/api/v1/internal-orders?page=1&size=100", { credentials: "same-origin" }),
    ]);
    if (!profileResponse.ok || !listResponse.ok) {
      setMessage(await requestMessage(listResponse, "사내 발주를 불러오지 못했습니다."));
      return;
    }

    const profile = (await profileResponse.json()) as { data: Profile };
    const list = (await listResponse.json()) as { data: InternalOrderEntry[] };
    setRole(profile.data.role);
    setEntries(list.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">사내 발주</h1>
          <p className="mt-1 text-sm text-muted-foreground">지점 요청과 승인·출고 현황을 확인합니다.</p>
        </div>
        {role === "BRANCH" ? (
          <Link className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground" href="/internal-orders/new">
            사내 발주 요청
          </Link>
        ) : null}
      </div>
      {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              {['발주 번호', '지점', '상품명', '요청 수량', '승인 수량', '미결 수량', '상태', '납기 요망일'].map((label) => (
                <th className="whitespace-nowrap px-4 py-3 font-medium" key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>조회된 사내 발주가 없습니다.</td></tr>
            ) : entries.map((entry) => (
              <tr className="border-t" key={entry.id}>
                <td className="px-4 py-3"><Link className="font-medium text-blue-700 hover:underline" href={`/internal-orders/${entry.id}`}>{entry.orderNo}</Link></td>
                <td className="px-4 py-3">{entry.branchName}</td>
                <td className="px-4 py-3">{entry.item.itemName}</td>
                <td className="px-4 py-3">{entry.requestedQty}</td>
                <td className="px-4 py-3">{entry.approvedQty}</td>
                <td className="px-4 py-3">{entry.outstandingQty}</td>
                <td className="px-4 py-3">{statusLabel(entry.status)}</td>
                <td className="px-4 py-3">{entry.requestedDueDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function InternalOrderCreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<Role | null>(null);
  const [items, setItems] = useState<ItemOption[]>([]);
  const [itemId, setItemId] = useState("");
  const [requestedQty, setRequestedQty] = useState("");
  const [requestedDueDate, setRequestedDueDate] = useState("");
  const [remarks, setRemarks] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/v1/auth/me", { credentials: "same-origin" }),
      fetch("/api/v1/items?page=1&size=100", { credentials: "same-origin" }),
    ]).then(async ([profileResponse, itemResponse]) => {
      if (!profileResponse.ok || !itemResponse.ok) {
        setMessage("사내 발주 요청을 준비하지 못했습니다.");
        return;
      }
      const profile = (await profileResponse.json()) as { data: Profile };
      const itemPayload = (await itemResponse.json()) as { data: ItemOption[] };
      setRole(profile.data.role);
      setItems(itemPayload.data.filter((item) => "isActive" in item ? Boolean((item as ItemOption & { isActive: boolean }).isActive) : true));
    }).catch(() => setMessage("사내 발주 요청을 준비하지 못했습니다."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const originOrderId = searchParams.get("originOrderId");
    const response = await fetch("/api/v1/internal-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        itemId: Number(itemId),
        requestedQty: Number(requestedQty),
        requestedDueDate,
        remarks: remarks.trim() || null,
        originOrderId: originOrderId ? Number(originOrderId) : null,
      }),
    });
    if (!response.ok) {
      setMessage(await requestMessage(response, "사내 발주를 요청하지 못했습니다."));
      setSubmitting(false);
      return;
    }
    const payload = (await response.json()) as { data: { id: number } };
    router.replace(`/internal-orders/${payload.data.id}`);
  }

  if (role !== null && role !== "BRANCH") {
    return <p className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">지점 사용자만 사내 발주를 요청할 수 있습니다.</p>;
  }

  return (
    <section className="mx-auto max-w-xl space-y-5">
      <div><Link className="text-sm text-blue-700 hover:underline" href="/internal-orders">사내 발주 목록으로 돌아가기</Link><h1 className="mt-2 text-2xl font-semibold">사내 발주 요청</h1></div>
      {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}
      <form className="grid gap-5 rounded-lg border bg-card p-5" onSubmit={submit}>
        <label className="grid gap-1.5 text-sm font-medium">품목<select className="form-input" required value={itemId} onChange={(event) => setItemId(event.target.value)}><option value="">품목을 선택하세요</option>{items.map((item) => <option key={item.id} value={item.id}>{item.itemCode} · {item.itemName} ({item.packUnit})</option>)}</select></label>
        <label className="grid gap-1.5 text-sm font-medium">요청 수량<input className="form-input" type="number" min="1" step="1" required value={requestedQty} onChange={(event) => setRequestedQty(event.target.value)} /></label>
        <label className="grid gap-1.5 text-sm font-medium">납기 요망일<input className="form-input" type="date" required value={requestedDueDate} onChange={(event) => setRequestedDueDate(event.target.value)} /></label>
        <label className="grid gap-1.5 text-sm font-medium">비고<input className="form-input" value={remarks} onChange={(event) => setRemarks(event.target.value)} /></label>
        <button disabled={submitting} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" type="submit">{submitting ? "요청 중" : "요청"}</button>
      </form>
    </section>
  );
}

export function InternalOrderDetailPage({ internalOrderId }: { internalOrderId: string }) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [detail, setDetail] = useState<InternalOrderDetail | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [approvedQty, setApprovedQty] = useState("");
  const [plannedShipDate, setPlannedShipDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [cancelQty, setCancelQty] = useState("");

  const load = useCallback(async () => {
    const [profileResponse, detailResponse] = await Promise.all([
      fetch("/api/v1/auth/me", { credentials: "same-origin" }),
      fetch(`/api/v1/internal-orders/${internalOrderId}`, { credentials: "same-origin" }),
    ]);
    if (!profileResponse.ok || !detailResponse.ok) {
      setMessage(await requestMessage(detailResponse, "사내 발주를 불러오지 못했습니다."));
      return;
    }
    const profile = (await profileResponse.json()) as { data: Profile };
    const payload = (await detailResponse.json()) as { data: InternalOrderDetail };
    setRole(profile.data.role);
    setDetail(payload.data);
  }, [internalOrderId]);

  useEffect(() => { void load(); }, [load]);

  async function post(path: string, body?: Record<string, unknown>) {
    setMessage(null);
    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      setMessage(await requestMessage(response, "처리하지 못했습니다."));
      return;
    }
    await load();
    router.refresh();
  }

  if (!detail) {
    return <p className="text-sm text-muted-foreground">불러오는 중입니다.</p>;
  }

  const mayApprove = role === "ADMIN" && (detail.status === "PENDING" || detail.status === "PARTIALLY_APPROVED");
  const mayReject = role === "ADMIN" && detail.status === "PENDING";
  const mayCancelOutstanding = role === "BRANCH" && detail.outstandingQty > 0 && (detail.status === "PENDING" || detail.status === "PARTIALLY_APPROVED");

  return (
    <section className="mx-auto max-w-4xl space-y-5">
      <div><Link className="text-sm text-blue-700 hover:underline" href="/internal-orders">사내 발주 목록으로 돌아가기</Link><h1 className="mt-2 text-2xl font-semibold">{detail.orderNo}</h1></div>
      {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}
      <dl className="grid gap-4 rounded-lg border bg-card p-5 text-sm sm:grid-cols-2"><Info label="지점" value={detail.branchName}/><Info label="상품명" value={detail.item.itemName}/><Info label="요청 수량" value={String(detail.requestedQty)}/><Info label="승인 수량" value={String(detail.approvedQty)}/><Info label="미결 수량" value={String(detail.outstandingQty)}/><Info label="상태" value={statusLabel(detail.status)}/><Info label="납기 요망일" value={detail.requestedDueDate}/><Info label="비고" value={detail.remarks ?? "—"}/>{detail.rejectReason ? <Info label="반려 사유" value={detail.rejectReason}/> : null}</dl>
      {mayApprove ? <form className="grid gap-3 rounded-lg border bg-card p-5 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); void post(`/api/v1/internal-orders/${detail.id}/approve`, { approvedQty: Number(approvedQty), plannedShipDate }); }}><input className="form-input" required min="1" max={detail.outstandingQty} placeholder="승인 수량" type="number" value={approvedQty} onChange={(event) => setApprovedQty(event.target.value)} /><input className="form-input" required type="date" value={plannedShipDate} onChange={(event) => setPlannedShipDate(event.target.value)} /><button className="rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" type="submit">승인</button></form> : null}
      {mayReject ? <form className="flex gap-2 rounded-lg border bg-card p-5" onSubmit={(event) => { event.preventDefault(); void post(`/api/v1/internal-orders/${detail.id}/reject`, { rejectReason }); }}><input className="form-input" required placeholder="반려 사유" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} /><button className="rounded-md border px-4 text-sm font-medium" type="submit">반려</button></form> : null}
      {mayCancelOutstanding ? <form className="flex gap-2 rounded-lg border bg-card p-5" onSubmit={(event) => { event.preventDefault(); void post(`/api/v1/internal-orders/${detail.id}/cancel`, { cancelQty: Number(cancelQty) }); }}><input className="form-input" required min="1" max={detail.outstandingQty} placeholder="취소 수량" type="number" value={cancelQty} onChange={(event) => setCancelQty(event.target.value)} /><button className="rounded-md border px-4 text-sm font-medium" type="submit">미결 수량 취소</button></form> : null}
      {role === "BRANCH" && detail.status === "REJECTED" ? <Link className="inline-flex rounded-md border px-4 py-2 text-sm font-medium" href={`/internal-orders/new?originOrderId=${detail.id}`}>반려 건 복사하여 재기안</Link> : null}
      <section className="space-y-3"><h2 className="text-lg font-semibold">승인 이력</h2><div className="overflow-x-auto rounded-lg border bg-card"><table className="min-w-full text-sm"><thead className="bg-muted/50 text-left text-muted-foreground"><tr>{['승인 수량', '출고 예정일', '상태', '승인자', '처리'].map((label) => <th className="px-4 py-3 font-medium" key={label}>{label}</th>)}</tr></thead><tbody>{detail.approvals.map((approval) => <tr className="border-t" key={approval.id}><td className="px-4 py-3">{approval.approvedQty}</td><td className="px-4 py-3">{approval.plannedShipDate}</td><td className="px-4 py-3">{statusLabel(approval.status)}</td><td className="px-4 py-3">{approval.approvedBy}</td><td className="px-4 py-3">{approval.status === "ALLOCATED" && role === "WAREHOUSE" ? <button className="rounded-md border px-3 py-1.5" onClick={() => void post(`/api/v1/internal-order-approvals/${approval.id}/ship`)} type="button">출고 완료</button> : null}{approval.status === "ALLOCATED" && role === "ADMIN" ? <button className="rounded-md border px-3 py-1.5" onClick={() => void post(`/api/v1/internal-order-approvals/${approval.id}/cancel`)} type="button">승인 취소</button> : null}</td></tr>)}</tbody></table></div></section>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}

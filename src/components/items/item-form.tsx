"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import type { CurrentUserPayload, ItemRecord } from "@/src/components/items/item-types";

type ItemFormValues = {
  itemName: string;
  barcode: string;
  categoryMajor: string;
  categoryMinor: string;
  unitSpec: string;
  unitName: string;
  packQty: string;
  packUnit: string;
  purchasePrice: string;
  supplyPrice: string;
  minStockQty: string;
  remarks: string;
};

const initialValues: ItemFormValues = {
  itemName: "",
  barcode: "",
  categoryMajor: "",
  categoryMinor: "",
  unitSpec: "",
  unitName: "",
  packQty: "1",
  packUnit: "박스",
  purchasePrice: "",
  supplyPrice: "",
  minStockQty: "",
  remarks: "",
};

type ErrorPayload = { error?: { message?: string } };

function toFormValues(item: ItemRecord): ItemFormValues {
  return {
    itemName: item.itemName,
    barcode: item.barcode ?? "",
    categoryMajor: item.categoryMajor ?? "",
    categoryMinor: item.categoryMinor ?? "",
    unitSpec: item.unitSpec ?? "",
    unitName: item.unitName ?? "",
    packQty: String(item.packQty),
    packUnit: item.packUnit,
    purchasePrice: item.purchasePrice === undefined ? "" : String(item.purchasePrice),
    supplyPrice: String(item.supplyPrice),
    minStockQty: item.minStockQty === null || item.minStockQty === undefined ? "" : String(item.minStockQty),
    remarks: item.remarks ?? "",
  };
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function nullableInteger(value: string) {
  return value.trim() === "" ? null : Number(value);
}

async function responseMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
  return payload.error?.message ?? fallback;
}

export function ItemForm({ itemId }: { itemId?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<ItemFormValues>(initialValues);
  const [itemCode, setItemCode] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(Boolean(itemId));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      const profileResponse = await fetch("/api/v1/auth/me", { credentials: "same-origin" });
      if (!profileResponse.ok) {
        if (active) {
          setAuthorized(false);
          setLoading(false);
        }
        return;
      }

      const profile = (await profileResponse.json()) as { data: CurrentUserPayload };
      if (profile.data.role !== "ADMIN") {
        if (active) {
          setAuthorized(false);
          setLoading(false);
        }
        return;
      }

      if (!itemId) {
        if (active) {
          setAuthorized(true);
          setLoading(false);
        }
        return;
      }

      const itemResponse = await fetch(`/api/v1/items/${itemId}`, { credentials: "same-origin" });
      if (!itemResponse.ok) {
        if (active) {
          setMessage(await responseMessage(itemResponse, "품목을 불러오지 못했습니다."));
          setAuthorized(true);
          setLoading(false);
        }
        return;
      }

      const payload = (await itemResponse.json()) as { data: ItemRecord };
      if (active) {
        setValues(toFormValues(payload.data));
        setItemCode(payload.data.itemCode);
        setAuthorized(true);
        setLoading(false);
      }
    }

    void load().catch(() => {
      if (active) {
        setMessage("품목을 불러오지 못했습니다.");
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [itemId]);

  function updateValue(field: keyof ItemFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const payload = {
      itemName: values.itemName.trim(),
      barcode: nullableText(values.barcode),
      categoryMajor: nullableText(values.categoryMajor),
      categoryMinor: nullableText(values.categoryMinor),
      unitSpec: nullableText(values.unitSpec),
      unitName: nullableText(values.unitName),
      packQty: Number(values.packQty),
      packUnit: values.packUnit.trim(),
      purchasePrice: Number(values.purchasePrice),
      supplyPrice: Number(values.supplyPrice),
      minStockQty: nullableInteger(values.minStockQty),
      remarks: nullableText(values.remarks),
    };
    const endpoint = itemId ? `/api/v1/items/${itemId}` : "/api/v1/items";
    const response = await fetch(endpoint, {
      method: itemId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      setMessage(await responseMessage(response, "품목을 저장하지 못했습니다."));
      setSubmitting(false);
      return;
    }

    if (itemId) {
      router.replace(`/items/${itemId}`);
      router.refresh();
    } else {
      const created = (await response.json()) as { data: { id: number } };
      router.replace(`/items/${created.data.id}`);
    }
  }

  if (authorized === false) {
    return <p className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">관리자만 품목을 등록하거나 수정할 수 있습니다.</p>;
  }

  if (loading || authorized === null) {
    return <p className="text-sm text-muted-foreground">불러오는 중입니다.</p>;
  }

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link className="text-sm text-blue-700 hover:underline" href="/items">
          품목 관리로 돌아가기
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{itemId ? "품목 수정" : "품목 등록"}</h1>
        {itemId ? (
          <p className="mt-1 text-sm text-muted-foreground">자체 품목코드: {itemCode ?? "—"}</p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">자체 품목코드는 저장 시 자동으로 부여됩니다.</p>
        )}
      </div>

      {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}

      <form className="grid gap-5 rounded-lg border bg-card p-5 sm:grid-cols-2" onSubmit={submit}>
        <Field label="상품명" required>
          <input value={values.itemName} onChange={(event) => updateValue("itemName", event.target.value)} required className="form-input" />
        </Field>
        <Field label="바코드 번호">
          <input value={values.barcode} onChange={(event) => updateValue("barcode", event.target.value)} className="form-input" />
        </Field>
        <Field label="카테고리 대분류">
          <input value={values.categoryMajor} onChange={(event) => updateValue("categoryMajor", event.target.value)} className="form-input" />
        </Field>
        <Field label="카테고리 소분류">
          <input value={values.categoryMinor} onChange={(event) => updateValue("categoryMinor", event.target.value)} className="form-input" />
        </Field>
        <Field label="낱개 규격">
          <input value={values.unitSpec} onChange={(event) => updateValue("unitSpec", event.target.value)} className="form-input" />
        </Field>
        <Field label="낱개 단위">
          <input value={values.unitName} onChange={(event) => updateValue("unitName", event.target.value)} className="form-input" />
        </Field>
        <Field label="입수" required>
          <input type="number" min="1" step="1" value={values.packQty} onChange={(event) => updateValue("packQty", event.target.value)} required className="form-input" />
        </Field>
        <Field label="포장 단위" required>
          <input value={values.packUnit} onChange={(event) => updateValue("packUnit", event.target.value)} required className="form-input" />
        </Field>
        <Field label="매입단가" required>
          <input type="number" min="0" step="1" value={values.purchasePrice} onChange={(event) => updateValue("purchasePrice", event.target.value)} required className="form-input" />
        </Field>
        <Field label="지점 공급단가" required>
          <input type="number" min="0" step="1" value={values.supplyPrice} onChange={(event) => updateValue("supplyPrice", event.target.value)} required className="form-input" />
        </Field>
        <Field label="최소 재고 수량">
          <input type="number" min="0" step="1" value={values.minStockQty} onChange={(event) => updateValue("minStockQty", event.target.value)} className="form-input" />
        </Field>
        <Field label="비고">
          <input value={values.remarks} onChange={(event) => updateValue("remarks", event.target.value)} className="form-input" />
        </Field>
        <div className="sm:col-span-2 flex justify-end gap-2 border-t pt-5">
          <Link href="/items" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium">
            취소
          </Link>
          <button disabled={submitting} className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" type="submit">
            {submitting ? "저장 중" : "저장"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ children, label, required = false }: { children: React.ReactNode; label: string; required?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      <span>
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </span>
      {children}
    </label>
  );
}

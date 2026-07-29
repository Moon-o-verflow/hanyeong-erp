"use client";

import {
  flexRender,
  getCoreRowModel,
  type ColumnDef,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  formatWon,
  type CurrentUserPayload,
  type ItemListPayload,
  type ItemRecord,
} from "@/src/components/items/item-types";

type ErrorPayload = { error?: { message?: string } };

async function readErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
  return payload.error?.message ?? "품목을 불러오지 못했습니다.";
}

export function ItemTable() {
  const [items, setItems] = useState<ItemRecord[]>([]);
  const [page, setPage] = useState({ number: 1, totalPages: 1, totalElements: 0 });
  const [keyword, setKeyword] = useState("");
  const [searchText, setSearchText] = useState("");
  const [role, setRole] = useState<CurrentUserPayload["role"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const loadItems = useCallback(async (nextPage: number, nextKeyword: string) => {
    setLoading(true);
    setMessage(null);

    const search = new URLSearchParams({ page: String(nextPage), size: "20" });
    if (nextKeyword) {
      search.set("itemKeyword", nextKeyword);
    }

    const response = await fetch(`/api/v1/items?${search}`, { credentials: "same-origin" });
    if (!response.ok) {
      setMessage(await readErrorMessage(response));
      setItems([]);
      setLoading(false);
      return;
    }

    const payload = (await response.json()) as ItemListPayload;
    setItems(payload.data);
    setPage({
      number: payload.page.number,
      totalPages: payload.page.totalPages,
      totalElements: payload.page.totalElements,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadItems(1, "");
    void fetch("/api/v1/auth/me", { credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { data: CurrentUserPayload };
        setRole(payload.data.role);
      })
      .catch(() => undefined);
  }, [loadItems]);

  const showPurchasePrice = items.some((item) => typeof item.purchasePrice === "number");
  const showOnHandQty = items.some((item) => typeof item.onHandQty === "number");
  const showMinStockQty = items.some((item) => "minStockQty" in item);
  const canManageItems = role === "ADMIN";

  const columns = useMemo<ColumnDef<ItemRecord>[]>(() => {
    const nextColumns: ColumnDef<ItemRecord>[] = [
      { accessorKey: "itemCode", header: "자체 품목코드" },
      {
        accessorKey: "itemName",
        header: "상품명",
        cell: ({ row }) =>
          canManageItems ? (
            <Link className="font-medium text-blue-700 hover:underline" href={`/items/${row.original.id}`}>
              {row.original.itemName}
            </Link>
          ) : (
            row.original.itemName
          ),
      },
      {
        id: "specification",
        header: "규격",
        cell: ({ row }) =>
          [row.original.unitSpec, row.original.unitName, `${row.original.packQty}${row.original.packUnit}`]
            .filter(Boolean)
            .join(" / "),
      },
      {
        accessorKey: "supplyPrice",
        header: "지점 공급단가",
        cell: ({ getValue }) => formatWon(getValue<number>()),
      },
    ];

    if (showPurchasePrice) {
      nextColumns.push({
        accessorKey: "purchasePrice",
        header: "매입단가",
        cell: ({ getValue }) => formatWon(getValue<number>()),
      });
    }

    if (showOnHandQty) {
      nextColumns.push(
        {
          accessorKey: "onHandQty",
          header: "실재고",
        },
        {
          accessorKey: "allocatedQty",
          header: "출고 대기",
        },
      );
    }

    nextColumns.push({
      accessorKey: "availableQty",
      header: role === "BRANCH" ? "재고" : "가용 재고",
    });

    if (showMinStockQty) {
      nextColumns.push({
        accessorKey: "minStockQty",
        header: "최소 재고 수량",
        cell: ({ row }) => {
          const value = row.original.minStockQty;
          return value === null || value === undefined ? "—" : value;
        },
      });
    }

    nextColumns.push({
      accessorKey: "isActive",
      header: "사용 여부",
      cell: ({ getValue }) => (getValue<boolean>() ? "사용" : "비활성"),
    });

    return nextColumns;
  }, [canManageItems, role, showMinStockQty, showOnHandQty, showPurchasePrice]);

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextKeyword = searchText.trim();
    setKeyword(nextKeyword);
    void loadItems(1, nextKeyword);
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">품목 관리</h1>
          <p className="mt-1 text-sm text-muted-foreground">상품 정보와 재고 현황을 조회합니다.</p>
        </div>
        {canManageItems ? (
          <Link
            href="/items/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            품목 등록
          </Link>
        ) : null}
      </div>

      <form className="flex max-w-md gap-2" onSubmit={submitSearch}>
        <label className="sr-only" htmlFor="itemKeyword">
          상품명 검색
        </label>
        <input
          id="itemKeyword"
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          placeholder="상품명 검색"
          className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <button className="h-10 rounded-md border px-4 text-sm font-medium" type="submit">
          검색
        </button>
      </form>

      {message ? <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{message}</p> : null}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="whitespace-nowrap px-4 py-3 font-medium">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={columns.length}>
                  불러오는 중입니다.
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={columns.length}>
                  조회된 품목이 없습니다.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-t">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">총 {page.totalElements.toLocaleString("ko-KR")}건</span>
        <div className="flex items-center gap-2">
          <button
            className="rounded-md border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={loading || page.number <= 1}
            onClick={() => void loadItems(page.number - 1, keyword)}
          >
            이전
          </button>
          <span>
            {page.number} / {page.totalPages}
          </span>
          <button
            className="rounded-md border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
            type="button"
            disabled={loading || page.number >= page.totalPages}
            onClick={() => void loadItems(page.number + 1, keyword)}
          >
            다음
          </button>
        </div>
      </div>
    </section>
  );
}

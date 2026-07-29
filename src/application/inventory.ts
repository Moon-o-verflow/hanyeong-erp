import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";

import { db } from "@/src/db/client";
import { inventoryLedger, items, users, vItemStock } from "@/src/db/schema";
import { AppError } from "@/src/lib/errors";
import { paginationOffset } from "@/src/lib/schemas/common";
import type {
  InventoryLedgerListInput,
  InventoryListInput,
} from "@/src/lib/schemas/inventory";

const inventoryResponseColumns = {
  id: items.id,
  itemCode: items.itemCode,
  itemName: items.itemName,
  barcode: items.barcode,
  categoryMajor: items.categoryMajor,
  categoryMinor: items.categoryMinor,
  unitSpec: items.unitSpec,
  unitName: items.unitName,
  packQty: items.packQty,
  packUnit: items.packUnit,
  purchasePrice: items.purchasePrice,
  supplyPrice: items.supplyPrice,
  minStockQty: items.minStockQty,
  isActive: items.isActive,
  onHandQty: vItemStock.onHandQty,
  allocatedQty: vItemStock.allocatedQty,
  availableQty: vItemStock.availableQty,
  isBelowMinStock: sql<boolean>`case when ${items.minStockQty} is not null and ${vItemStock.onHandQty} < ${items.minStockQty} then true else false end`,
};

export async function listInventory(values: InventoryListInput) {
  const conditions = [
    ...(values.itemKeyword ? [ilike(items.itemName, `%${values.itemKeyword}%`)] : []),
    ...(values.specKeyword
      ? [
          or(
            ilike(items.unitSpec, `%${values.specKeyword}%`),
            ilike(items.unitName, `%${values.specKeyword}%`),
            ilike(items.packUnit, `%${values.specKeyword}%`),
          ),
        ]
      : []),
  ];
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [data, totalResult] = await Promise.all([
    db
      .select(inventoryResponseColumns)
      .from(items)
      .innerJoin(vItemStock, eq(vItemStock.itemId, items.id))
      .where(where)
      .orderBy(asc(items.itemCode))
      .limit(values.size)
      .offset(paginationOffset(values)),
    db.select({ totalElements: count() }).from(items).where(where),
  ]);

  return { data, totalElements: totalResult[0]?.totalElements ?? 0 };
}

export async function listInventoryLedger(itemId: number, values: InventoryLedgerListInput) {
  const [item] = await db.select({ id: items.id }).from(items).where(eq(items.id, itemId)).limit(1);
  if (!item) {
    throw new AppError("NOT_FOUND");
  }

  const [data, totalResult] = await Promise.all([
    db
      .select({
        id: inventoryLedger.id,
        itemId: inventoryLedger.itemId,
        ledgerType: inventoryLedger.ledgerType,
        onHandDelta: inventoryLedger.onHandDelta,
        allocatedDelta: inventoryLedger.allocatedDelta,
        refType: inventoryLedger.refType,
        refId: inventoryLedger.refId,
        memo: inventoryLedger.memo,
        createdBy: inventoryLedger.createdBy,
        createdByName: users.userName,
        createdAt: inventoryLedger.createdAt,
      })
      .from(inventoryLedger)
      .leftJoin(users, eq(inventoryLedger.createdBy, users.id))
      .where(eq(inventoryLedger.itemId, itemId))
      .orderBy(desc(inventoryLedger.id))
      .limit(values.size)
      .offset(paginationOffset(values)),
    db
      .select({ totalElements: count() })
      .from(inventoryLedger)
      .where(eq(inventoryLedger.itemId, itemId)),
  ]);

  return { data, totalElements: totalResult[0]?.totalElements ?? 0 };
}

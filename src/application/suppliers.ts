import { and, asc, count, eq, ilike } from "drizzle-orm";

import { db } from "@/src/db/client";
import { suppliers } from "@/src/db/schema";
import { AppError } from "@/src/lib/errors";
import { paginationOffset } from "@/src/lib/schemas/common";
import type {
  SupplierCreateInput,
  SupplierListInput,
  SupplierUpdateInput,
} from "@/src/lib/schemas/suppliers";

const supplierResponseColumns = {
  id: suppliers.id,
  supplierName: suppliers.supplierName,
  contact: suppliers.contact,
  managerName: suppliers.managerName,
  remarks: suppliers.remarks,
  isActive: suppliers.isActive,
};

export async function listSuppliers(values: SupplierListInput) {
  const where = values.supplierKeyword
    ? and(ilike(suppliers.supplierName, `%${values.supplierKeyword}%`))
    : undefined;
  const [data, totalResult] = await Promise.all([
    db
      .select(supplierResponseColumns)
      .from(suppliers)
      .where(where)
      .orderBy(asc(suppliers.supplierName), asc(suppliers.id))
      .limit(values.size)
      .offset(paginationOffset(values)),
    db.select({ totalElements: count() }).from(suppliers).where(where),
  ]);

  return { data, totalElements: totalResult[0]?.totalElements ?? 0 };
}

export async function getSupplier(supplierId: number) {
  const [supplier] = await db
    .select(supplierResponseColumns)
    .from(suppliers)
    .where(eq(suppliers.id, supplierId))
    .limit(1);

  if (!supplier) {
    throw new AppError("NOT_FOUND");
  }

  return supplier;
}

export async function createSupplier(values: SupplierCreateInput) {
  // BR-SUP-001: supplier name is the only required supplier field.
  const [createdSupplier] = await db
    .insert(suppliers)
    .values(values)
    .returning({ id: suppliers.id });

  if (!createdSupplier) {
    throw new AppError("VALIDATION_ERROR");
  }

  return createdSupplier.id;
}

export async function updateSupplier(supplierId: number, values: SupplierUpdateInput) {
  const [updatedSupplier] = await db
    .update(suppliers)
    .set(values)
    .where(eq(suppliers.id, supplierId))
    .returning({ id: suppliers.id });

  if (!updatedSupplier) {
    throw new AppError("NOT_FOUND");
  }
}

export async function deactivateSupplier(supplierId: number) {
  const [deactivatedSupplier] = await db
    .update(suppliers)
    .set({ isActive: false })
    .where(eq(suppliers.id, supplierId))
    .returning({ id: suppliers.id });

  if (!deactivatedSupplier) {
    throw new AppError("NOT_FOUND");
  }
}

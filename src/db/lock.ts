import { sql } from "drizzle-orm";

import { db } from "@/src/db/client";

export const ITEM_LOCK_NAMESPACE = 1001;

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function withItemLock<T>(
  itemId: number,
  operation: (transaction: DatabaseTransaction) => Promise<T>,
): Promise<T> {
  // BR-INV-011: the transaction-scoped advisory lock serializes one item.
  return db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(${ITEM_LOCK_NAMESPACE}, ${itemId}::integer)`,
    );

    return operation(transaction);
  });
}

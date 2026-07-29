import { z } from "zod";

import { paginationSchema } from "@/src/lib/schemas/common";

export const inventoryListQuerySchema = paginationSchema.extend({
  itemKeyword: z.string().trim().min(1).optional(),
  specKeyword: z.string().trim().min(1).optional(),
});

export type InventoryListInput = z.output<typeof inventoryListQuerySchema>;

export const inventoryLedgerListQuerySchema = paginationSchema;
export type InventoryLedgerListInput = z.output<typeof inventoryLedgerListQuerySchema>;

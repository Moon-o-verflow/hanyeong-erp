import { z } from "zod";

import { paginationSchema } from "@/src/lib/schemas/common";

const optionalText = (maximumLength: number) =>
  z
    .string()
    .trim()
    .max(maximumLength)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const supplierCreateSchema = z.object({
  supplierName: z.string().trim().min(1).max(100),
  contact: optionalText(50),
  managerName: optionalText(50),
  remarks: optionalText(10_000),
});

export type SupplierCreateInput = z.output<typeof supplierCreateSchema>;

export const supplierUpdateSchema = z.object({
  supplierName: z.string().trim().min(1).max(100).optional(),
  contact: optionalText(50),
  managerName: optionalText(50),
  remarks: optionalText(10_000),
});

export type SupplierUpdateInput = z.output<typeof supplierUpdateSchema>;

export const supplierListQuerySchema = paginationSchema.extend({
  supplierKeyword: z.string().trim().min(1).optional(),
});

export type SupplierListInput = z.output<typeof supplierListQuerySchema>;

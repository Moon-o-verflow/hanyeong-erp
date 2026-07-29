import { z } from "zod";

import { AppError } from "@/src/lib/errors";
import { paginationSchema } from "@/src/lib/schemas/common";

const optionalText = (maximumLength: number) =>
  z
    .string()
    .trim()
    .max(maximumLength)
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

const optionalWholeNumber = z.number().int().nonnegative().nullable().optional();

export const itemCreateSchema = z.object({
  // BR-ITM-002: supplied itemCode is deliberately accepted then ignored.
  itemCode: z.unknown().optional(),
  itemName: z.string().trim().max(200).nullable().optional(),
  barcode: optionalText(50),
  categoryMajor: optionalText(50),
  categoryMinor: optionalText(50),
  unitSpec: optionalText(50),
  unitName: optionalText(20),
  packQty: z.number().int().positive().optional().default(1),
  packUnit: z.string().trim().min(1).max(20),
  purchasePrice: optionalWholeNumber,
  supplyPrice: optionalWholeNumber,
  minStockQty: optionalWholeNumber,
  remarks: optionalText(10_000),
});

export type ItemCreateInput = z.output<typeof itemCreateSchema>;

export function requireItemCreateFields(
  values: ItemCreateInput,
): asserts values is ItemCreateInput & {
  itemName: string;
  purchasePrice: number;
  supplyPrice: number;
} {
  const missingFields = [
    ...(typeof values.itemName === "string" && values.itemName.length > 0 ? [] : ["itemName"]),
    ...(typeof values.purchasePrice === "number" ? [] : ["purchasePrice"]),
    ...(typeof values.supplyPrice === "number" ? [] : ["supplyPrice"]),
  ];

  if (missingFields.length > 0) {
    // BR-ITM-001: the three user-entered required fields must be present.
    throw new AppError("REQUIRED_FIELD_MISSING", { fields: missingFields });
  }
}

export const itemUpdateSchema = z.object({
  itemCode: z.unknown().optional(),
  itemName: z.string().trim().min(1).max(200).optional(),
  barcode: optionalText(50),
  categoryMajor: optionalText(50),
  categoryMinor: optionalText(50),
  unitSpec: optionalText(50),
  unitName: optionalText(20),
  packQty: z.number().int().positive().optional(),
  packUnit: z.string().trim().min(1).max(20).optional(),
  purchasePrice: z.number().int().nonnegative().optional(),
  supplyPrice: z.number().int().nonnegative().optional(),
  minStockQty: optionalWholeNumber,
  remarks: optionalText(10_000),
});

export type ItemUpdateInput = z.output<typeof itemUpdateSchema>;

export const itemListQuerySchema = paginationSchema.extend({
  itemKeyword: z.string().trim().min(1).optional(),
  specKeyword: z.string().trim().min(1).optional(),
});

export type ItemListInput = z.output<typeof itemListQuerySchema>;

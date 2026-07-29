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

export const internalOrderCreateSchema = z.object({
  itemId: z.number().int().positive(),
  requestedQty: z.number().int().positive(),
  requestedDueDate: z.string().date(),
  remarks: optionalText(10_000),
  originOrderId: z.number().int().positive().nullable().optional(),
});
export type InternalOrderCreateInput = z.output<typeof internalOrderCreateSchema>;

export const internalOrderApproveSchema = z.object({
  approvedQty: z.number().int().positive(),
  plannedShipDate: z.string().date(),
});
export type InternalOrderApproveInput = z.output<typeof internalOrderApproveSchema>;

export const internalOrderRejectSchema = z.object({
  rejectReason: optionalText(10_000),
});
export type InternalOrderRejectInput = z.output<typeof internalOrderRejectSchema>;

export const internalOrderCancelSchema = z.object({
  cancelQty: z.number().int().positive(),
});
export type InternalOrderCancelInput = z.output<typeof internalOrderCancelSchema>;

export const internalOrderListQuerySchema = paginationSchema.extend({
  branchId: z.coerce.number().int().positive().optional(),
  status: z.string().trim().min(1).optional(),
  itemKeyword: z.string().trim().min(1).optional(),
  orderNo: z.string().trim().min(1).optional(),
});
export type InternalOrderListInput = z.output<typeof internalOrderListQuerySchema>;

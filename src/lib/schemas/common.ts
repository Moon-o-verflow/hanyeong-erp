import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().min(1).optional(),
});

export const listFilterSchema = paginationSchema.extend({
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  status: z.string().min(1).optional(),
  itemKeyword: z.string().trim().min(1).optional(),
  supplierKeyword: z.string().trim().min(1).optional(),
  orderNo: z.string().trim().min(1).optional(),
  userKeyword: z.string().trim().min(1).optional(),
  specKeyword: z.string().trim().min(1).optional(),
});

export type Pagination = z.infer<typeof paginationSchema>;

export function paginationOffset({ page, size }: Pagination) {
  return (page - 1) * size;
}

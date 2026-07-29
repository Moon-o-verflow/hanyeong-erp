import { z } from "zod";

import { AppError } from "@/src/lib/errors";

const resourceIdSchema = z.coerce.number().int().positive();

export function parseResourceId(value: string) {
  const parsed = resourceIdSchema.safeParse(value);

  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR");
  }

  return parsed.data;
}

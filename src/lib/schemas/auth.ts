import { z } from "zod";

export const loginRequestSchema = z.object({
  loginId: z.string().trim().min(1).max(50),
  password: z.string().min(1),
});

export const passwordChangeRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(1),
});

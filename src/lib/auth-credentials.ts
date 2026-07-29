import { compare, hash } from "bcryptjs";
import { and, eq } from "drizzle-orm";

import { db } from "@/src/db/client";
import { branches, users } from "@/src/db/schema";
import type { AuthenticatedUser, Role } from "@/src/lib/permissions";

export async function authenticateCredentials(
  loginId: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const [user] = await db
    .select({
      userId: users.id,
      userName: users.userName,
      passwordHash: users.passwordHash,
      role: users.role,
      branchId: users.branchId,
      branchName: branches.branchName,
    })
    .from(users)
    .leftJoin(branches, eq(users.branchId, branches.id))
    .where(and(eq(users.loginId, loginId), eq(users.isActive, true)))
    .limit(1);

  if (!user || !(await compare(password, user.passwordHash))) {
    return null;
  }

  return {
    userId: user.userId,
    userName: user.userName,
    role: user.role as Role,
    branchId: user.branchId,
    branchName: user.branchName,
  };
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
) {
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.isActive, true)))
    .limit(1);

  if (!user || !(await compare(currentPassword, user.passwordHash))) {
    return false;
  }

  await db
    .update(users)
    .set({ passwordHash: await hash(newPassword, 12) })
    .where(eq(users.id, userId));

  return true;
}

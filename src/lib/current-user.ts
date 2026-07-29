import { auth } from "@/src/lib/auth";
import { AppError } from "@/src/lib/errors";
import type { AuthenticatedUser } from "@/src/lib/permissions";

export async function requireCurrentUser(): Promise<AuthenticatedUser> {
  const session = await auth();

  if (!session?.user?.userId) {
    throw new AppError("UNAUTHENTICATED");
  }

  return {
    userId: session.user.userId,
    userName: session.user.name ?? "",
    role: session.user.role,
    branchId: session.user.branchId,
    branchName: session.user.branchName,
  };
}

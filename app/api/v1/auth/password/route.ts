import { changePassword } from "@/src/lib/auth-credentials";
import { dataResponse, handleRoute, parseJson } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { AppError } from "@/src/lib/errors";
import { passwordChangeRequestSchema } from "@/src/lib/schemas/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    const values = await parseJson(request, passwordChangeRequestSchema);
    const changed = await changePassword(user.userId, values.currentPassword, values.newPassword);

    if (!changed) {
      throw new AppError("UNAUTHENTICATED", undefined, "현재 비밀번호가 올바르지 않습니다.");
    }

    return dataResponse({ success: true });
  });
}

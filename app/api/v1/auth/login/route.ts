import { authenticateCredentials } from "@/src/lib/auth-credentials";
import { signIn } from "@/src/lib/auth";
import { dataResponse, handleRoute, parseJson } from "@/src/lib/api-response";
import { AppError } from "@/src/lib/errors";
import { loginRequestSchema } from "@/src/lib/schemas/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const credentials = await parseJson(request, loginRequestSchema);
    const user = await authenticateCredentials(credentials.loginId, credentials.password);

    if (!user) {
      throw new AppError("UNAUTHENTICATED", undefined, "로그인 ID 또는 비밀번호가 올바르지 않습니다.");
    }

    await signIn("credentials", {
      loginId: credentials.loginId,
      password: credentials.password,
      redirect: false,
    });

    return dataResponse({
      userId: user.userId,
      userName: user.userName,
      role: user.role,
      branchId: user.branchId,
      branchName: user.branchName,
    });
  });
}

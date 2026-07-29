import { signOut } from "@/src/lib/auth";
import { dataResponse, handleRoute } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return handleRoute(async () => {
    await requireCurrentUser();
    await signOut({ redirect: false });

    return dataResponse({ success: true });
  });
}

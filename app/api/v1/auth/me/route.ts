import { dataResponse, handleRoute } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => dataResponse(await requireCurrentUser()));
}

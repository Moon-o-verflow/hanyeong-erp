import { getInternalOrder } from "@/src/application/internal-orders";
import { dataResponse, handleRoute } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { requireAction, resolveBranchScope } from "@/src/lib/permissions";
import { parseResourceId } from "@/src/lib/route-params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "internalOrder.read");
    const { id } = await context.params;
    return dataResponse(await getInternalOrder(parseResourceId(id), resolveBranchScope(user)));
  });
}

import { approveInternalOrder, getInternalOrder } from "@/src/application/internal-orders";
import { dataResponse, handleRoute, parseJson } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { requireAction } from "@/src/lib/permissions";
import { parseResourceId } from "@/src/lib/route-params";
import { internalOrderApproveSchema } from "@/src/lib/schemas/internal-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "internalOrder.approve");
    const { id } = await context.params;
    const internalOrderId = parseResourceId(id);
    await approveInternalOrder(
      internalOrderId,
      await parseJson(request, internalOrderApproveSchema),
      user.userId,
    );
    return dataResponse(await getInternalOrder(internalOrderId));
  });
}

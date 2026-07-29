import {
  cancelInternalOrderOutstanding,
  getInternalOrder,
} from "@/src/application/internal-orders";
import { dataResponse, handleRoute, parseJson } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { AppError } from "@/src/lib/errors";
import { requireAction } from "@/src/lib/permissions";
import { parseResourceId } from "@/src/lib/route-params";
import { internalOrderCancelSchema } from "@/src/lib/schemas/internal-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "internalOrder.cancel");
    if (!user.branchId) {
      throw new AppError("UNAUTHENTICATED");
    }
    const { id } = await context.params;
    const internalOrderId = parseResourceId(id);
    await cancelInternalOrderOutstanding(
      internalOrderId,
      await parseJson(request, internalOrderCancelSchema),
      user.branchId,
    );
    return dataResponse(await getInternalOrder(internalOrderId, user.branchId));
  });
}

import { listInternalOrders } from "@/src/application/internal-orders";
import { handleRoute, listResponse } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { AppError } from "@/src/lib/errors";
import { requireAction, resolveBranchScope } from "@/src/lib/permissions";
import { internalOrderListQuerySchema } from "@/src/lib/schemas/internal-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "internalOrder.outstanding.read");
    const parsed = internalOrderListQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR");
    }

    const result = await listInternalOrders(parsed.data, resolveBranchScope(user, parsed.data.branchId), true);
    return listResponse(result.data, {
      number: parsed.data.page,
      size: parsed.data.size,
      totalElements: result.totalElements,
    });
  });
}

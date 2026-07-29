import { listInventoryLedger } from "@/src/application/inventory";
import { handleRoute, listResponse } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { AppError } from "@/src/lib/errors";
import { requireAction } from "@/src/lib/permissions";
import { parseResourceId } from "@/src/lib/route-params";
import { inventoryLedgerListQuerySchema } from "@/src/lib/schemas/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ itemId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "inventory.ledger.read");
    const { itemId } = await context.params;
    const parsed = inventoryLedgerListQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR");
    }

    const result = await listInventoryLedger(parseResourceId(itemId), parsed.data);
    return listResponse(result.data, {
      number: parsed.data.page,
      size: parsed.data.size,
      totalElements: result.totalElements,
    });
  });
}

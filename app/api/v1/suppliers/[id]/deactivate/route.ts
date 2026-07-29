import { deactivateSupplier, getSupplier } from "@/src/application/suppliers";
import { dataResponse, handleRoute } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { requireAction } from "@/src/lib/permissions";
import { parseResourceId } from "@/src/lib/route-params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: RouteContext) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "supplier.deactivate");
    const { id } = await context.params;
    const supplierId = parseResourceId(id);
    await deactivateSupplier(supplierId);

    return dataResponse(await getSupplier(supplierId));
  });
}

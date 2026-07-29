import { getSupplier, updateSupplier } from "@/src/application/suppliers";
import { dataResponse, handleRoute, parseJson } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { requireAction } from "@/src/lib/permissions";
import { parseResourceId } from "@/src/lib/route-params";
import { supplierUpdateSchema } from "@/src/lib/schemas/suppliers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "supplier.write");
    const { id } = await context.params;
    const supplierId = parseResourceId(id);
    await updateSupplier(supplierId, await parseJson(request, supplierUpdateSchema));

    return dataResponse(await getSupplier(supplierId));
  });
}

import { getItem, updateItem } from "@/src/application/items";
import { dataResponse, handleRoute, parseJson } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { maskItemFields, requireAction } from "@/src/lib/permissions";
import { parseResourceId } from "@/src/lib/route-params";
import { itemUpdateSchema } from "@/src/lib/schemas/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "item.read");
    const { id } = await context.params;
    const item = await getItem(parseResourceId(id));

    return dataResponse(maskItemFields(user, item));
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "item.write");
    const { id } = await context.params;
    const values = await parseJson(request, itemUpdateSchema);
    await updateItem(parseResourceId(id), values);
    const item = await getItem(parseResourceId(id));

    return dataResponse(maskItemFields(user, item));
  });
}

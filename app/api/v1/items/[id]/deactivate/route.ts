import { deactivateItem, getItem } from "@/src/application/items";
import { dataResponse, handleRoute } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { maskItemFields, requireAction } from "@/src/lib/permissions";
import { parseResourceId } from "@/src/lib/route-params";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_: Request, context: RouteContext) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "item.deactivate");
    const { id } = await context.params;
    const itemId = parseResourceId(id);
    await deactivateItem(itemId);

    return dataResponse(maskItemFields(user, await getItem(itemId)));
  });
}

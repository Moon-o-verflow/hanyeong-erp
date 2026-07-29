import { listInventory } from "@/src/application/inventory";
import { handleRoute, listResponse } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { AppError } from "@/src/lib/errors";
import { maskItemFields, requireAction } from "@/src/lib/permissions";
import { inventoryListQuerySchema } from "@/src/lib/schemas/inventory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "inventory.read");
    const parsed = inventoryListQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR");
    }

    const result = await listInventory(parsed.data);
    return listResponse(
      result.data.map((item) => maskItemFields(user, item)),
      {
        number: parsed.data.page,
        size: parsed.data.size,
        totalElements: result.totalElements,
      },
    );
  });
}

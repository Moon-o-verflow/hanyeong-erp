import { listSpecParseFailedItems } from "@/src/application/items";
import { handleRoute, listResponse } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { AppError } from "@/src/lib/errors";
import { maskItemFields, requireAction } from "@/src/lib/permissions";
import { itemListQuerySchema } from "@/src/lib/schemas/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "item.bulkUpload");
    const parsed = itemListQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR");
    }

    const result = await listSpecParseFailedItems(parsed.data);
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

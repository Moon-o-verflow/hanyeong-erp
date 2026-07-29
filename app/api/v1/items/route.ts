import { createItem, getItem, listItems } from "@/src/application/items";
import { dataResponse, handleRoute, listResponse, parseJson } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { AppError } from "@/src/lib/errors";
import { maskItemFields, requireAction } from "@/src/lib/permissions";
import { itemCreateSchema, itemListQuerySchema } from "@/src/lib/schemas/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseListQuery(request: Request) {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = itemListQuerySchema.safeParse(query);

  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR");
  }

  return parsed.data;
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "item.read");
    const values = parseListQuery(request);
    const result = await listItems(values);

    return listResponse(
      result.data.map((item) => maskItemFields(user, item)),
      {
        number: values.page,
        size: values.size,
        totalElements: result.totalElements,
      },
    );
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "item.write");
    const values = await parseJson(request, itemCreateSchema);
    const itemId = await createItem(values);

    return dataResponse(maskItemFields(user, await getItem(itemId)), 201);
  });
}

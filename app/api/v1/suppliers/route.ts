import { createSupplier, getSupplier, listSuppliers } from "@/src/application/suppliers";
import { dataResponse, handleRoute, listResponse, parseJson } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { AppError } from "@/src/lib/errors";
import { requireAction } from "@/src/lib/permissions";
import { supplierCreateSchema, supplierListQuerySchema } from "@/src/lib/schemas/suppliers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseListQuery(request: Request) {
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = supplierListQuerySchema.safeParse(query);

  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR");
  }

  return parsed.data;
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "supplier.read");
    const values = parseListQuery(request);
    const result = await listSuppliers(values);

    return listResponse(result.data, {
      number: values.page,
      size: values.size,
      totalElements: result.totalElements,
    });
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "supplier.write");
    const supplierId = await createSupplier(await parseJson(request, supplierCreateSchema));

    return dataResponse(await getSupplier(supplierId), 201);
  });
}

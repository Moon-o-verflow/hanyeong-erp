import {
  createInternalOrder,
  getInternalOrder,
  listInternalOrders,
} from "@/src/application/internal-orders";
import { dataResponse, handleRoute, listResponse, parseJson } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { AppError } from "@/src/lib/errors";
import { requireAction, resolveBranchScope } from "@/src/lib/permissions";
import {
  internalOrderCreateSchema,
  internalOrderListQuerySchema,
} from "@/src/lib/schemas/internal-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseListQuery(request: Request) {
  const parsed = internalOrderListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR");
  }

  return parsed.data;
}

export async function GET(request: Request) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "internalOrder.read");
    const values = parseListQuery(request);
    const result = await listInternalOrders(values, resolveBranchScope(user, values.branchId));

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
    requireAction(user, "internalOrder.create");
    if (!user.branchId) {
      throw new AppError("UNAUTHENTICATED");
    }

    const internalOrderId = await createInternalOrder(
      await parseJson(request, internalOrderCreateSchema),
      user.branchId,
      user.userId,
    );
    return dataResponse(await getInternalOrder(internalOrderId, user.branchId), 201);
  });
}

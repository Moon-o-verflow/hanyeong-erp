import { importItemWorkbook } from "@/src/application/item-import";
import { dataResponse, handleRoute } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { AppError } from "@/src/lib/errors";
import { requireAction } from "@/src/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "item.bulkUpload");
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", { field: "file" });
    }

    return dataResponse(await importItemWorkbook(file, user.userId), 201);
  });
}

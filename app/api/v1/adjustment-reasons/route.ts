import { asc, eq } from "drizzle-orm";

import { dataResponse, handleRoute } from "@/src/lib/api-response";
import { requireCurrentUser } from "@/src/lib/current-user";
import { db } from "@/src/db/client";
import { adjustmentReasons } from "@/src/db/schema";
import { requireAction } from "@/src/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleRoute(async () => {
    const user = await requireCurrentUser();
    requireAction(user, "inventory.adjust");

    const reasons = await db
      .select({
        code: adjustmentReasons.code,
        label: adjustmentReasons.label,
        requiresText: adjustmentReasons.requiresText,
      })
      .from(adjustmentReasons)
      .where(eq(adjustmentReasons.isActive, true))
      .orderBy(asc(adjustmentReasons.sortOrder));

    return dataResponse(reasons);
  });
}

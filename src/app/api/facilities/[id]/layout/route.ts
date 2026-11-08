import { AppError } from "@/lib/errors";
import { withFacilityApi } from "@/server/http";
import { getLatestLayout } from "@/server/repositories/facilities";

export const dynamic = "force-dynamic";

export const GET = withFacilityApi("layouts:read", async (_request, context, facilityId) => {
  const layout = await getLatestLayout(context.organizationId, context.userId, facilityId);
  if (!layout) throw new AppError("NOT_FOUND", "No layout has been saved for this facility.", 404);
  return { data: layout };
});

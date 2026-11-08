import { withFacilityApi } from "@/server/http";
import { listInsights } from "@/server/repositories/records";

export const dynamic = "force-dynamic";

export const GET = withFacilityApi("insights:read", async (_request, context, facilityId) => {
  return listInsights(context.organizationId, context.userId, facilityId);
});

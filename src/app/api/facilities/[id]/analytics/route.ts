import { getFacilityAnalytics } from "@/server/services/analytics-service";
import { withFacilityApi } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = withFacilityApi("facilities:read", async (request, context, facilityId) => {
  const url = new URL(request.url);
  return getFacilityAnalytics({
    organizationId: context.organizationId,
    userId: context.userId,
    facilityId,
    role: context.role,
    query: { from: url.searchParams.get("from"), to: url.searchParams.get("to") },
  });
});

import { metricListSchema, parseSearchParams } from "@/lib/validation";
import { withFacilityApi } from "@/server/http";
import { listOperationalMetrics } from "@/server/repositories/records";

export const dynamic = "force-dynamic";

export const GET = withFacilityApi("operations:read", async (request, context, facilityId) => {
  const query = parseSearchParams(new URL(request.url), metricListSchema);
  return listOperationalMetrics(context.organizationId, context.userId, facilityId, query);
});

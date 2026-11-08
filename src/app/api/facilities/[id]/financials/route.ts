import { financialListSchema, parseSearchParams } from "@/lib/validation";
import { withFacilityApi } from "@/server/http";
import { listFinancialMetrics } from "@/server/repositories/records";

export const dynamic = "force-dynamic";

export const GET = withFacilityApi("finance:read", async (request, context, facilityId) => {
  const query = parseSearchParams(new URL(request.url), financialListSchema);
  return listFinancialMetrics(context.organizationId, context.userId, facilityId, query);
});

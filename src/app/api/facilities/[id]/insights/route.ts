import { withFacilityApi } from "@/server/http";
import {
  generateFacilityInsights,
  listInsightsForFacility,
} from "@/server/services/insight-service";

export const dynamic = "force-dynamic";

export const GET = withFacilityApi("insights:read", async (_request, context, facilityId) => {
  const data = await listInsightsForFacility({
    organizationId: context.organizationId,
    userId: context.userId,
    facilityId,
    role: context.role,
  });
  return { data, total: data.length };
});

export const POST = withFacilityApi("insights:write", async (request, context, facilityId) => {
  const url = new URL(request.url);
  return generateFacilityInsights({
    organizationId: context.organizationId,
    userId: context.userId,
    facilityId,
    role: context.role,
    query: {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    },
  });
});

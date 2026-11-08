import { paginationSchema, parseSearchParams } from "@/lib/validation";
import { withFacilityApi } from "@/server/http";
import { listAreas } from "@/server/repositories/facilities";

export const dynamic = "force-dynamic";

export const GET = withFacilityApi("facilities:read", async (request, context, facilityId) => {
  const query = parseSearchParams(new URL(request.url), paginationSchema);
  return listAreas(context.organizationId, context.userId, facilityId, query.page, query.limit);
});

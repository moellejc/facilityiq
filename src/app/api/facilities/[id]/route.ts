import { assertRole } from "@/lib/permissions";
import { withFacilityApi } from "@/server/http";
import { getFacility } from "@/server/repositories/facilities";

export const dynamic = "force-dynamic";

export const GET = withFacilityApi("facilities:read", async (_request, context, facilityId) => {
  assertRole(context.role, "facilities:read");
  const facility = await getFacility(context.organizationId, context.userId, facilityId);
  return { data: facility };
});

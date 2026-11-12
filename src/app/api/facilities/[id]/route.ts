import { readJson } from "@/lib/api";
import { assertRole } from "@/lib/permissions";
import { withFacilityApi } from "@/server/http";
import { getFacility } from "@/server/repositories/facilities";
import { removeFacilityRecord, updateFacilityRecord } from "@/server/services/facility-service";

export const dynamic = "force-dynamic";

export const GET = withFacilityApi("facilities:read", async (_request, context, facilityId) => {
  assertRole(context.role, "facilities:read");
  const facility = await getFacility(context.organizationId, context.userId, facilityId);
  return { data: facility };
});

export const PATCH = withFacilityApi("facilities:write", async (request, context, facilityId) => {
  return updateFacilityRecord(context, facilityId, await readJson(request));
});

export const DELETE = withFacilityApi("facilities:write", async (_request, context, facilityId) => {
  return removeFacilityRecord(context, facilityId);
});

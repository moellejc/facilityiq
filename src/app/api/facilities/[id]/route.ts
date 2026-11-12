import { readJson } from "@/lib/api";
import { withFacilityApi } from "@/server/http";
import {
  readFacilityRecord,
  removeFacilityRecord,
  updateFacilityRecord,
} from "@/server/services/facility-service";

export const dynamic = "force-dynamic";

export const GET = withFacilityApi("facilities:read", async (_request, context, facilityId) => {
  return readFacilityRecord(context, facilityId);
});

export const PATCH = withFacilityApi("facilities:write", async (request, context, facilityId) => {
  return updateFacilityRecord(context, facilityId, await readJson(request));
});

export const DELETE = withFacilityApi("facilities:write", async (_request, context, facilityId) => {
  return removeFacilityRecord(context, facilityId);
});

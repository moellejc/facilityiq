import { assertRole } from "@/lib/permissions";
import { loadFacilityScene } from "@/server/repositories/scene";

import type { RequestContext } from "./context";

export async function getFacilityScene(context: RequestContext) {
  assertRole(context.role, "twin:read");
  if (!context.facilityId) return null;
  return loadFacilityScene(context.organizationId, context.userId, context.facilityId);
}

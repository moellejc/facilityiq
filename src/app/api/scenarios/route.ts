import { assertRole } from "@/lib/permissions";
import { withApi } from "@/server/http";
import { listScenarios } from "@/server/repositories/records";

export const dynamic = "force-dynamic";

export const GET = withApi(async (_request, context) => {
  assertRole(context.role, "scenarios:read");
  return listScenarios(context.organizationId, context.userId, context.facilityId ?? undefined);
});

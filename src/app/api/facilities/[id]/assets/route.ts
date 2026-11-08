import { assetListSchema, parseSearchParams } from "@/lib/validation";
import { withFacilityApi } from "@/server/http";
import { listAssets } from "@/server/repositories/facilities";

export const dynamic = "force-dynamic";

export const GET = withFacilityApi("facilities:read", async (request, context, facilityId) => {
  const query = parseSearchParams(new URL(request.url), assetListSchema);
  return listAssets(context.organizationId, context.userId, facilityId, query);
});

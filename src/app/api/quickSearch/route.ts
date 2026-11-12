import { withApi } from "@/server/http";
import { searchFacilities } from "@/server/services/facility-service";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request, context) => {
  return searchFacilities(context, Object.fromEntries(request.nextUrl.searchParams.entries()));
});

import { withApi } from "@/server/http";
import { searchFacilitiesByName } from "@/server/services/facility-service";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request, context) =>
  searchFacilitiesByName(context, Object.fromEntries(request.nextUrl.searchParams)),
);

import { assertRole } from "@/lib/permissions";
import { paginationSchema, parseSearchParams } from "@/lib/validation";
import { withApi } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request, context) => {
  assertRole(context.role, "facilities:read");
  const query = parseSearchParams(new URL(request.url), paginationSchema);
  const start = (query.page - 1) * query.limit;
  const data = context.facilities.slice(start, start + query.limit);
  return { data, page: query.page, limit: query.limit, total: context.facilities.length };
});

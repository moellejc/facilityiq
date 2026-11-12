import { readJson } from "@/lib/api";
import { paginationSchema, parseSearchParams } from "@/lib/validation";
import { withApi } from "@/server/http";
import {
  addOrganizationMember,
  listOrganizationMembers,
} from "@/server/services/organization-service";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request, context) => {
  const query = parseSearchParams(new URL(request.url), paginationSchema);
  return listOrganizationMembers(context, query);
});

export const POST = withApi(async (request, context) => {
  return { data: await addOrganizationMember(context, await readJson(request)) };
});

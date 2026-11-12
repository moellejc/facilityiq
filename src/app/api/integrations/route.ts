import { readJson } from "@/lib/api";
import { paginationSchema, parseSearchParams } from "@/lib/validation";
import { withApi } from "@/server/http";
import {
  createIntegrationRecord,
  listIntegrationRecords,
} from "@/server/services/integration-service";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request, context) => {
  const query = parseSearchParams(new URL(request.url), paginationSchema);
  return listIntegrationRecords(context, query);
});

export const POST = withApi(async (request, context) => {
  return createIntegrationRecord(context, await readJson(request));
});

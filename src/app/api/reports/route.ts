import { assertRole } from "@/lib/permissions";
import { notImplemented, withApi } from "@/server/http";

export const dynamic = "force-dynamic";

/** Authenticated stub. Report generation is a later phase. */
export const GET = withApi(async (_request, context) => {
  assertRole(context.role, "reports:read");
  notImplemented("Reports");
});

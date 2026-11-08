import { assertRole } from "@/lib/permissions";
import { notImplemented, withApi } from "@/server/http";

export const dynamic = "force-dynamic";

/** Authenticated stub. Signed uploads are Phase 6. */
export const GET = withApi(async () => {
  notImplemented("File uploads");
});

export const POST = withApi(async (_request, context) => {
  assertRole(context.role, "uploads:write");
  notImplemented("File uploads");
});

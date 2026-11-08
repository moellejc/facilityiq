import { assertRole } from "@/lib/permissions";
import { withApi } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = withApi(async (_request, context) => {
  assertRole(context.role, "members:read");
  return {
    data: context.memberships.map((membership) => ({
      id: membership.organizationId,
      name: membership.name,
      slug: membership.slug,
      role: membership.role,
    })),
  };
});

import { AppError } from "@/lib/errors";
import { assertRole, type Role } from "@/lib/permissions";
import { organizationUpdateSchema, memberRoleSchema } from "@/lib/validation";

import { listMembers, updateMemberRole, updateOrganizationName } from "../repositories/membership";
import type { RequestContext } from "./context";

export async function getOrganizationDirectory(context: RequestContext) {
  assertRole(context.role, "members:read");
  const members = await listMembers(context.organizationId, context.userId);
  return {
    organization: {
      id: context.organizationId,
      name: context.organizationName,
      slug: context.organizationSlug,
    },
    members,
  };
}

export async function renameOrganization(context: RequestContext, input: unknown) {
  assertRole(context.role, "organization:update");
  const { name } = organizationUpdateSchema.parse(input);
  const organization = await updateOrganizationName(context.organizationId, context.userId, name);
  if (!organization) throw new AppError("NOT_FOUND", "Organization not found.", 404);
  return organization;
}

export async function changeMemberRole(context: RequestContext, input: unknown) {
  assertRole(context.role, "members:write");
  const { memberId, role } = memberRoleSchema.parse(input);
  const result = await updateMemberRole(
    context.organizationId,
    context.userId,
    memberId,
    role as Role,
  );
  if (result.status === "missing") {
    throw new AppError("NOT_FOUND", "Member not found.", 404);
  }
  if (result.status === "last_admin") {
    throw new AppError("CONFLICT", "The organization needs at least one administrator.", 409);
  }
  return result.member;
}

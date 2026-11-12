import { AppError } from "@/lib/errors";
import { assertRole, type Role } from "@/lib/permissions";
import {
  organizationUpdateSchema,
  memberRoleSchema,
  memberAddSchema,
  memberRemoveSchema,
} from "@/lib/validation";

import {
  addMember,
  listMembers,
  listMembersPage,
  removeMember,
  updateMemberRole,
  updateOrganizationName,
} from "../repositories/membership";
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

export async function listOrganizationMembers(
  context: RequestContext,
  query: { page: number; limit: number },
) {
  assertRole(context.role, "members:read");
  return listMembersPage(context.organizationId, context.userId, query.page, query.limit);
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

export async function addOrganizationMember(context: RequestContext, input: unknown) {
  assertRole(context.role, "members:write");
  const { email, role } = memberAddSchema.parse(input);
  const result = await addMember(context.organizationId, context.userId, email, role);
  if (result.status === "missing_user") {
    throw new AppError(
      "NOT_FOUND",
      "No account exists for that email. New account invitations are not available yet.",
      404,
    );
  }
  if (result.status === "exists") {
    throw new AppError("CONFLICT", "That person is already a member of this organization.", 409);
  }
  return result.member;
}

export async function removeOrganizationMember(context: RequestContext, input: unknown) {
  assertRole(context.role, "members:write");
  const { memberId } = memberRemoveSchema.parse(input);
  const result = await removeMember(context.organizationId, context.userId, memberId);
  if (result.status === "missing") {
    throw new AppError("NOT_FOUND", "Member not found.", 404);
  }
  if (result.status === "last_admin") {
    throw new AppError("CONFLICT", "The organization needs at least one administrator.", 409);
  }
  return { id: result.member.id };
}

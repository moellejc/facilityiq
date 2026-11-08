import { and, eq, sql } from "drizzle-orm";

import { withTenant, withUser } from "@/db/tenant";
import { auditLogs, organizationMembers, organizations, users } from "@/db/schema";
import type { Role } from "@/lib/permissions";

export async function listMemberships(userId: string) {
  return withUser(userId, async (tx) => {
    return tx
      .select({
        memberId: organizationMembers.id,
        organizationId: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(eq(organizationMembers.userId, userId))
      .orderBy(organizations.name);
  });
}

export async function listMembers(organizationId: string, userId: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    return tx
      .select({
        memberId: organizationMembers.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, organizationId))
      .orderBy(users.email);
  });
}

export async function updateOrganizationName(organizationId: string, userId: string, name: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [organization] = await tx
      .update(organizations)
      .set({ name, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId))
      .returning({ id: organizations.id, name: organizations.name, slug: organizations.slug });
    if (!organization) return null;
    await tx.insert(auditLogs).values({
      organizationId,
      actorUserId: userId,
      action: "organization.update",
      entityType: "organization",
      entityId: organizationId,
      metadata: { name },
    });
    return organization;
  });
}

export async function updateMemberRole(
  organizationId: string,
  actorUserId: string,
  memberId: string,
  role: Role,
) {
  return withTenant({ organizationId, userId: actorUserId }, async (tx) => {
    const [member] = await tx
      .select({
        id: organizationMembers.id,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.id, memberId),
          eq(organizationMembers.organizationId, organizationId),
        ),
      );
    if (!member) return { status: "missing" as const };

    if (member.role === "org_admin" && role !== "org_admin") {
      const [admins] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.role, "org_admin"),
          ),
        );
      if (Number(admins?.total ?? 0) <= 1) {
        return { status: "last_admin" as const };
      }
    }

    const [updated] = await tx
      .update(organizationMembers)
      .set({ role })
      .where(eq(organizationMembers.id, member.id))
      .returning({ id: organizationMembers.id, role: organizationMembers.role });

    await tx.insert(auditLogs).values({
      organizationId,
      actorUserId,
      action: "member.role_update",
      entityType: "organization_member",
      entityId: member.id,
      metadata: { from: member.role, to: role, userId: member.userId },
    });

    return { status: "updated" as const, member: updated };
  });
}

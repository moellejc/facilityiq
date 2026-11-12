import { and, asc, count, eq, sql } from "drizzle-orm";

import { withTenant, withUser } from "@/db/tenant";
import { auditLogs, organizationMembers, organizations, users } from "@/db/schema";
import { isUniqueViolation } from "@/lib/postgres";
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

export async function listMembersPage(
  organizationId: string,
  userId: string,
  page: number,
  limit: number,
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const where = eq(organizationMembers.organizationId, organizationId);
    const [totalRow] = await tx.select({ total: count() }).from(organizationMembers).where(where);
    const data = await tx
      .select({
        memberId: organizationMembers.id,
        userId: users.id,
        name: users.name,
        email: users.email,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(where)
      .orderBy(asc(users.email), asc(organizationMembers.id))
      .limit(limit)
      .offset((page - 1) * limit);
    return { data, total: Number(totalRow?.total ?? 0), page, limit };
  });
}

export async function addMember(
  organizationId: string,
  actorUserId: string,
  email: string,
  role: Role,
) {
  try {
    return await withTenant({ organizationId, userId: actorUserId }, async (tx) => {
      const [user] = await tx
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(sql`lower(${users.email}) = ${email}`)
        .limit(1);
      if (!user) return { status: "missing_user" as const };

      const [existing] = await tx
        .select({ id: organizationMembers.id })
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, organizationId),
            eq(organizationMembers.userId, user.id),
          ),
        );
      if (existing) return { status: "exists" as const };

      const [created] = await tx
        .insert(organizationMembers)
        .values({ organizationId, userId: user.id, role })
        .returning({ id: organizationMembers.id, role: organizationMembers.role });
      if (!created) return { status: "exists" as const };

      await tx.insert(auditLogs).values({
        organizationId,
        actorUserId,
        action: "member.add",
        entityType: "organization_member",
        entityId: created.id,
        metadata: { userId: user.id, role },
      });

      return {
        status: "created" as const,
        member: {
          memberId: created.id,
          userId: user.id,
          name: user.name,
          email: user.email,
          role: created.role,
        },
      };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "exists" as const };
    throw error;
  }
}

export async function removeMember(organizationId: string, actorUserId: string, memberId: string) {
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

    if (member.role === "org_admin") {
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

    await tx
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.id, member.id),
          eq(organizationMembers.organizationId, organizationId),
        ),
      );
    await tx.insert(auditLogs).values({
      organizationId,
      actorUserId,
      action: "member.remove",
      entityType: "organization_member",
      entityId: member.id,
      metadata: { userId: member.userId, role: member.role },
    });
    return { status: "removed" as const, member };
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

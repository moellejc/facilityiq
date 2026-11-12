import "server-only";

import { and, asc, count, eq } from "drizzle-orm";

import { withTenant } from "@/db/tenant";
import { auditLogs, integrations } from "@/db/schema";
import type { IntegrationProvider, IntegrationStatus } from "@/lib/integrations";
import { isUniqueViolation } from "@/lib/postgres";

const integrationColumns = {
  id: integrations.id,
  name: integrations.name,
  provider: integrations.provider,
  status: integrations.status,
  externalReference: integrations.externalReference,
};

export type IntegrationInput = {
  name: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
  externalReference: string | null;
};

export type IntegrationPatch = {
  name?: string;
  provider?: IntegrationProvider;
  status?: IntegrationStatus;
  externalReference?: string | null;
};

export async function listIntegrations(
  organizationId: string,
  userId: string,
  page: number,
  limit: number,
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const where = eq(integrations.organizationId, organizationId);
    const [totalRow] = await tx.select({ total: count() }).from(integrations).where(where);
    const data = await tx
      .select(integrationColumns)
      .from(integrations)
      .where(where)
      .orderBy(asc(integrations.name), asc(integrations.id))
      .limit(limit)
      .offset((page - 1) * limit);
    return { data, total: Number(totalRow?.total ?? 0), page, limit };
  });
}

export async function insertIntegration(
  organizationId: string,
  userId: string,
  input: IntegrationInput,
) {
  try {
    return await withTenant({ organizationId, userId }, async (tx) => {
      const [integration] = await tx
        .insert(integrations)
        .values({
          organizationId,
          name: input.name,
          provider: input.provider,
          status: input.status,
          externalReference: input.externalReference,
        })
        .returning(integrationColumns);
      if (!integration) return { status: "conflict" as const };
      await tx.insert(auditLogs).values({
        organizationId,
        actorUserId: userId,
        action: "integration.create",
        entityType: "integration",
        entityId: integration.id,
        metadata: {
          name: integration.name,
          provider: integration.provider,
          status: integration.status,
        },
      });
      return { status: "created" as const, integration };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "conflict" as const };
    throw error;
  }
}

export async function updateIntegration(
  organizationId: string,
  userId: string,
  integrationId: string,
  patch: IntegrationPatch,
) {
  try {
    return await withTenant({ organizationId, userId }, async (tx) => {
      const [integration] = await tx
        .update(integrations)
        .set({ ...patch, updatedAt: new Date() })
        .where(
          and(eq(integrations.organizationId, organizationId), eq(integrations.id, integrationId)),
        )
        .returning(integrationColumns);
      if (!integration) return { status: "missing" as const };
      await tx.insert(auditLogs).values({
        organizationId,
        actorUserId: userId,
        action: "integration.update",
        entityType: "integration",
        entityId: integration.id,
        metadata: {
          name: integration.name,
          provider: integration.provider,
          status: integration.status,
        },
      });
      return { status: "updated" as const, integration };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "conflict" as const };
    throw error;
  }
}

export async function deleteIntegration(
  organizationId: string,
  userId: string,
  integrationId: string,
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [existing] = await tx
      .select({ id: integrations.id, name: integrations.name })
      .from(integrations)
      .where(
        and(eq(integrations.organizationId, organizationId), eq(integrations.id, integrationId)),
      );
    if (!existing) return { status: "missing" as const };
    await tx.insert(auditLogs).values({
      organizationId,
      actorUserId: userId,
      action: "integration.delete",
      entityType: "integration",
      entityId: existing.id,
      metadata: { name: existing.name },
    });
    await tx
      .delete(integrations)
      .where(
        and(eq(integrations.organizationId, organizationId), eq(integrations.id, existing.id)),
      );
    return { status: "deleted" as const, integration: existing };
  });
}

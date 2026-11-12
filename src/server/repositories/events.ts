import "server-only";

import { and, count, desc, eq, inArray } from "drizzle-orm";

import { withTenant } from "@/db/tenant";
import { assetEvents, assets, facilityAreas } from "@/db/schema";
import type { AttentionFilter } from "@/lib/attention";

export const ATTENTION_EVENT_LIMIT = 100;

const ATTENTION_SEVERITIES = ["warning", "critical"] as const;

export async function listFacilityAttentionEvents(
  organizationId: string,
  userId: string,
  facilityId: string,
  severity: AttentionFilter,
) {
  const severities: Array<(typeof ATTENTION_SEVERITIES)[number]> =
    severity === "all" ? [...ATTENTION_SEVERITIES] : [severity];
  return withTenant({ organizationId, userId }, async (tx) => {
    const where = and(
      eq(assetEvents.organizationId, organizationId),
      eq(assetEvents.facilityId, facilityId),
      inArray(assetEvents.severity, severities),
    );
    const [totalRow] = await tx.select({ total: count() }).from(assetEvents).where(where);
    const data = await tx
      .select({
        id: assetEvents.id,
        assetId: assetEvents.assetId,
        areaId: assetEvents.areaId,
        assetName: assets.name,
        areaName: facilityAreas.name,
        severity: assetEvents.severity,
        summary: assetEvents.description,
        occurredAt: assetEvents.occurredAt,
      })
      .from(assetEvents)
      .leftJoin(
        assets,
        and(
          eq(assets.id, assetEvents.assetId),
          eq(assets.organizationId, organizationId),
          eq(assets.facilityId, facilityId),
        ),
      )
      .leftJoin(
        facilityAreas,
        and(
          eq(facilityAreas.id, assetEvents.areaId),
          eq(facilityAreas.organizationId, organizationId),
          eq(facilityAreas.facilityId, facilityId),
        ),
      )
      .where(where)
      .orderBy(desc(assetEvents.occurredAt), desc(assetEvents.id))
      .limit(ATTENTION_EVENT_LIMIT);
    return {
      data,
      total: Number(totalRow?.total ?? 0),
      limit: ATTENTION_EVENT_LIMIT,
    };
  });
}

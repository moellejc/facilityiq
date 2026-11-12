import "server-only";

import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { withTenant } from "@/db/tenant";
import {
  assets,
  auditLogs,
  facilities,
  facilityAreas,
  facilityLayouts,
  insights,
  operationalMetrics,
  scenarios,
} from "@/db/schema";
import type { FacilityAddressColumns, FacilityType } from "@/lib/facilities";
import { isUniqueViolation } from "@/lib/postgres";

const facilitySummaryColumns = {
  id: facilities.id,
  name: facilities.name,
  location: facilities.location,
  facilityType: facilities.facilityType,
  squareFootage: facilities.squareFootage,
  timezone: facilities.timezone,
  addressStreet: facilities.addressStreet,
  addressCity: facilities.addressCity,
  addressRegion: facilities.addressRegion,
  addressPostalCode: facilities.addressPostalCode,
  addressCountry: facilities.addressCountry,
};

export type FacilityInput = {
  name: string;
  location: string | null;
  facilityType: FacilityType;
  squareFootage: string | null;
  timezone: string;
  addressStreet: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
};

export type FacilityPatch = {
  name?: string;
  location?: string | null;
  facilityType?: FacilityType;
  squareFootage?: string | null;
  timezone?: string;
  addressStreet?: string | null;
  addressCity?: string | null;
  addressRegion?: string | null;
  addressPostalCode?: string | null;
  addressCountry?: string | null;
};

const ADDRESS_PATCH_KEYS = [
  "addressStreet",
  "addressCity",
  "addressRegion",
  "addressPostalCode",
  "addressCountry",
] as const satisfies readonly (keyof FacilityAddressColumns)[];

function addressChanged(patch: FacilityPatch) {
  return ADDRESS_PATCH_KEYS.some((key) => key in patch);
}

export async function listFacilities(organizationId: string, userId: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    return tx
      .select(facilitySummaryColumns)
      .from(facilities)
      .where(eq(facilities.organizationId, organizationId))
      .orderBy(asc(facilities.name));
  });
}

export async function insertFacility(organizationId: string, userId: string, input: FacilityInput) {
  try {
    return await withTenant({ organizationId, userId }, async (tx) => {
      const [facility] = await tx
        .insert(facilities)
        .values({
          organizationId,
          name: input.name,
          location: input.location,
          facilityType: input.facilityType,
          squareFootage: input.squareFootage,
          timezone: input.timezone,
          addressStreet: input.addressStreet,
          addressCity: input.addressCity,
          addressRegion: input.addressRegion,
          addressPostalCode: input.addressPostalCode,
          addressCountry: input.addressCountry,
        })
        .returning(facilitySummaryColumns);
      if (!facility) return { status: "conflict" as const };
      await tx.insert(auditLogs).values({
        organizationId,
        actorUserId: userId,
        action: "facility.create",
        entityType: "facility",
        entityId: facility.id,
        metadata: { name: facility.name, addressSet: facility.addressStreet != null },
      });
      return { status: "created" as const, facility };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "conflict" as const };
    throw error;
  }
}

export async function updateFacility(
  organizationId: string,
  userId: string,
  facilityId: string,
  patch: FacilityPatch,
) {
  try {
    return await withTenant({ organizationId, userId }, async (tx) => {
      const [facility] = await tx
        .update(facilities)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(facilities.organizationId, organizationId), eq(facilities.id, facilityId)))
        .returning(facilitySummaryColumns);
      if (!facility) return { status: "missing" as const };
      await tx.insert(auditLogs).values({
        organizationId,
        actorUserId: userId,
        action: "facility.update",
        entityType: "facility",
        entityId: facility.id,
        metadata: {
          name: facility.name,
          ...(addressChanged(patch) ? { addressChanged: true } : {}),
        },
      });
      return { status: "updated" as const, facility };
    });
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "conflict" as const };
    throw error;
  }
}

export async function deleteFacility(organizationId: string, userId: string, facilityId: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [existing] = await tx
      .select({ id: facilities.id, name: facilities.name })
      .from(facilities)
      .where(and(eq(facilities.organizationId, organizationId), eq(facilities.id, facilityId)));
    if (!existing) return { status: "missing" as const };
    await tx.insert(auditLogs).values({
      organizationId,
      actorUserId: userId,
      action: "facility.delete",
      entityType: "facility",
      entityId: existing.id,
      metadata: { name: existing.name },
    });
    await tx
      .delete(facilities)
      .where(and(eq(facilities.organizationId, organizationId), eq(facilities.id, existing.id)));
    return { status: "deleted" as const, facility: existing };
  });
}

export async function getFacility(organizationId: string, userId: string, facilityId: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [facility] = await tx
      .select()
      .from(facilities)
      .where(and(eq(facilities.organizationId, organizationId), eq(facilities.id, facilityId)));
    return facility ?? null;
  });
}

export async function listAreas(
  organizationId: string,
  userId: string,
  facilityId: string,
  page: number,
  limit: number,
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const where = and(
      eq(facilityAreas.organizationId, organizationId),
      eq(facilityAreas.facilityId, facilityId),
    );
    const [totalRow] = await tx.select({ total: count() }).from(facilityAreas).where(where);
    const data = await tx
      .select()
      .from(facilityAreas)
      .where(where)
      .orderBy(asc(facilityAreas.name))
      .limit(limit)
      .offset((page - 1) * limit);
    return { data, total: Number(totalRow?.total ?? 0), page, limit };
  });
}

export async function listAssets(
  organizationId: string,
  userId: string,
  facilityId: string,
  query: {
    page: number;
    limit: number;
    order: "asc" | "desc";
    sort: "name" | "createdAt";
    assetType?: string;
    status?: string;
    areaId?: string;
  },
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const filters = [eq(assets.organizationId, organizationId), eq(assets.facilityId, facilityId)];
    if (query.assetType) {
      filters.push(
        eq(assets.assetType, query.assetType as (typeof assets.assetType.enumValues)[number]),
      );
    }
    if (query.status) {
      filters.push(eq(assets.status, query.status as (typeof assets.status.enumValues)[number]));
    }
    if (query.areaId) filters.push(eq(assets.areaId, query.areaId));
    const where = and(...filters);
    const orderColumn = query.sort === "createdAt" ? assets.createdAt : assets.name;
    const direction = query.order === "desc" ? desc(orderColumn) : asc(orderColumn);
    const [totalRow] = await tx.select({ total: count() }).from(assets).where(where);
    const data = await tx
      .select({
        id: assets.id,
        name: assets.name,
        assetType: assets.assetType,
        status: assets.status,
        areaId: assets.areaId,
        createdAt: assets.createdAt,
      })
      .from(assets)
      .where(where)
      .orderBy(direction)
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    return { data, total: Number(totalRow?.total ?? 0), page: query.page, limit: query.limit };
  });
}

export async function getLatestLayout(organizationId: string, userId: string, facilityId: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [layout] = await tx
      .select()
      .from(facilityLayouts)
      .where(
        and(
          eq(facilityLayouts.organizationId, organizationId),
          eq(facilityLayouts.facilityId, facilityId),
        ),
      )
      .orderBy(desc(facilityLayouts.version))
      .limit(1);
    return layout ?? null;
  });
}

export async function facilitySummary(organizationId: string, userId: string, facilityId: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [facility] = await tx
      .select()
      .from(facilities)
      .where(and(eq(facilities.organizationId, organizationId), eq(facilities.id, facilityId)));
    if (!facility) return null;

    const assetCounts = await tx
      .select({
        assetType: assets.assetType,
        count: sql<number>`count(*)::int`,
      })
      .from(assets)
      .where(and(eq(assets.organizationId, organizationId), eq(assets.facilityId, facilityId)))
      .groupBy(assets.assetType);

    const [areas] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(facilityAreas)
      .where(
        and(
          eq(facilityAreas.organizationId, organizationId),
          eq(facilityAreas.facilityId, facilityId),
        ),
      );

    const [coverage] = await tx
      .select({
        rows: sql<number>`count(*)::int`,
        starts: sql<Date | null>`min(${operationalMetrics.recordedAt})`,
        ends: sql<Date | null>`max(${operationalMetrics.recordedAt})`,
      })
      .from(operationalMetrics)
      .where(
        and(
          eq(operationalMetrics.organizationId, organizationId),
          eq(operationalMetrics.facilityId, facilityId),
        ),
      );

    const [openInsights] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(insights)
      .where(
        and(
          eq(insights.organizationId, organizationId),
          eq(insights.facilityId, facilityId),
          eq(insights.status, "open"),
        ),
      );

    const [scenarioCount] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(scenarios)
      .where(
        and(eq(scenarios.organizationId, organizationId), eq(scenarios.facilityId, facilityId)),
      );

    return {
      facility,
      areaCount: Number(areas?.count ?? 0),
      assetCounts: assetCounts.map((row) => ({
        assetType: row.assetType,
        count: Number(row.count),
      })),
      metricRows: Number(coverage?.rows ?? 0),
      metricStart: coverage?.starts ?? null,
      metricEnd: coverage?.ends ?? null,
      openInsights: Number(openInsights?.count ?? 0),
      scenarios: Number(scenarioCount?.count ?? 0),
    };
  });
}

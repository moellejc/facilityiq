import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { withTenant } from "@/db/tenant";
import {
  assets,
  facilities,
  facilityAreas,
  facilityLayouts,
  insights,
  operationalMetrics,
  scenarios,
} from "@/db/schema";

export async function listFacilities(organizationId: string, userId: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    return tx
      .select({
        id: facilities.id,
        name: facilities.name,
        location: facilities.location,
        facilityType: facilities.facilityType,
        squareFootage: facilities.squareFootage,
        timezone: facilities.timezone,
      })
      .from(facilities)
      .where(eq(facilities.organizationId, organizationId))
      .orderBy(asc(facilities.name));
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

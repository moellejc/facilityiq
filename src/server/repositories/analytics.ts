import { and, eq, gte, lt, sql } from "drizzle-orm";

import { withTenant } from "@/db/tenant";
import { assets, facilityAreas, financialMetrics, operationalMetrics } from "@/db/schema";
import type { CostSample, MetricSample } from "@/lib/analytics/aggregate";
import { dayKey, rangeEndExclusive, rangeStart, type DayRange } from "@/lib/analytics/periods";

export async function loadMetricCoverage(
  organizationId: string,
  userId: string,
  facilityId: string,
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [operational] = await tx
      .select({
        latest: sql<Date | null>`max(${operationalMetrics.recordedAt})`,
      })
      .from(operationalMetrics)
      .where(
        and(
          eq(operationalMetrics.organizationId, organizationId),
          eq(operationalMetrics.facilityId, facilityId),
        ),
      );
    const [financial] = await tx
      .select({
        latest: sql<Date | null>`max(${financialMetrics.periodStart})`,
      })
      .from(financialMetrics)
      .where(
        and(
          eq(financialMetrics.organizationId, organizationId),
          eq(financialMetrics.facilityId, facilityId),
        ),
      );
    const stamps = [operational?.latest, financial?.latest]
      .map(asDate)
      .filter((value): value is Date => value !== null);
    if (stamps.length === 0) return null;
    const latest = stamps.reduce((max, value) => (value > max ? value : max));
    return dayKey(latest);
  });
}

export async function loadAnalyticsSamples(
  organizationId: string,
  userId: string,
  facilityId: string,
  range: DayRange,
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const start = rangeStart(range);
    const end = rangeEndExclusive(range);
    const metricRows = await tx
      .select({
        metricType: operationalMetrics.metricType,
        metricValue: operationalMetrics.metricValue,
        recordedAt: operationalMetrics.recordedAt,
        areaId: operationalMetrics.areaId,
        assetId: operationalMetrics.assetId,
        areaName: facilityAreas.name,
        assetName: assets.name,
        assetType: assets.assetType,
      })
      .from(operationalMetrics)
      .leftJoin(facilityAreas, eq(facilityAreas.id, operationalMetrics.areaId))
      .leftJoin(assets, eq(assets.id, operationalMetrics.assetId))
      .where(
        and(
          eq(operationalMetrics.organizationId, organizationId),
          eq(operationalMetrics.facilityId, facilityId),
          gte(operationalMetrics.recordedAt, start),
          lt(operationalMetrics.recordedAt, end),
        ),
      );

    const costRows = await tx
      .select({
        category: financialMetrics.costCategory,
        amount: financialMetrics.amount,
        periodStart: financialMetrics.periodStart,
        areaId: financialMetrics.areaId,
        assetId: financialMetrics.assetId,
        areaName: facilityAreas.name,
        assetName: assets.name,
      })
      .from(financialMetrics)
      .leftJoin(facilityAreas, eq(facilityAreas.id, financialMetrics.areaId))
      .leftJoin(assets, eq(assets.id, financialMetrics.assetId))
      .where(
        and(
          eq(financialMetrics.organizationId, organizationId),
          eq(financialMetrics.facilityId, facilityId),
          gte(financialMetrics.periodStart, start),
          lt(financialMetrics.periodStart, end),
        ),
      );

    const metrics: MetricSample[] = [];
    for (const row of metricRows) {
      const value = Number(row.metricValue);
      if (!Number.isFinite(value)) continue;
      metrics.push({
        metricType: row.metricType,
        value,
        recordedOn: dayKey(asDate(row.recordedAt) ?? row.recordedAt),
        areaId: row.areaId,
        assetId: row.assetId,
        areaName: row.areaName,
        assetName: row.assetName,
        assetType: row.assetType,
      });
    }

    const costs: CostSample[] = [];
    for (const row of costRows) {
      const amount = Number(row.amount);
      if (!Number.isFinite(amount)) continue;
      costs.push({
        category: row.category,
        amount,
        recordedOn: dayKey(asDate(row.periodStart) ?? row.periodStart),
        areaId: row.areaId,
        assetId: row.assetId,
        areaName: row.areaName,
        assetName: row.assetName,
      });
    }

    return { metrics, costs };
  });
}

function asDate(value: Date | string | null | undefined) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

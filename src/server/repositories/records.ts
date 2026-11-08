import { and, asc, count, desc, eq } from "drizzle-orm";

import { withTenant } from "@/db/tenant";
import {
  financialMetrics,
  insights,
  operationalMetrics,
  scenarioResults,
  scenarios,
} from "@/db/schema";

export async function listOperationalMetrics(
  organizationId: string,
  userId: string,
  facilityId: string,
  query: {
    page: number;
    limit: number;
    order: "asc" | "desc";
    metricType?: string;
  },
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const filters = [
      eq(operationalMetrics.organizationId, organizationId),
      eq(operationalMetrics.facilityId, facilityId),
    ];
    if (query.metricType) {
      filters.push(
        eq(
          operationalMetrics.metricType,
          query.metricType as (typeof operationalMetrics.metricType.enumValues)[number],
        ),
      );
    }
    const where = and(...filters);
    const direction =
      query.order === "asc"
        ? asc(operationalMetrics.recordedAt)
        : desc(operationalMetrics.recordedAt);
    const [totalRow] = await tx.select({ total: count() }).from(operationalMetrics).where(where);
    const data = await tx
      .select({
        id: operationalMetrics.id,
        areaId: operationalMetrics.areaId,
        assetId: operationalMetrics.assetId,
        metricType: operationalMetrics.metricType,
        metricValue: operationalMetrics.metricValue,
        unit: operationalMetrics.unit,
        recordedAt: operationalMetrics.recordedAt,
      })
      .from(operationalMetrics)
      .where(where)
      .orderBy(direction)
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    return { data, total: Number(totalRow?.total ?? 0), page: query.page, limit: query.limit };
  });
}

export async function listFinancialMetrics(
  organizationId: string,
  userId: string,
  facilityId: string,
  query: {
    page: number;
    limit: number;
    order: "asc" | "desc";
    sort: "periodStart" | "amount";
    costCategory?: string;
  },
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const filters = [
      eq(financialMetrics.organizationId, organizationId),
      eq(financialMetrics.facilityId, facilityId),
    ];
    if (query.costCategory) {
      filters.push(
        eq(
          financialMetrics.costCategory,
          query.costCategory as (typeof financialMetrics.costCategory.enumValues)[number],
        ),
      );
    }
    const where = and(...filters);
    const column = query.sort === "amount" ? financialMetrics.amount : financialMetrics.periodStart;
    const direction = query.order === "asc" ? asc(column) : desc(column);
    const [totalRow] = await tx.select({ total: count() }).from(financialMetrics).where(where);
    const data = await tx
      .select({
        id: financialMetrics.id,
        areaId: financialMetrics.areaId,
        assetId: financialMetrics.assetId,
        costCategory: financialMetrics.costCategory,
        amount: financialMetrics.amount,
        currency: financialMetrics.currency,
        periodStart: financialMetrics.periodStart,
        periodEnd: financialMetrics.periodEnd,
      })
      .from(financialMetrics)
      .where(where)
      .orderBy(direction)
      .limit(query.limit)
      .offset((query.page - 1) * query.limit);
    return { data, total: Number(totalRow?.total ?? 0), page: query.page, limit: query.limit };
  });
}

export async function listInsights(organizationId: string, userId: string, facilityId: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const where = and(
      eq(insights.organizationId, organizationId),
      eq(insights.facilityId, facilityId),
    );
    const [totalRow] = await tx.select({ total: count() }).from(insights).where(where);
    const data = await tx
      .select({
        id: insights.id,
        areaId: insights.areaId,
        assetId: insights.assetId,
        insightType: insights.insightType,
        severity: insights.severity,
        title: insights.title,
        description: insights.description,
        recommendedAction: insights.recommendedAction,
        estimatedFinancialImpact: insights.estimatedFinancialImpact,
        currency: insights.currency,
        confidence: insights.confidence,
        evidence: insights.evidence,
        status: insights.status,
        createdAt: insights.createdAt,
      })
      .from(insights)
      .where(where)
      .orderBy(desc(insights.createdAt));
    return { data, total: Number(totalRow?.total ?? 0) };
  });
}

export async function listScenarios(organizationId: string, userId: string, facilityId?: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const filters = [eq(scenarios.organizationId, organizationId)];
    if (facilityId) filters.push(eq(scenarios.facilityId, facilityId));
    const where = and(...filters);
    const [totalRow] = await tx.select({ total: count() }).from(scenarios).where(where);
    const data = await tx
      .select({
        id: scenarios.id,
        facilityId: scenarios.facilityId,
        name: scenarios.name,
        description: scenarios.description,
        status: scenarios.status,
        configuration: scenarios.configuration,
        createdAt: scenarios.createdAt,
      })
      .from(scenarios)
      .where(where)
      .orderBy(asc(scenarios.name));
    return { data, total: Number(totalRow?.total ?? 0) };
  });
}

export async function getScenario(organizationId: string, userId: string, scenarioId: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [scenario] = await tx
      .select()
      .from(scenarios)
      .where(and(eq(scenarios.organizationId, organizationId), eq(scenarios.id, scenarioId)));
    if (!scenario) return null;
    const results = await tx
      .select()
      .from(scenarioResults)
      .where(
        and(
          eq(scenarioResults.organizationId, organizationId),
          eq(scenarioResults.scenarioId, scenarioId),
        ),
      )
      .orderBy(desc(scenarioResults.calculatedAt));
    return { scenario, results };
  });
}

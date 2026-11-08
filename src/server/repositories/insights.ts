import { and, desc, eq, sql } from "drizzle-orm";

import { withTenant } from "@/db/tenant";
import { assets, facilityAreas, insights } from "@/db/schema";
import type { InsightDraft } from "@/lib/ai/insight-schema";

export async function replaceDeterministicInsights(
  organizationId: string,
  userId: string,
  facilityId: string,
  drafts: InsightDraft[],
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    await tx
      .delete(insights)
      .where(
        and(
          eq(insights.organizationId, organizationId),
          eq(insights.facilityId, facilityId),
          sql`${insights.evidence}->>'source' = 'deterministic_rules'`,
        ),
      );

    if (drafts.length === 0) return [];

    return tx
      .insert(insights)
      .values(
        drafts.map((item) => ({
          organizationId,
          facilityId,
          areaId: item.areaId,
          assetId: item.assetId,
          insightType: item.insightType,
          severity: item.severity,
          title: item.title,
          description: item.description,
          recommendedAction: item.recommendedAction,
          estimatedFinancialImpact:
            item.estimatedFinancialImpact === null
              ? null
              : item.estimatedFinancialImpact.toFixed(2),
          currency: item.currency,
          confidence: item.confidence.toFixed(4),
          evidence: {
            ...item.evidence,
            ruleId: item.ruleId,
          },
          status: "open" as const,
        })),
      )
      .returning({ id: insights.id });
  });
}

export async function listFacilityInsights(
  organizationId: string,
  userId: string,
  facilityId: string,
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const data = await tx
      .select({
        id: insights.id,
        areaId: insights.areaId,
        assetId: insights.assetId,
        areaName: facilityAreas.name,
        assetName: assets.name,
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
      .leftJoin(facilityAreas, eq(facilityAreas.id, insights.areaId))
      .leftJoin(assets, eq(assets.id, insights.assetId))
      .where(and(eq(insights.organizationId, organizationId), eq(insights.facilityId, facilityId)))
      .orderBy(desc(insights.createdAt));
    return data;
  });
}

export async function updateInsightStatus(
  organizationId: string,
  userId: string,
  facilityId: string,
  insightId: string,
  status: "open" | "acknowledged" | "dismissed",
) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [row] = await tx
      .update(insights)
      .set({ status })
      .where(
        and(
          eq(insights.id, insightId),
          eq(insights.organizationId, organizationId),
          eq(insights.facilityId, facilityId),
        ),
      )
      .returning({ id: insights.id, status: insights.status });
    return row ?? null;
  });
}

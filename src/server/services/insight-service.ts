import { DeterministicRulesProvider } from "@/lib/ai/deterministic-rules";
import { insightDraftListSchema, type InsightDraft } from "@/lib/ai/insight-schema";
import { enrichInsightLanguage } from "@/lib/ai/llm-language";
import { AppError } from "@/lib/errors";
import { assertRole, roleCan, type Role } from "@/lib/permissions";
import { uuidSchema } from "@/lib/validation";
import { loadAnalyticsSamples, loadMetricCoverage } from "@/server/repositories/analytics";
import {
  listFacilityInsights,
  replaceDeterministicInsights,
  updateInsightStatus,
} from "@/server/repositories/insights";

import { resolveQueryRange, type AnalyticsQuery } from "./analytics-service";

export async function listInsightsForFacility(input: {
  organizationId: string;
  userId: string;
  facilityId: string;
  role: Role;
}) {
  assertRole(input.role, "insights:read");
  const rows = await listFacilityInsights(input.organizationId, input.userId, input.facilityId);
  return rows.map(presentInsight);
}

export async function generateFacilityInsights(input: {
  organizationId: string;
  userId: string;
  facilityId: string;
  role: Role;
  query?: AnalyticsQuery;
}) {
  assertRole(input.role, "insights:write");
  const freshness = await loadMetricCoverage(input.organizationId, input.userId, input.facilityId);
  const range = resolveQueryRange(input.query, freshness);
  const samples = await loadAnalyticsSamples(
    input.organizationId,
    input.userId,
    input.facilityId,
    range,
  );
  const provider = new DeterministicRulesProvider({
    periodFrom: range.from,
    periodTo: range.to,
    metrics: samples.metrics,
    costs: samples.costs,
  });
  const generated = await provider.generate();
  const parsed = insightDraftListSchema.safeParse(generated);
  if (!parsed.success) {
    throw new AppError("INTERNAL", "Insight rules produced an invalid payload.", 500);
  }
  const allowedAreas = new Set(
    [...samples.metrics, ...samples.costs]
      .map((row) => row.areaId)
      .filter((id): id is string => Boolean(id)),
  );
  const allowedAssets = new Set(
    [...samples.metrics, ...samples.costs]
      .map((row) => row.assetId)
      .filter((id): id is string => Boolean(id)),
  );
  const scoped = parsed.data.filter((item) =>
    idsBelongToFacility(item, allowedAreas, allowedAssets),
  );
  const language = await enrichInsightLanguage(scoped, {
    apiKey: process.env.AI_API_KEY,
  });
  const saved = await replaceDeterministicInsights(
    input.organizationId,
    input.userId,
    input.facilityId,
    language.drafts,
  );
  return {
    generated: saved.length,
    enriched: language.enriched,
    languageRejected: language.rejected,
    range,
  };
}

export async function setInsightStatus(input: {
  organizationId: string;
  userId: string;
  facilityId: string;
  role: Role;
  insightId: string;
  status: "open" | "acknowledged" | "dismissed";
}) {
  assertRole(input.role, "insights:write");
  const parsedId = uuidSchema.safeParse(input.insightId);
  if (!parsedId.success) throw new AppError("VALIDATION_ERROR", "Insight id is invalid.", 400);
  const updated = await updateInsightStatus(
    input.organizationId,
    input.userId,
    input.facilityId,
    parsedId.data,
    input.status,
  );
  if (!updated) throw new AppError("NOT_FOUND", "Insight not found.", 404);
  return updated;
}

export function canRegenerateInsights(role: Role) {
  return roleCan(role, "insights:write");
}

function idsBelongToFacility(item: InsightDraft, areas: Set<string>, assets: Set<string>) {
  if (item.areaId && !areas.has(item.areaId)) return false;
  if (item.assetId && !assets.has(item.assetId)) return false;
  return (
    item.evidence.affectedAreaIds.every((id) => areas.has(id)) &&
    item.evidence.affectedAssetIds.every((id) => assets.has(id))
  );
}

function presentInsight(row: Awaited<ReturnType<typeof listFacilityInsights>>[number]) {
  const evidence = row.evidence ?? {};
  const affectedAreaIds = stringList(evidence.affectedAreaIds);
  const affectedAssetIds = stringList(evidence.affectedAssetIds);
  const impactLabel: "estimate" | "not_calculable" =
    evidence.impactLabel === "estimate" ? "estimate" : "not_calculable";
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    severity: row.severity,
    status: row.status,
    insightType: row.insightType,
    recommendedAction: row.recommendedAction,
    estimatedFinancialImpact: row.estimatedFinancialImpact,
    currency: row.currency,
    confidence: row.confidence,
    areaId: row.areaId,
    assetId: row.assetId,
    areaName: row.areaName,
    assetName: row.assetName,
    affectedAreaIds,
    affectedAssetIds,
    impactLabel,
    uncertainty: typeof evidence.uncertainty === "string" ? evidence.uncertainty : null,
    summary: typeof evidence.summary === "string" ? evidence.summary : null,
    metrics: Array.isArray(evidence.metrics) ? evidence.metrics : [],
    periodFrom: typeof evidence.periodFrom === "string" ? evidence.periodFrom : null,
    periodTo: typeof evidence.periodTo === "string" ? evidence.periodTo : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function stringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

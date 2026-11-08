import { z } from "zod";

export const insightTypes = [
  "excessive_utilization",
  "capacity_constraint",
  "underutilized_equipment",
  "rising_dwell_time",
  "rising_maintenance_cost",
  "stable_operations",
] as const;

export const insightSeverities = ["info", "warning", "critical"] as const;

export const insightEvidenceSchema = z
  .object({
    source: z.literal("deterministic_rules"),
    periodFrom: z.string(),
    periodTo: z.string(),
    summary: z.string(),
    uncertainty: z.string(),
    impactLabel: z.enum(["estimate", "not_calculable"]),
    affectedAreaIds: z.array(z.uuid()),
    affectedAssetIds: z.array(z.uuid()),
    metrics: z.array(
      z.object({
        metricType: z.string(),
        observation: z.string(),
        value: z.number().nullable(),
        unit: z.string(),
      }),
    ),
    references: z.array(
      z.object({
        table: z.enum(["operational_metrics", "financial_metrics"]),
        metricType: z.string().optional(),
        costCategory: z.string().optional(),
        areaId: z.uuid().nullable(),
        assetId: z.uuid().nullable(),
      }),
    ),
  })
  .strict();

export const insightDraftSchema = z
  .object({
    ruleId: z.string().min(1),
    insightType: z.enum(insightTypes),
    severity: z.enum(insightSeverities),
    title: z.string().min(1).max(180),
    description: z.string().min(1).max(4000),
    recommendedAction: z.string().min(1).max(1000),
    estimatedFinancialImpact: z.number().finite().nullable(),
    currency: z.string().length(3),
    confidence: z.number().min(0).max(1),
    areaId: z.uuid().nullable(),
    assetId: z.uuid().nullable(),
    evidence: insightEvidenceSchema,
  })
  .strict();

export const insightDraftListSchema = z.array(insightDraftSchema);

/** Language-only model output. Financial fields are rejected. */
export const insightLanguageSchema = z
  .object({
    insights: z.array(
      z
        .object({
          ruleId: z.string().min(1),
          title: z.string().min(1).max(180),
          description: z.string().min(1).max(4000),
          recommendedAction: z.string().min(1).max(1000),
        })
        .strict(),
    ),
  })
  .strict();

export type InsightDraft = z.infer<typeof insightDraftSchema>;
export type InsightEvidence = z.infer<typeof insightEvidenceSchema>;

export function parseInsightDrafts(input: unknown) {
  return insightDraftListSchema.safeParse(input);
}

export function parseInsightLanguage(input: unknown) {
  return insightLanguageSchema.safeParse(input);
}

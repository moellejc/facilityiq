import type { CostSample, MetricSample } from "@/lib/analytics/aggregate";
import { utilizationFromSamples } from "@/lib/analytics/kpis";

import type { InsightDraft } from "./insight-schema";

export type InsightRuleInput = {
  periodFrom: string;
  periodTo: string;
  metrics: MetricSample[];
  costs: CostSample[];
};

const EXCESSIVE_UTILIZATION = 90;
const CAPACITY_UTILIZATION = 95;
const UNDERUSED_FORKLIFT = 25;
const DWELL_INCREASE_MINUTES = 20;
const MAINTENANCE_RISE_RATIO = 1.5;

export class DeterministicRulesProvider {
  readonly id = "deterministic-rules";

  constructor(private readonly facts: InsightRuleInput) {}

  async generate(): Promise<InsightDraft[]> {
    return detectInsightRules(this.facts);
  }
}

export function detectInsightRules(facts: InsightRuleInput): InsightDraft[] {
  return [
    ...excessiveAisles(facts),
    ...packingShortfalls(facts),
    ...idleForklifts(facts),
    ...risingDwell(facts),
    ...risingMaintenance(facts),
    ...stableAreas(facts),
  ];
}

function excessiveAisles(facts: InsightRuleInput): InsightDraft[] {
  const drafts: InsightDraft[] = [];
  for (const [areaId, rows] of group(
    facts.metrics.filter((row) => row.metricType === "utilization" && row.areaId && !row.assetId),
    (row) => row.areaId as string,
  )) {
    const mean = average(rows.map((row) => row.value));
    if (mean === null || mean <= EXCESSIVE_UTILIZATION) continue;
    const name = rows[0]?.areaName ?? "Area";
    drafts.push(
      draft({
        ruleId: `excessive-utilization:${areaId}`,
        insightType: "excessive_utilization",
        severity: "critical",
        title: `${name} utilization is above ${EXCESSIVE_UTILIZATION}%`,
        description: `${name} averaged ${mean.toFixed(1)}% utilization across ${rows.length} stored samples. That is above the ${EXCESSIVE_UTILIZATION}% capacity rule.`,
        recommendedAction: `Move inbound work out of ${name} before adding racking.`,
        estimatedFinancialImpact: null,
        confidence: rows.length >= 14 ? 0.82 : 0.64,
        areaId,
        assetId: null,
        period: facts,
        summary: "Mean area utilization compared with the 90% rule.",
        uncertainty: "No dollar impact is calculated from utilization alone.",
        impactLabel: "not_calculable",
        affectedAreaIds: [areaId],
        affectedAssetIds: [],
        metrics: [
          {
            metricType: "utilization",
            observation: `${name} mean utilization`,
            value: round(mean),
            unit: "percent",
          },
        ],
        references: [
          {
            table: "operational_metrics",
            metricType: "utilization",
            areaId,
            assetId: null,
          },
        ],
      }),
    );
  }
  return drafts;
}

function packingShortfalls(facts: InsightRuleInput): InsightDraft[] {
  const stations = new Map<string, MetricSample[]>();
  for (const row of facts.metrics.filter(
    (row) => row.assetType === "packing_station" && row.assetId,
  )) {
    const list = stations.get(row.assetId as string) ?? [];
    list.push(row);
    stations.set(row.assetId as string, list);
  }
  const profiles = [...stations.entries()].map(([assetId, rows]) => {
    const orders = rows.filter((row) => row.metricType === "orders_processed");
    const utilization = average(
      rows.filter((row) => row.metricType === "utilization").map((row) => row.value),
    );
    const orderTotal = orders.reduce((sum, row) => sum + row.value, 0);
    const days = new Set(orders.map((row) => row.recordedOn)).size;
    const ordersPerDay = days > 0 ? orderTotal / days : null;
    const severity = maxOf(
      rows.filter((row) => row.metricType === "bottleneck_severity").map((row) => row.value),
    );
    return {
      assetId,
      name: rows[0]?.assetName ?? "Packing station",
      areaId: rows[0]?.areaId ?? null,
      utilization,
      ordersPerDay,
      severity,
    };
  });
  const peerOrders = profiles
    .map((profile) => profile.ordersPerDay)
    .filter((value): value is number => value !== null);
  const peerMedian = median(peerOrders);
  const drafts: InsightDraft[] = [];
  for (const profile of profiles) {
    const saturated = profile.utilization !== null && profile.utilization >= CAPACITY_UTILIZATION;
    const slowerThanPeers =
      profile.ordersPerDay !== null &&
      peerMedian !== null &&
      profiles.length > 1 &&
      profile.ordersPerDay < peerMedian;
    const severe = profile.severity !== null && profile.severity > 0.7;
    if (!saturated || (!slowerThanPeers && !severe)) continue;
    drafts.push(
      draft({
        ruleId: `capacity:${profile.assetId}`,
        insightType: "capacity_constraint",
        severity: "critical",
        title: `${profile.name} is short of packing capacity`,
        description: `${profile.name} averaged ${profile.utilization?.toFixed(1) ?? "an unknown"}% utilization${profile.ordersPerDay !== null ? ` and about ${profile.ordersPerDay.toFixed(0)} orders per day` : ""}. Peer stations processed about ${peerMedian?.toFixed(0) ?? "n/a"} orders per day.`,
        recommendedAction: `Add packing capacity or move work off ${profile.name}.`,
        estimatedFinancialImpact: null,
        confidence: 0.78,
        areaId: profile.areaId,
        assetId: profile.assetId,
        period: facts,
        summary: "Packing-station utilization, orders, and bottleneck severity.",
        uncertainty: "The capacity gap is observed. No savings amount is calculated.",
        impactLabel: "not_calculable",
        affectedAreaIds: profile.areaId ? [profile.areaId] : [],
        affectedAssetIds: [profile.assetId],
        metrics: [
          {
            metricType: "utilization",
            observation: "Mean utilization",
            value: profile.utilization,
            unit: "percent",
          },
          {
            metricType: "orders_processed",
            observation: "Orders per day",
            value: profile.ordersPerDay,
            unit: "orders/day",
          },
          {
            metricType: "bottleneck_severity",
            observation: "Max severity",
            value: profile.severity,
            unit: "ratio",
          },
        ],
        references: [
          {
            table: "operational_metrics",
            metricType: "utilization",
            areaId: profile.areaId,
            assetId: profile.assetId,
          },
        ],
      }),
    );
  }
  return drafts;
}

function idleForklifts(facts: InsightRuleInput): InsightDraft[] {
  const trucks: Array<{
    assetId: string;
    areaId: string | null;
    name: string;
    utilization: number;
  }> = [];
  for (const [assetId, rows] of group(
    facts.metrics.filter(
      (row) => row.assetType === "forklift" && row.metricType === "utilization" && row.assetId,
    ),
    (row) => row.assetId as string,
  )) {
    const utilization = average(rows.map((row) => row.value));
    if (utilization === null || utilization >= UNDERUSED_FORKLIFT) continue;
    trucks.push({
      assetId,
      areaId: rows[0]?.areaId ?? null,
      name: rows[0]?.assetName ?? "Forklift",
      utilization,
    });
  }
  if (trucks.length === 0) return [];
  trucks.sort((a, b) => a.utilization - b.utilization);
  const names = trucks
    .map((truck) => `${truck.name} (${truck.utilization.toFixed(1)}%)`)
    .join(", ");
  return [
    draft({
      ruleId: `underused-forklifts:${trucks.map((truck) => truck.assetId).join(",")}`,
      insightType: "underutilized_equipment",
      severity: "warning",
      title:
        trucks.length === 1
          ? `${trucks[0]?.name} is underutilized`
          : `${trucks.length} forklifts are underutilized`,
      description: `${names} stayed under ${UNDERUSED_FORKLIFT}% utilization. The rule ignores forklifts at or above that level.`,
      recommendedAction: "Reassign the idle forklifts before buying another.",
      estimatedFinancialImpact: null,
      confidence: 0.74,
      areaId: trucks[0]?.areaId ?? null,
      assetId: trucks[0]?.assetId ?? null,
      period: facts,
      summary: "Mean forklift utilization compared with 25%.",
      uncertainty: "Idle time is observed. No lease-cost saving is calculated.",
      impactLabel: "not_calculable",
      affectedAreaIds: unique(
        trucks.map((truck) => truck.areaId).filter((id): id is string => Boolean(id)),
      ),
      affectedAssetIds: trucks.map((truck) => truck.assetId),
      metrics: trucks.map((truck) => ({
        metricType: "utilization",
        observation: truck.name,
        value: round(truck.utilization),
        unit: "percent",
      })),
      references: trucks.map((truck) => ({
        table: "operational_metrics" as const,
        metricType: "utilization",
        areaId: truck.areaId,
        assetId: truck.assetId,
      })),
    }),
  ];
}

function risingDwell(facts: InsightRuleInput): InsightDraft[] {
  const rising: Array<{
    assetId: string;
    areaId: string | null;
    name: string;
    first: number;
    last: number;
  }> = [];
  for (const [assetId, rows] of group(
    facts.metrics.filter((row) => row.metricType === "dwell_time_minutes" && row.assetId),
    (row) => row.assetId as string,
  )) {
    const ordered = [...rows].sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));
    const first = ordered[0]?.value;
    const last = ordered[ordered.length - 1]?.value;
    if (first === undefined || last === undefined || last - first < DWELL_INCREASE_MINUTES)
      continue;
    rising.push({
      assetId,
      areaId: ordered[0]?.areaId ?? null,
      name: ordered[0]?.assetName ?? "Dock",
      first,
      last,
    });
  }
  if (rising.length === 0) return [];
  rising.sort((a, b) => b.last - b.first - (a.last - a.first) || b.last - a.last);
  const lead = rising[0];
  if (!lead) return [];
  return [
    draft({
      ruleId: `rising-dwell:${rising.map((dock) => dock.assetId).join(",")}`,
      insightType: "rising_dwell_time",
      severity: "warning",
      title: "Loading-dock dwell time is increasing",
      description: `${rising.length} dock${rising.length === 1 ? "" : "s"} ended the period at least ${DWELL_INCREASE_MINUTES} minutes above the first stored sample. ${lead.name} moved from ${lead.first.toFixed(0)} to ${lead.last.toFixed(0)} minutes.`,
      recommendedAction:
        "Pair idle handling equipment with the docks and review appointment spacing.",
      estimatedFinancialImpact: null,
      confidence: 0.7,
      areaId: lead.areaId,
      assetId: lead.assetId,
      period: facts,
      summary: "First and last dwell_time_minutes samples by dock.",
      uncertainty:
        "The increase is observed. No cost per dwell minute is stored, so no dollar estimate is made.",
      impactLabel: "not_calculable",
      affectedAreaIds: unique(
        rising.map((dock) => dock.areaId).filter((id): id is string => Boolean(id)),
      ),
      affectedAssetIds: rising.map((dock) => dock.assetId),
      metrics: [
        {
          metricType: "dwell_time_minutes",
          observation: `${lead.name} first sample`,
          value: round(lead.first),
          unit: "minutes",
        },
        {
          metricType: "dwell_time_minutes",
          observation: `${lead.name} last sample`,
          value: round(lead.last),
          unit: "minutes",
        },
      ],
      references: rising.map((dock) => ({
        table: "operational_metrics" as const,
        metricType: "dwell_time_minutes",
        areaId: dock.areaId,
        assetId: dock.assetId,
      })),
    }),
  ];
}

function risingMaintenance(facts: InsightRuleInput): InsightDraft[] {
  const drafts: InsightDraft[] = [];
  for (const [assetId, rows] of group(
    facts.costs.filter((row) => row.category === "maintenance" && row.assetId),
    (row) => row.assetId as string,
  )) {
    const ordered = [...rows].sort((a, b) => a.recordedOn.localeCompare(b.recordedOn));
    const first = ordered[0]?.amount;
    const last = ordered[ordered.length - 1]?.amount;
    if (
      first === undefined ||
      last === undefined ||
      first <= 0 ||
      last < first * MAINTENANCE_RISE_RATIO
    )
      continue;
    const actual = ordered.reduce((sum, row) => sum + row.amount, 0);
    const flatBaseline = first * ordered.length;
    const excess = round(actual - flatBaseline);
    const name = ordered[0]?.assetName ?? "Asset";
    drafts.push(
      draft({
        ruleId: `rising-maintenance:${assetId}`,
        insightType: "rising_maintenance_cost",
        severity: "warning",
        title: `${name} maintenance cost is rising`,
        description: `${name} maintenance moved from ${first.toFixed(2)} to ${last.toFixed(2)} USD per sample. Versus holding the first sample flat, stored rows are ${excess.toFixed(2)} USD higher.`,
        recommendedAction: `Schedule planned work on ${name} and compare it with continued reactive maintenance.`,
        estimatedFinancialImpact: excess > 0 ? excess : null,
        confidence: 0.76,
        areaId: ordered[0]?.areaId ?? null,
        assetId,
        period: facts,
        summary: "Asset maintenance compared with a flat baseline of the first stored sample.",
        uncertainty:
          "The dollar figure is an estimate of excess spend versus that baseline, not a verified saving.",
        impactLabel: excess > 0 ? "estimate" : "not_calculable",
        affectedAreaIds: ordered[0]?.areaId ? [ordered[0].areaId] : [],
        affectedAssetIds: [assetId],
        metrics: [
          {
            metricType: "maintenance",
            observation: "First sample",
            value: round(first),
            unit: "USD",
          },
          {
            metricType: "maintenance",
            observation: "Last sample",
            value: round(last),
            unit: "USD",
          },
          {
            metricType: "maintenance",
            observation: "Excess versus flat first sample",
            value: excess,
            unit: "USD",
          },
        ],
        references: [
          {
            table: "financial_metrics",
            costCategory: "maintenance",
            areaId: ordered[0]?.areaId ?? null,
            assetId,
          },
        ],
      }),
    );
  }
  return drafts;
}

function stableAreas(facts: InsightRuleInput): InsightDraft[] {
  const problemAreas = new Set(
    excessiveAisles(facts).flatMap((item) => item.evidence.affectedAreaIds),
  );
  const drafts: InsightDraft[] = [];
  for (const [areaId, rows] of group(
    facts.metrics.filter((row) => row.metricType === "utilization" && row.areaId && !row.assetId),
    (row) => row.areaId as string,
  )) {
    if (problemAreas.has(areaId) || rows.length < 10) continue;
    const mean = average(rows.map((row) => row.value));
    if (mean === null || mean < 45 || mean > 75) continue;
    const name = rows[0]?.areaName ?? "Area";
    drafts.push(
      draft({
        ruleId: `stable-area:${areaId}`,
        insightType: "stable_operations",
        severity: "info",
        title: `${name} is inside its utilization band`,
        description: `${name} averaged ${mean.toFixed(1)}% utilization across ${rows.length} samples, between 45% and 75%, and it is not in the excessive-utilization rule.`,
        recommendedAction: `Keep the current plan for ${name}.`,
        estimatedFinancialImpact: null,
        confidence: 0.7,
        areaId,
        assetId: null,
        period: facts,
        summary: "Area utilization inside the healthy band.",
        uncertainty: "No financial estimate is claimed.",
        impactLabel: "not_calculable",
        affectedAreaIds: [areaId],
        affectedAssetIds: [],
        metrics: [
          {
            metricType: "utilization",
            observation: `${name} mean utilization`,
            value: round(mean),
            unit: "percent",
          },
        ],
        references: [
          { table: "operational_metrics", metricType: "utilization", areaId, assetId: null },
        ],
      }),
    );
  }
  return drafts;
}

function draft(input: {
  ruleId: string;
  insightType: InsightDraft["insightType"];
  severity: InsightDraft["severity"];
  title: string;
  description: string;
  recommendedAction: string;
  estimatedFinancialImpact: number | null;
  confidence: number;
  areaId: string | null;
  assetId: string | null;
  period: InsightRuleInput;
  summary: string;
  uncertainty: string;
  impactLabel: "estimate" | "not_calculable";
  affectedAreaIds: string[];
  affectedAssetIds: string[];
  metrics: InsightDraft["evidence"]["metrics"];
  references: InsightDraft["evidence"]["references"];
}): InsightDraft {
  return {
    ruleId: input.ruleId,
    insightType: input.insightType,
    severity: input.severity,
    title: input.title,
    description: input.description,
    recommendedAction: input.recommendedAction,
    estimatedFinancialImpact: input.estimatedFinancialImpact,
    currency: "USD",
    confidence: input.confidence,
    areaId: input.areaId,
    assetId: input.assetId,
    evidence: {
      source: "deterministic_rules",
      periodFrom: input.period.periodFrom,
      periodTo: input.period.periodTo,
      summary: input.summary,
      uncertainty: input.uncertainty,
      impactLabel: input.impactLabel,
      affectedAreaIds: input.affectedAreaIds,
      affectedAssetIds: input.affectedAssetIds,
      metrics: input.metrics.map((metric) => ({
        ...metric,
        value: metric.value === null ? null : round(metric.value),
      })),
      references: input.references,
    },
  };
}

function group<T>(rows: T[], idOf: (row: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const id = idOf(row);
    const list = grouped.get(id) ?? [];
    list.push(row);
    grouped.set(id, list);
  }
  return grouped;
}

function average(values: number[]) {
  const kpi = utilizationFromSamples(values);
  return kpi.value;
}

function maxOf(values: number[]) {
  if (values.length === 0) return null;
  return Math.max(...values);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  return sorted[mid] ?? null;
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

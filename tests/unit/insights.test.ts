import { describe, expect, it, vi } from "vitest";

import type { CostSample, MetricSample } from "@/lib/analytics/aggregate";
import { DeterministicRulesProvider, detectInsightRules } from "@/lib/ai/deterministic-rules";
import { parseInsightDrafts, parseInsightLanguage } from "@/lib/ai/insight-schema";
import { applyInsightLanguage, enrichInsightLanguage } from "@/lib/ai/llm-language";
import { insightsForSelection, parseTwinSelection } from "@/lib/ai/match";
import { deterministicUuid } from "@/db/seed/ids";

const aisleHot = deterministicUuid("unit:aisle-hot");
const aisleCalm = deterministicUuid("unit:aisle-calm");
const packingArea = deterministicUuid("unit:packing");
const slowStation = deterministicUuid("unit:ps-slow");
const healthyStation = deterministicUuid("unit:ps-healthy");
const idleTruck = deterministicUuid("unit:fl-idle");
const busyTruck = deterministicUuid("unit:fl-busy");
const dock = deterministicUuid("unit:dock");
const conveyor = deterministicUuid("unit:cv");

function metric(
  overrides: Partial<MetricSample> & Pick<MetricSample, "metricType" | "value" | "recordedOn">,
): MetricSample {
  return {
    areaId: null,
    assetId: null,
    areaName: null,
    assetName: null,
    assetType: null,
    ...overrides,
  };
}

function cost(
  overrides: Partial<CostSample> & Pick<CostSample, "amount" | "recordedOn">,
): CostSample {
  return {
    category: "maintenance",
    areaId: null,
    assetId: conveyor,
    areaName: "Packing",
    assetName: "CV-02",
    ...overrides,
  };
}

function seededProblems() {
  const metrics: MetricSample[] = [
    metric({
      metricType: "utilization",
      value: 96,
      recordedOn: "2026-10-03",
      areaId: aisleHot,
      areaName: "Aisle 04",
    }),
    metric({
      metricType: "utilization",
      value: 64,
      recordedOn: "2026-10-03",
      areaId: aisleCalm,
      areaName: "Aisle 01",
    }),
    ...Array.from({ length: 10 }, (_, index) =>
      metric({
        metricType: "utilization",
        value: 58,
        recordedOn: `2026-10-${String(index + 1).padStart(2, "0")}`,
        areaId: aisleCalm,
        areaName: "Receiving",
      }),
    ),
    metric({
      metricType: "utilization",
      value: 97.5,
      recordedOn: "2026-10-03",
      areaId: packingArea,
      assetId: slowStation,
      assetName: "PS-02",
      assetType: "packing_station",
    }),
    metric({
      metricType: "orders_processed",
      value: 150,
      recordedOn: "2026-10-03",
      areaId: packingArea,
      assetId: slowStation,
      assetName: "PS-02",
      assetType: "packing_station",
    }),
    metric({
      metricType: "bottleneck_severity",
      value: 0.86,
      recordedOn: "2026-10-03",
      areaId: packingArea,
      assetId: slowStation,
      assetName: "PS-02",
      assetType: "packing_station",
    }),
    metric({
      metricType: "utilization",
      value: 72,
      recordedOn: "2026-10-03",
      areaId: packingArea,
      assetId: healthyStation,
      assetName: "PS-01",
      assetType: "packing_station",
    }),
    metric({
      metricType: "orders_processed",
      value: 240,
      recordedOn: "2026-10-03",
      areaId: packingArea,
      assetId: healthyStation,
      assetName: "PS-01",
      assetType: "packing_station",
    }),
    metric({
      metricType: "utilization",
      value: 14,
      recordedOn: "2026-10-03",
      areaId: aisleCalm,
      assetId: idleTruck,
      assetName: "FL-04",
      assetType: "forklift",
    }),
    metric({
      metricType: "utilization",
      value: 16,
      recordedOn: "2026-10-04",
      areaId: aisleCalm,
      assetId: deterministicUuid("unit:fl-idle-2"),
      assetName: "FL-05",
      assetType: "forklift",
    }),
    metric({
      metricType: "utilization",
      value: 70,
      recordedOn: "2026-10-03",
      assetId: busyTruck,
      assetName: "FL-01",
      assetType: "forklift",
    }),
    metric({
      metricType: "dwell_time_minutes",
      value: 24,
      recordedOn: "2026-10-03",
      areaId: aisleCalm,
      assetId: dock,
      assetName: "DK-01",
      assetType: "loading_dock",
    }),
    metric({
      metricType: "dwell_time_minutes",
      value: 70,
      recordedOn: "2026-11-01",
      areaId: aisleCalm,
      assetId: dock,
      assetName: "DK-01",
      assetType: "loading_dock",
    }),
  ];
  const costs: CostSample[] = [
    cost({ amount: 40, recordedOn: "2026-10-03" }),
    cost({ amount: 80, recordedOn: "2026-11-01" }),
    cost({
      amount: 35,
      recordedOn: "2026-10-03",
      assetId: deterministicUuid("unit:cv-flat"),
      assetName: "CV-01",
    }),
    cost({
      amount: 35,
      recordedOn: "2026-11-01",
      assetId: deterministicUuid("unit:cv-flat"),
      assetName: "CV-01",
    }),
  ];
  return { metrics, costs };
}

describe("deterministic insight rules", () => {
  it("surfaces the seeded problem conditions without an API key", async () => {
    const facts = { periodFrom: "2026-10-03", periodTo: "2026-11-01", ...seededProblems() };
    const fetchImpl = vi.fn();
    const provider = new DeterministicRulesProvider(facts);
    const drafts = await provider.generate();
    const parsed = parseInsightDrafts(drafts);
    expect(parsed.success).toBe(true);

    const language = await enrichInsightLanguage(drafts, { apiKey: "   ", fetchImpl });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(language.enriched).toBe(false);
    expect(language.rejected).toBe(false);
    expect(language.drafts).toEqual(drafts);

    const byType = (type: string) => drafts.filter((item) => item.insightType === type);
    expect(byType("excessive_utilization").map((item) => item.areaId)).toEqual([aisleHot]);
    expect(byType("capacity_constraint").map((item) => item.assetId)).toEqual([slowStation]);
    expect(byType("underutilized_equipment")).toHaveLength(1);
    expect(byType("underutilized_equipment")[0]?.evidence.affectedAssetIds).toEqual(
      expect.arrayContaining([idleTruck, deterministicUuid("unit:fl-idle-2")]),
    );
    expect(byType("underutilized_equipment")[0]?.evidence.affectedAssetIds).toHaveLength(2);
    expect(byType("rising_dwell_time")[0]?.assetId).toBe(dock);
    expect(byType("rising_dwell_time")[0]?.estimatedFinancialImpact).toBeNull();
    const maintenance = byType("rising_maintenance_cost");
    expect(maintenance).toHaveLength(1);
    expect(maintenance[0]?.assetId).toBe(conveyor);
    expect(maintenance[0]?.estimatedFinancialImpact).toBe(40);
    expect(maintenance[0]?.evidence.impactLabel).toBe("estimate");
    expect(maintenance[0]?.evidence.uncertainty.toLowerCase()).toContain("estimate");
    expect(byType("stable_operations").some((item) => item.areaId === aisleCalm)).toBe(true);
    expect(drafts.every((item) => item.evidence.source === "deterministic_rules")).toBe(true);
    expect(drafts.every((item) => item.recommendedAction.length > 0)).toBe(true);
  });

  it("does not invent a dollar impact for utilization or a flat maintenance series", () => {
    const drafts = detectInsightRules({
      periodFrom: "2026-10-03",
      periodTo: "2026-10-04",
      metrics: [
        metric({
          metricType: "utilization",
          value: 50,
          recordedOn: "2026-10-03",
          areaId: aisleCalm,
          areaName: "Aisle 01",
        }),
      ],
      costs: [
        cost({ amount: 35, recordedOn: "2026-10-03", assetId: busyTruck, assetName: "CV-01" }),
        cost({ amount: 35, recordedOn: "2026-10-04", assetId: busyTruck, assetName: "CV-01" }),
      ],
    });
    expect(drafts.find((item) => item.insightType === "excessive_utilization")).toBeUndefined();
    expect(drafts.find((item) => item.insightType === "rising_maintenance_cost")).toBeUndefined();
  });
});

describe("insight language validation", () => {
  const facts = { periodFrom: "2026-10-03", periodTo: "2026-11-01", ...seededProblems() };
  const drafts = detectInsightRules(facts);
  const maintenance = drafts.find((item) => item.insightType === "rising_maintenance_cost");

  it("rejects model output that adds a financial field", () => {
    expect(maintenance).toBeTruthy();
    const raw = {
      insights: [
        {
          ruleId: maintenance?.ruleId,
          title: "Reworded title",
          description: "Reworded description",
          recommendedAction: "Reworded action",
          estimatedFinancialImpact: 99999,
        },
      ],
    };
    expect(parseInsightLanguage(raw).success).toBe(false);
    const applied = applyInsightLanguage(drafts, raw);
    expect(applied.rejected).toBe(true);
    expect(applied.enriched).toBe(false);
    expect(applied.drafts.find((item) => item.ruleId === maintenance?.ruleId)).toMatchObject({
      title: maintenance?.title,
      estimatedFinancialImpact: maintenance?.estimatedFinancialImpact,
    });
  });

  it("rejects a language object that is missing a title", () => {
    const raw = {
      insights: [
        {
          ruleId: maintenance?.ruleId,
          description: "No title",
          recommendedAction: "Do something",
        },
      ],
    };
    expect(parseInsightLanguage(raw).success).toBe(false);
  });

  it("copies only the rephrased text when the payload is valid", () => {
    const applied = applyInsightLanguage(drafts, {
      insights: [
        {
          ruleId: maintenance?.ruleId,
          title: "Maintenance on this conveyor is climbing",
          description: "The stored maintenance series rose against its first sample.",
          recommendedAction: "Plan the repair from the stored excess estimate.",
        },
      ],
    });
    expect(applied.rejected).toBe(false);
    expect(applied.enriched).toBe(true);
    const updated = applied.drafts.find((item) => item.ruleId === maintenance?.ruleId);
    expect(updated?.title).toBe("Maintenance on this conveyor is climbing");
    expect(updated?.estimatedFinancialImpact).toBe(maintenance?.estimatedFinancialImpact);
    expect(updated?.evidence.impactLabel).toBe("estimate");
  });
});

describe("insight selection matching", () => {
  it("matches an asset listed only in the affected set", () => {
    const assetId = deterministicUuid("unit:fl-idle-2");
    const matches = insightsForSelection(
      [
        {
          id: "1",
          title: "Idle trucks",
          severity: "warning",
          status: "open",
          areaId: aisleCalm,
          assetId: idleTruck,
          affectedAreaIds: [aisleCalm],
          affectedAssetIds: [idleTruck, assetId],
          estimatedFinancialImpact: null,
          impactLabel: "not_calculable",
        },
      ],
      { kind: "asset", id: assetId },
    );
    expect(matches).toHaveLength(1);
    expect(parseTwinSelection(`asset:${assetId}`)).toEqual({ kind: "asset", id: assetId });
    expect(parseTwinSelection("asset:not-a-uuid")).toBeNull();
  });
});

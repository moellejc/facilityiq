import { describe, expect, it } from "vitest";

import {
  buildAnalytics,
  compareKpis,
  type CostSample,
  type MetricSample,
} from "@/lib/analytics/aggregate";
import { heatmapColor } from "@/lib/analytics/heatmap";
import {
  costPerOrder,
  throughputOrdersPerHour,
  utilizationFromSamples,
} from "@/lib/analytics/kpis";
import { inclusiveDayCount, previousPeriod } from "@/lib/analytics/periods";

describe("period comparison", () => {
  it("keeps an equal-length previous window", () => {
    const current = { from: "2026-10-26", to: "2026-11-01" };
    expect(inclusiveDayCount(current)).toBe(7);
    expect(previousPeriod(current)).toEqual({ from: "2026-10-19", to: "2026-10-25" });
  });

  it("does not report a zero delta when the previous period is unavailable", () => {
    const compared = compareKpis(
      { value: 12, unit: "orders/hour", unavailableReason: null },
      { value: null, unit: "orders/hour", unavailableReason: "empty_period" },
    );
    expect(compared.delta).toBeNull();
    expect(compared.comparisonReason).toBe("empty_period");
  });

  it("keeps the absolute delta when the previous value is a measured zero", () => {
    const compared = compareKpis(
      { value: 4, unit: "count", unavailableReason: null },
      { value: 0, unit: "count", unavailableReason: null },
    );
    expect(compared.delta).toBe(4);
    expect(compared.percentChange).toBeNull();
    expect(compared.comparisonReason).toBe("zero_denominator");
  });
});

describe("analytics assembly", () => {
  it("calculates throughput, utilization, and cost without coercing gaps to zero", () => {
    const metrics: MetricSample[] = [
      facility("orders_processed", 160, "2026-11-01"),
      facility("operating_hours", 16, "2026-11-01"),
      facility("units_processed", 640, "2026-11-01"),
      facility("cycle_time_minutes", 40, "2026-11-01"),
      facility("downtime_minutes", 30, "2026-11-01"),
      area("utilization", 95, "2026-11-01", "aisle-4", "Aisle 04"),
      area("bottleneck_severity", 0.8, "2026-11-01", "aisle-4", "Aisle 04"),
      asset("utilization", 97.5, "2026-11-01", "ps-02", "PS-02", "packing_station"),
      asset("busy_minutes", 156, "2026-11-01", "ps-02", "PS-02", "packing_station"),
      asset("available_minutes", 160, "2026-11-01", "ps-02", "PS-02", "packing_station"),
      asset("orders_processed", 150, "2026-11-01", "ps-02", "PS-02", "packing_station"),
      asset("utilization", 14, "2026-11-01", "fl-04", "FL-04", "forklift"),
    ];
    const costs: CostSample[] = [
      {
        category: "labor",
        amount: 1000,
        recordedOn: "2026-11-01",
        areaId: null,
        assetId: null,
        areaName: null,
        assetName: null,
      },
      {
        category: "maintenance",
        amount: 240,
        recordedOn: "2026-11-01",
        areaId: null,
        assetId: "cv-02",
        areaName: null,
        assetName: "CV-02",
      },
    ];
    const model = buildAnalytics({
      range: { from: "2026-11-01", to: "2026-11-01" },
      previousRange: { from: "2026-10-31", to: "2026-10-31" },
      freshness: "2026-11-01",
      metrics,
      costs,
      includeOperations: true,
      includeFinance: true,
    });

    expect(model.operations?.throughputPerHour.current).toEqual({
      value: 10,
      unit: "orders/hour",
      unavailableReason: null,
    });
    expect(model.operations?.unitsProcessed.current.value).toBe(640);
    expect(model.operations?.assetUtilization.current.value).toBeCloseTo(55.75);
    expect(model.operations?.areaUtilization.current.value).toBe(95);
    expect(model.operations?.capacityUtilization.current.value).toBeCloseTo(97.5);
    expect(model.operations?.cycleTime.current.value).toBe(40);
    expect(model.operations?.bottleneckCount.current.value).toBe(1);
    expect(model.finance?.operatingCost.current.value).toBe(1240);
    expect(model.finance?.costPerOrder.current.value).toBeCloseTo(7.75);
    expect(model.finance?.labor.current.value).toBe(1000);
    expect(model.finance?.energy.current.value).toBeNull();
    expect(model.finance?.energy.current.unavailableReason).toBe("empty_period");
    expect(model.heatmap.assets["ps-02"]?.utilization).toBe(97.5);
    expect(model.heatmap.assets["ps-02"]?.throughput).toBe(150);
    expect(model.heatmap.assets["pallet-1"]).toBeUndefined();
    expect(model.heatmap.assets["fl-04"]?.operating_cost).toBeUndefined();
    expect(model.operations?.throughputPerHour.previous.value).toBeNull();
    expect(model.operations?.throughputPerHour.delta).toBeNull();
  });

  it("returns an empty period instead of zero when the range has no rows", () => {
    const model = buildAnalytics({
      range: { from: "2020-01-01", to: "2020-01-07" },
      previousRange: { from: "2019-12-25", to: "2019-12-31" },
      freshness: "2026-11-01",
      metrics: [],
      costs: [],
      includeOperations: true,
      includeFinance: true,
    });
    expect(model.operations?.throughputPerHour.current.value).toBeNull();
    expect(model.operations?.throughputPerHour.current.unavailableReason).toBe("missing_inputs");
    expect(model.operations?.unitsProcessed.current.unavailableReason).toBe("empty_period");
    expect(model.operations?.bottleneckCount.current.unavailableReason).toBe("empty_period");
    expect(model.finance?.operatingCost.current.value).toBeNull();
    expect(model.finance?.costPerOrder.current.unavailableReason).toBe("missing_inputs");
    expect(model.heatmap.assets).toEqual({});
  });

  it("hides finance results when the role cannot read them", () => {
    const model = buildAnalytics({
      range: { from: "2026-11-01", to: "2026-11-01" },
      previousRange: { from: "2026-10-31", to: "2026-10-31" },
      freshness: null,
      metrics: [
        facility("orders_processed", 10, "2026-11-01"),
        facility("operating_hours", 2, "2026-11-01"),
      ],
      costs: [
        {
          category: "labor",
          amount: 50,
          recordedOn: "2026-11-01",
          areaId: null,
          assetId: null,
          areaName: null,
          assetName: null,
        },
      ],
      includeOperations: true,
      includeFinance: false,
    });
    expect(model.finance).toBeNull();
    expect(model.heatmap.modes).not.toContain("operating_cost");
    expect(model.operations?.throughputPerHour.current.value).toBe(5);
  });
});

describe("heatmap colors", () => {
  it("leaves a missing sample uncolored", () => {
    expect(heatmapColor("utilization", null, null)).toBeNull();
    expect(heatmapColor("utilization", undefined, null)).toBeNull();
    expect(heatmapColor("bottleneck_severity", null, { min: 0, max: 1 })).toBeNull();
  });

  it("uses the documented utilization and severity thresholds", () => {
    expect(heatmapColor("utilization", 61, null)).toBe("#059669");
    expect(heatmapColor("utilization", 86, null)).toBe("#d97706");
    expect(heatmapColor("utilization", 97, null)).toBe("#dc2626");
    expect(heatmapColor("bottleneck_severity", 0.2, null)).toBe("#059669");
    expect(heatmapColor("bottleneck_severity", 0.86, null)).toBe("#dc2626");
  });
});

describe("formula guards", () => {
  it("does not treat a zero denominator as a measured zero", () => {
    expect(throughputOrdersPerHour({ orders: 10, hours: 0 }).unavailableReason).toBe(
      "zero_denominator",
    );
    expect(costPerOrder({ operatingCost: 100, orders: 0 }).value).toBeNull();
    expect(utilizationFromSamples([]).unavailableReason).toBe("empty_period");
    expect(utilizationFromSamples([null, undefined]).value).toBeNull();
  });
});

function facility(metricType: string, value: number, recordedOn: string): MetricSample {
  return {
    metricType,
    value,
    recordedOn,
    areaId: null,
    assetId: null,
    areaName: null,
    assetName: null,
    assetType: null,
  };
}

function area(
  metricType: string,
  value: number,
  recordedOn: string,
  areaId: string,
  areaName: string,
): MetricSample {
  return {
    metricType,
    value,
    recordedOn,
    areaId,
    assetId: null,
    areaName,
    assetName: null,
    assetType: null,
  };
}

function asset(
  metricType: string,
  value: number,
  recordedOn: string,
  assetId: string,
  assetName: string,
  assetType: string,
): MetricSample {
  return {
    metricType,
    value,
    recordedOn,
    areaId: "packing",
    assetId,
    areaName: "Packing",
    assetName,
    assetType,
  };
}

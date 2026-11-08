import { describe, expect, it } from "vitest";

import {
  BOTTLENECK_WARNING_THRESHOLD,
  averageCycleTime,
  bottleneckCount,
  costPerOrder,
  throughputOrdersPerDay,
  throughputOrdersPerHour,
  utilizationFromSamples,
  utilizationPercent,
} from "@/lib/analytics/kpis";

describe("throughput", () => {
  it("divides orders by hours and days", () => {
    expect(throughputOrdersPerHour({ orders: 160, hours: 16 })).toEqual({
      value: 10,
      unit: "orders/hour",
      unavailableReason: null,
    });
    expect(throughputOrdersPerDay({ orders: 2100, days: 1 })).toEqual({
      value: 2100,
      unit: "orders/day",
      unavailableReason: null,
    });
  });

  it("returns a measured zero when the numerator is zero", () => {
    expect(throughputOrdersPerHour({ orders: 0, hours: 8 }).value).toBe(0);
  });

  it("does not treat a zero denominator as zero throughput", () => {
    expect(throughputOrdersPerHour({ orders: 10, hours: 0 })).toEqual({
      value: null,
      unit: "orders/hour",
      unavailableReason: "zero_denominator",
    });
    expect(throughputOrdersPerDay({ orders: 10, days: 0 }).unavailableReason).toBe(
      "zero_denominator",
    );
  });

  it("reports missing inputs before a zero denominator", () => {
    expect(throughputOrdersPerHour({ orders: null, hours: 0 }).unavailableReason).toBe(
      "missing_inputs",
    );
    expect(throughputOrdersPerDay({ orders: 4, days: undefined }).unavailableReason).toBe(
      "missing_inputs",
    );
  });
});

describe("utilization", () => {
  it("converts busy over available into a percent", () => {
    expect(utilizationPercent({ busy: 30, available: 60 })).toEqual({
      value: 50,
      unit: "percent",
      unavailableReason: null,
    });
  });

  it("rejects a zero available window", () => {
    expect(utilizationPercent({ busy: 0, available: 0 }).unavailableReason).toBe(
      "zero_denominator",
    );
  });

  it("averages samples and ignores nulls", () => {
    expect(utilizationFromSamples([50, null, 70])).toEqual({
      value: 60,
      unit: "percent",
      unavailableReason: null,
    });
  });

  it("treats an empty sample set as an empty period", () => {
    expect(utilizationFromSamples([]).unavailableReason).toBe("empty_period");
    expect(utilizationFromSamples([null, undefined]).unavailableReason).toBe("empty_period");
  });
});

describe("cost and cycle time", () => {
  it("divides operating cost by orders", () => {
    expect(costPerOrder({ operatingCost: 1000, orders: 4 })).toEqual({
      value: 250,
      unit: "currency/order",
      unavailableReason: null,
    });
  });

  it("does not invent a cost when there are no orders", () => {
    expect(costPerOrder({ operatingCost: 1000, orders: 0 }).unavailableReason).toBe(
      "zero_denominator",
    );
  });

  it("averages cycle-time samples", () => {
    expect(averageCycleTime([40, 50, null])).toEqual({
      value: 45,
      unit: "minutes",
      unavailableReason: null,
    });
    expect(averageCycleTime([]).unavailableReason).toBe("empty_period");
  });
});

describe("bottlenecks", () => {
  it("counts distinct ids above the warning threshold", () => {
    expect(BOTTLENECK_WARNING_THRESHOLD).toBe(0.7);
    const result = bottleneckCount([
      { id: "a", severity: 0.86 },
      { id: "a", severity: 0.9 },
      { id: "b", severity: 0.7 },
      { id: "c", severity: 0.71 },
      { id: "d", severity: null },
    ]);
    expect(result).toEqual({ value: 2, unit: "count", unavailableReason: null });
  });

  it("returns zero when observations exist and none exceed the threshold", () => {
    expect(bottleneckCount([{ id: "a", severity: 0.2 }]).value).toBe(0);
  });

  it("returns an empty period when nothing was observed", () => {
    expect(bottleneckCount([]).unavailableReason).toBe("empty_period");
  });
});

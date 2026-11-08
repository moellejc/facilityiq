import { describe, expect, it } from "vitest";

import { seedDatabase } from "@/db/seed";
import { facilityId, organizationId, userId } from "@/db/seed/ids";
import { loadFacilityScene } from "@/server/repositories/scene";
import { getFacilityAnalytics } from "@/server/services/analytics-service";

const scope = {
  organizationId,
  userId: userId("viewer@acme.example"),
  facilityId,
  role: "viewer" as const,
};

describe("seeded analytics", () => {
  it("derives KPIs from stored metrics and leaves missing samples empty", async () => {
    await seedDatabase();
    const analytics = await getFacilityAnalytics(scope);
    const operations = analytics.operations;
    const finance = analytics.finance;
    expect(operations).not.toBeNull();
    expect(finance).not.toBeNull();

    expect(operations?.throughputPerHour.current.value).toBeGreaterThan(0);
    expect(operations?.throughputPerDay.current.value).toBeGreaterThan(0);
    expect(operations?.unitsProcessed.current.value).toBeGreaterThan(0);
    expect(operations?.cycleTime.current.value).toBe(47);
    expect(operations?.bottleneckCount.current.value).toBeGreaterThan(0);
    expect(finance?.operatingCost.current.value).toBeGreaterThan(0);
    expect(finance?.costPerOrder.current.value).toBeGreaterThan(0);
    expect(finance?.labor.current.value).toBeGreaterThan(0);
    expect(finance?.maintenance.current.value).toBeGreaterThan(0);
    expect(finance?.energy.current.value).toBeGreaterThan(0);

    const aisle4 = operations?.utilizationByArea.find((area) => area.name === "Aisle 04");
    const aisle1 = operations?.utilizationByArea.find((area) => area.name === "Aisle 01");
    expect(aisle4?.value).toBeGreaterThan(90);
    expect(aisle1?.value).toBeLessThan(80);

    const station = operations?.assetPerformance.find((asset) => asset.name === "PS-02");
    const idle = operations?.assetPerformance.find((asset) => asset.name === "FL-04");
    expect(station?.value).toBeGreaterThan(95);
    expect(idle?.value).toBeLessThan(20);

    const conveyor = finance?.costByAsset.find((asset) => asset.name === "CV-02");
    const other = finance?.costByAsset.find((asset) => asset.name === "CV-01");
    expect(conveyor && other && conveyor.value > other.value).toBe(true);

    const scene = await loadFacilityScene(scope.organizationId, scope.userId, scope.facilityId);
    const pallet = scene?.assets.find((asset) => asset.assetType === "pallet");
    expect(pallet).toBeTruthy();
    expect(analytics.heatmap.assets[pallet!.id]?.utilization).toBeUndefined();
    expect(analytics.heatmap.assets[pallet!.id]?.operating_cost).toBeUndefined();

    const empty = await getFacilityAnalytics({
      ...scope,
      query: { from: "2020-01-01", to: "2020-01-07" },
    });
    expect(empty.operations?.throughputPerHour.current.value).toBeNull();
    expect(empty.operations?.throughputPerHour.current.value).not.toBe(0);
    expect(empty.operations?.unitsProcessed.current.unavailableReason).toBe("empty_period");
    expect(empty.finance?.operatingCost.current.value).toBeNull();
    expect(empty.finance?.costPerOrder.current.value).not.toBe(0);
    expect(empty.heatmap.assets).toEqual({});
  });

  it("changes the result when the date range changes", async () => {
    await seedDatabase();
    const week = await getFacilityAnalytics({
      ...scope,
      role: "operations_manager",
      query: { from: "2026-10-26", to: "2026-11-01" },
    });
    const earlier = await getFacilityAnalytics({
      ...scope,
      role: "finance_manager",
      query: { from: "2026-10-03", to: "2026-10-09" },
    });
    expect(week.range).toEqual({ from: "2026-10-26", to: "2026-11-01" });
    expect(week.operations?.throughputPerDay.previous.value).not.toBeNull();
    expect(week.operations?.downtime.current.value).not.toBe(
      earlier.operations?.downtime.current.value,
    );
    expect(week.finance?.maintenance.current.value).toBeGreaterThan(
      earlier.finance?.maintenance.current.value ?? 0,
    );
  });
});

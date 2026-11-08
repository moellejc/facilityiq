import { describe, expect, it } from "vitest";

import { buildScenarioBaseline } from "@/lib/scenarios/baseline";
import { compareScenarioProjections } from "@/lib/scenarios/compare";
import {
  projectAddPackingStation,
  projectExtendOperatingHours,
  projectIncreaseConveyorCapacity,
  projectIncreaseStaffing,
  projectReassignEquipment,
  projectReduceDowntime,
  projectScenario,
} from "@/lib/scenarios/project";
import { scenarioConfigurationSchema } from "@/lib/scenarios/schema";
import type { ScenarioBaseline } from "@/lib/scenarios/types";
import { deterministicUuid } from "@/db/seed/ids";

const packingSlow = deterministicUuid("test:ps-slow");
const packingFast = deterministicUuid("test:ps-fast");
const conveyor = deterministicUuid("test:cv");
const conveyorPeer = deterministicUuid("test:cv-peer");
const forkliftIdle = deterministicUuid("test:fl-idle");
const forkliftBusy = deterministicUuid("test:fl-busy");
const dock = deterministicUuid("test:dock");
const shipping = deterministicUuid("test:shipping");

function baseline(overrides: Partial<ScenarioBaseline> = {}): ScenarioBaseline {
  return {
    periodFrom: "2026-10-03",
    periodTo: "2026-11-01",
    periodDays: 30,
    orders: 30000,
    orderDays: 30,
    operatingHours: 400,
    hourDays: 30,
    downtimeMinutes: 1200,
    downtimeDays: 30,
    operatingCost: 300000,
    laborCost: 150000,
    assets: [
      {
        assetId: packingSlow,
        name: "PS-02",
        assetType: "packing_station",
        areaId: shipping,
        areaName: "Packing",
        utilization: 97.5,
        orders: 4500,
        orderDays: 30,
        ordersPerDay: 150,
        bottleneckSeverity: 0.86,
        downtimeMinutes: null,
        downtimeDays: null,
        downtimePerDay: null,
        maintenanceCost: null,
        maintenanceDays: null,
        dwellFirst: null,
        dwellLast: null,
        dwellMean: null,
      },
      {
        assetId: packingFast,
        name: "PS-01",
        assetType: "packing_station",
        areaId: shipping,
        areaName: "Packing",
        utilization: 72,
        orders: 7200,
        orderDays: 30,
        ordersPerDay: 240,
        bottleneckSeverity: 0.2,
        downtimeMinutes: null,
        downtimeDays: null,
        downtimePerDay: null,
        maintenanceCost: null,
        maintenanceDays: null,
        dwellFirst: null,
        dwellLast: null,
        dwellMean: null,
      },
      {
        assetId: conveyor,
        name: "CV-02",
        assetType: "conveyor",
        areaId: shipping,
        areaName: "Packing",
        utilization: 81,
        orders: null,
        orderDays: null,
        ordersPerDay: null,
        bottleneckSeverity: null,
        downtimeMinutes: 1200,
        downtimeDays: 30,
        downtimePerDay: 40,
        maintenanceCost: 4200,
        maintenanceDays: 30,
        dwellFirst: null,
        dwellLast: null,
        dwellMean: null,
      },
      {
        assetId: conveyorPeer,
        name: "CV-01",
        assetType: "conveyor",
        areaId: shipping,
        areaName: "Packing",
        utilization: 70,
        orders: null,
        orderDays: null,
        ordersPerDay: null,
        bottleneckSeverity: null,
        downtimeMinutes: 360,
        downtimeDays: 30,
        downtimePerDay: 12,
        maintenanceCost: 1050,
        maintenanceDays: 30,
        dwellFirst: null,
        dwellLast: null,
        dwellMean: null,
      },
      {
        assetId: forkliftIdle,
        name: "FL-04",
        assetType: "forklift",
        areaId: shipping,
        areaName: "Staging",
        utilization: 14,
        orders: null,
        orderDays: null,
        ordersPerDay: null,
        bottleneckSeverity: null,
        downtimeMinutes: null,
        downtimeDays: null,
        downtimePerDay: null,
        maintenanceCost: null,
        maintenanceDays: null,
        dwellFirst: null,
        dwellLast: null,
        dwellMean: null,
      },
      {
        assetId: forkliftBusy,
        name: "FL-01",
        assetType: "forklift",
        areaId: shipping,
        areaName: "Aisle 02",
        utilization: 70,
        orders: null,
        orderDays: null,
        ordersPerDay: null,
        bottleneckSeverity: null,
        downtimeMinutes: null,
        downtimeDays: null,
        downtimePerDay: null,
        maintenanceCost: null,
        maintenanceDays: null,
        dwellFirst: null,
        dwellLast: null,
        dwellMean: null,
      },
      {
        assetId: dock,
        name: "DK-01",
        assetType: "loading_dock",
        areaId: shipping,
        areaName: "Shipping",
        utilization: null,
        orders: null,
        orderDays: null,
        ordersPerDay: null,
        bottleneckSeverity: null,
        downtimeMinutes: null,
        downtimeDays: null,
        downtimePerDay: null,
        maintenanceCost: null,
        maintenanceDays: null,
        dwellFirst: 24,
        dwellLast: 70,
        dwellMean: 47,
      },
    ],
    ...overrides,
  };
}

describe("scenario projections", () => {
  it("adds packing capacity from the peer order gap", () => {
    const result = projectAddPackingStation(baseline(), {
      additionalStations: 1,
      referenceAssetId: packingSlow,
      modeledMonthlyCostPerStation: 1000,
      modeledInvestment: 10000,
    });
    expect(result.baseline.basis).toBe("observed");
    expect(result.projected.basis).toBe("modeled");
    expect(result.baseline.throughputOrdersPerDay.value).toBe(1000);
    expect(result.projected.throughputOrdersPerDay.value).toBe(1090);
    expect(result.monthlySavings.basis).toBe("modeled");
    expect(result.monthlySavings.value).toBe(-1000);
    expect(result.roi.value).toBeCloseTo(-0.1);
    expect(result.assumptions.length).toBeGreaterThan(0);
  });

  it("scales conveyor capacity from utilization", () => {
    const result = projectIncreaseConveyorCapacity(baseline(), {
      assetId: conveyor,
      capacityIncreasePercent: 20,
      modeledMonthlyCost: 500,
      modeledInvestment: 2000,
    });
    expect(result.projected.throughputOrdersPerDay.value).toBeCloseTo(1000 + 1000 * 0.2 * 0.81);
    expect(result.monthlySavings.value).toBe(-500);
  });

  it("extends hours using observed orders per hour and labor rate", () => {
    const result = projectExtendOperatingHours(baseline(), { additionalHoursPerDay: 2 });
    expect(result.projected.throughputOrdersPerDay.value).toBeCloseTo(1000 + (30000 / 400) * 2);
    expect(result.projected.operatingCost.value).toBeGreaterThan(300000);
    expect(result.monthlySavings.value).toBeLessThan(0);
  });

  it("reassigns forklifts toward peer utilization without inventing orders", () => {
    const result = projectReassignEquipment(baseline(), {
      assetIds: [forkliftIdle],
      destinationAreaId: shipping,
      modeledCostPerDwellMinute: 2,
    });
    expect(result.projected.throughputOrdersPerDay.value).toBe(1000);
    expect(result.projected.operatingCost.basis).toBe("observed");
    expect(result.monthlySavings.value).toBeGreaterThan(0);
  });

  it("increases staffing with an explicit labor rate", () => {
    const result = projectIncreaseStaffing(baseline(), {
      additionalHeadcount: 2,
      hoursPerPersonPerDay: 8,
      modeledHourlyLaborRate: 40,
    });
    expect(result.projected.throughputOrdersPerDay.value).toBeCloseTo(1000 + (30000 / 400) * 16);
    expect(result.projected.operatingCost.basis).toBe("modeled");
  });

  it("reduces downtime and can shift peer maintenance", () => {
    const result = projectReduceDowntime(baseline(), {
      assetId: conveyor,
      targetDowntimeMinutesPerDay: 12,
      modeledRepairCost: 4800,
    });
    expect(result.projected.throughputOrdersPerDay.value).toBeGreaterThan(1000);
    expect(result.projected.operatingCost.value).toBeLessThan(300000);
    expect(result.monthlySavings.value).toBeGreaterThan(0);
    expect(result.roi.value).not.toBeNull();
  });

  it("returns unavailable figures for missing baseline and zero denominators", () => {
    const empty = baseline({
      orders: null,
      orderDays: null,
      operatingHours: null,
      hourDays: null,
      operatingCost: null,
      laborCost: null,
      downtimeMinutes: null,
      downtimeDays: null,
      assets: [],
    });
    const packing = projectAddPackingStation(empty, { additionalStations: 1 });
    expect(packing.baseline.throughputOrdersPerDay.value).toBeNull();
    expect(packing.baseline.throughputOrdersPerDay.unavailableReason).toBe("empty_period");
    expect(packing.projected.throughputOrdersPerDay.value).toBeNull();

    const zeroDays = projectExtendOperatingHours(
      baseline({ periodDays: 0, operatingHours: 0, hourDays: 0, orders: 0, orderDays: 0 }),
      { additionalHoursPerDay: 1 },
    );
    expect(zeroDays.projected.throughputOrdersPerDay.value).toBeNull();
    expect(
      ["zero_denominator", "missing_inputs", "empty_period"].includes(
        zeroDays.projected.throughputOrdersPerDay.unavailableReason ?? "",
      ),
    ).toBe(true);

    const zeroRoi = projectReduceDowntime(baseline(), {
      assetId: conveyor,
      targetDowntimeMinutesPerDay: 12,
      modeledRepairCost: 0,
    });
    expect(zeroRoi.roi.unavailableReason).toBe("zero_denominator");
  });

  it("dispatches through projectScenario and validates configuration", () => {
    const config = scenarioConfigurationSchema.parse({
      kind: "extend_operating_hours",
      parameters: { additionalHoursPerDay: 1 },
    });
    const result = projectScenario(baseline(), config);
    expect(result.kind).toBe("extend_operating_hours");
    expect(
      scenarioConfigurationSchema.safeParse({ kind: "extend_operating_hours", parameters: {} })
        .success,
    ).toBe(false);
  });

  it("builds a baseline from samples without painting missing as zero", () => {
    const built = buildScenarioBaseline({
      range: { from: "2026-10-03", to: "2026-10-04" },
      metrics: [
        {
          metricType: "orders_processed",
          value: 100,
          recordedOn: "2026-10-03",
          areaId: null,
          assetId: null,
          areaName: null,
          assetName: null,
          assetType: null,
        },
      ],
      costs: [],
    });
    expect(built.orders).toBe(100);
    expect(built.operatingCost).toBeNull();
    expect(built.operatingHours).toBeNull();
  });

  it("compares one scenario to baseline or two scenarios", () => {
    const left = projectExtendOperatingHours(baseline(), { additionalHoursPerDay: 1 });
    const right = projectAddPackingStation(baseline(), {
      additionalStations: 1,
      referenceAssetId: packingSlow,
    });
    const vsBaseline = compareScenarioProjections({
      left: { id: "a", name: "Hours", projection: left },
    });
    expect(vsBaseline).toHaveLength(2);
    expect(vsBaseline[0]?.basis).toBe("observed");
    expect(vsBaseline[1]?.basis).toBe("modeled");
    const vsPeer = compareScenarioProjections({
      left: { id: "a", name: "Hours", projection: left },
      right: { id: "b", name: "Packing", projection: right },
    });
    expect(vsPeer).toHaveLength(2);
    expect(vsPeer.every((column) => column.basis === "modeled")).toBe(true);
  });
});

import type { KpiValue, UnavailableReason } from "@/lib/analytics/kpis";

export const SCENARIO_KINDS = [
  "add_packing_station",
  "increase_conveyor_capacity",
  "extend_operating_hours",
  "reassign_equipment",
  "increase_staffing",
  "reduce_downtime",
] as const;

export type ScenarioKind = (typeof SCENARIO_KINDS)[number];

export type ScenarioBasis = "observed" | "modeled";

export type ScenarioFigure = KpiValue & {
  basis: ScenarioBasis;
};

export type ScenarioHighlight = {
  label: string;
  figure: ScenarioFigure;
};

export type PerformanceBlock = {
  basis: ScenarioBasis;
  throughputOrdersPerDay: ScenarioFigure;
  throughputOrdersPerHour: ScenarioFigure;
  operatingCost: ScenarioFigure;
  costPerOrder: ScenarioFigure;
  highlights: ScenarioHighlight[];
};

export type ScenarioAsset = {
  assetId: string;
  name: string;
  assetType: string;
  areaId: string | null;
  areaName: string | null;
  utilization: number | null;
  orders: number | null;
  orderDays: number | null;
  ordersPerDay: number | null;
  bottleneckSeverity: number | null;
  downtimeMinutes: number | null;
  downtimeDays: number | null;
  downtimePerDay: number | null;
  maintenanceCost: number | null;
  maintenanceDays: number | null;
  dwellFirst: number | null;
  dwellLast: number | null;
  dwellMean: number | null;
};

/**
 * Observed inputs for a projection. Null means the series has no stored rows.
 * A stored zero stays zero.
 */
export type ScenarioBaseline = {
  periodFrom: string;
  periodTo: string;
  periodDays: number;
  orders: number | null;
  orderDays: number | null;
  operatingHours: number | null;
  hourDays: number | null;
  downtimeMinutes: number | null;
  downtimeDays: number | null;
  operatingCost: number | null;
  laborCost: number | null;
  assets: ScenarioAsset[];
};

export type ScenarioProjection = {
  kind: ScenarioKind;
  periodFrom: string;
  periodTo: string;
  baseline: PerformanceBlock;
  projected: PerformanceBlock;
  monthlySavings: ScenarioFigure;
  roi: ScenarioFigure;
  assumptions: string[];
  limitations: string[];
};

export function figure(
  value: number | null,
  unit: string,
  basis: ScenarioBasis,
  unavailableReason: UnavailableReason | null = null,
): ScenarioFigure {
  if (value === null || !Number.isFinite(value)) {
    return {
      value: null,
      unit,
      unavailableReason: unavailableReason ?? "missing_inputs",
      basis,
    };
  }
  return { value, unit, unavailableReason: null, basis };
}

export function unavailableFigure(
  unit: string,
  reason: UnavailableReason,
  basis: ScenarioBasis,
): ScenarioFigure {
  return { value: null, unit, unavailableReason: reason, basis };
}

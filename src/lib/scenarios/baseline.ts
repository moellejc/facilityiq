import type { CostSample, MetricSample } from "@/lib/analytics/aggregate";
import { utilizationFromSamples } from "@/lib/analytics/kpis";
import { inDayRange, inclusiveDayCount, type DayRange } from "@/lib/analytics/periods";

import type { ScenarioAsset, ScenarioBaseline } from "./types";

const FACILITY = (row: { areaId: string | null; assetId: string | null }) =>
  row.areaId === null && row.assetId === null;

export function buildScenarioBaseline(input: {
  range: DayRange;
  metrics: MetricSample[];
  costs: CostSample[];
}): ScenarioBaseline {
  const metrics = input.metrics.filter((row) => inDayRange(row.recordedOn, input.range));
  const costs = input.costs.filter((row) => inDayRange(row.recordedOn, input.range));
  const facility = metrics.filter(FACILITY);

  const orders = sumMetric(facility, "orders_processed");
  const hours = sumMetric(facility, "operating_hours");
  const downtime = sumMetric(facility, "downtime_minutes");

  const assets = new Map<string, DraftAsset>();
  for (const row of metrics) {
    if (!row.assetId) continue;
    const asset = assets.get(row.assetId) ?? emptyAsset(row);
    if (row.metricType === "utilization") asset.utilizationSamples.push(row.value);
    if (row.metricType === "orders_processed") asset.orderSamples.push(row);
    if (row.metricType === "bottleneck_severity") asset.severitySamples.push(row.value);
    if (row.metricType === "downtime_minutes") asset.downtimeSamples.push(row);
    if (row.metricType === "dwell_time_minutes") {
      asset.dwell.push({ day: row.recordedOn, value: row.value });
    }
    assets.set(row.assetId, asset);
  }

  for (const row of costs) {
    if (!row.assetId || row.category !== "maintenance") continue;
    const asset = assets.get(row.assetId) ?? emptyAssetFromCost(row);
    asset.maintenanceSamples.push(row.amount);
    assets.set(row.assetId, asset);
  }

  const laborRows = costs.filter((row) => row.category === "labor");
  const operatingRows = costs;

  return {
    periodFrom: input.range.from,
    periodTo: input.range.to,
    periodDays: inclusiveDayCount(input.range),
    orders: orders.total,
    orderDays: orders.days,
    operatingHours: hours.total,
    hourDays: hours.days,
    downtimeMinutes: downtime.total,
    downtimeDays: downtime.days,
    operatingCost: operatingRows.length === 0 ? null : sum(operatingRows.map((row) => row.amount)),
    laborCost: laborRows.length === 0 ? null : sum(laborRows.map((row) => row.amount)),
    assets: [...assets.values()].map(finishAsset),
  };
}

type DraftAsset = ScenarioAsset & {
  utilizationSamples: number[];
  orderSamples: MetricSample[];
  severitySamples: number[];
  downtimeSamples: MetricSample[];
  maintenanceSamples: number[];
  dwell: Array<{ day: string; value: number }>;
};

function emptyAsset(row: MetricSample): DraftAsset {
  return {
    assetId: row.assetId as string,
    name: row.assetName ?? "Asset",
    assetType: row.assetType ?? "asset",
    areaId: row.areaId,
    areaName: row.areaName,
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
    dwellFirst: null,
    dwellLast: null,
    dwellMean: null,
    utilizationSamples: [],
    orderSamples: [],
    severitySamples: [],
    downtimeSamples: [],
    maintenanceSamples: [],
    dwell: [],
  };
}

function emptyAssetFromCost(row: CostSample): DraftAsset {
  return emptyAsset({
    metricType: "maintenance",
    value: row.amount,
    recordedOn: row.recordedOn,
    areaId: row.areaId,
    assetId: row.assetId,
    areaName: row.areaName,
    assetName: row.assetName,
    assetType: null,
  });
}

function finishAsset(asset: DraftAsset): ScenarioAsset {
  const utilization = utilizationFromSamples(asset.utilizationSamples);
  const orders =
    asset.orderSamples.length === 0 ? null : sum(asset.orderSamples.map((row) => row.value));
  const orderDays = asset.orderSamples.length === 0 ? null : distinctDays(asset.orderSamples);
  const downtime =
    asset.downtimeSamples.length === 0 ? null : sum(asset.downtimeSamples.map((row) => row.value));
  const downtimeDays =
    asset.downtimeSamples.length === 0 ? null : distinctDays(asset.downtimeSamples);
  const dwell = [...asset.dwell].sort((a, b) => a.day.localeCompare(b.day));
  const maintenance = asset.maintenanceSamples.length === 0 ? null : sum(asset.maintenanceSamples);
  return {
    assetId: asset.assetId,
    name: asset.name,
    assetType: asset.assetType,
    areaId: asset.areaId,
    areaName: asset.areaName,
    utilization: utilization.value,
    orders,
    orderDays,
    ordersPerDay:
      orders === null || orderDays === null || orderDays === 0 ? null : orders / orderDays,
    bottleneckSeverity:
      asset.severitySamples.length === 0 ? null : Math.max(...asset.severitySamples),
    downtimeMinutes: downtime,
    downtimeDays,
    downtimePerDay:
      downtime === null || downtimeDays === null || downtimeDays === 0
        ? null
        : downtime / downtimeDays,
    maintenanceCost: maintenance,
    maintenanceDays: asset.maintenanceSamples.length === 0 ? null : asset.maintenanceSamples.length,
    dwellFirst: dwell[0]?.value ?? null,
    dwellLast: dwell[dwell.length - 1]?.value ?? null,
    dwellMean: dwell.length === 0 ? null : sum(dwell.map((row) => row.value)) / dwell.length,
  };
}

function sumMetric(rows: MetricSample[], metricType: string) {
  const matched = rows.filter((row) => row.metricType === metricType);
  if (matched.length === 0) return { total: null, days: null };
  return { total: sum(matched.map((row) => row.value)), days: distinctDays(matched) };
}

function distinctDays(rows: Array<{ recordedOn: string }>) {
  return new Set(rows.map((row) => row.recordedOn)).size;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

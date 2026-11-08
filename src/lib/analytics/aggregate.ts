import {
  averageCycleTime,
  bottleneckCount,
  BOTTLENECK_WARNING_THRESHOLD,
  costPerOrder,
  throughputOrdersPerDay,
  throughputOrdersPerHour,
  utilizationFromSamples,
  utilizationPercent,
  type KpiValue,
  type UnavailableReason,
} from "./kpis";
import { inDayRange, type DayRange } from "./periods";

export type MetricSample = {
  metricType: string;
  value: number;
  recordedOn: string;
  areaId: string | null;
  assetId: string | null;
  areaName: string | null;
  assetName: string | null;
  assetType: string | null;
};

export type CostSample = {
  category: string;
  amount: number;
  recordedOn: string;
  areaId: string | null;
  assetId: string | null;
  areaName: string | null;
  assetName: string | null;
};

export type ComparedKpi = {
  current: KpiValue;
  previous: KpiValue;
  delta: number | null;
  percentChange: number | null;
  comparisonReason: UnavailableReason | null;
};

export type TimePoint = {
  date: string;
  value: number | null;
};

export type NamedValue = {
  id: string;
  name: string;
  value: number;
  unit: string;
};

export type HeatmapMode = "utilization" | "throughput" | "operating_cost" | "bottleneck_severity";

export type HeatmapEntityValues = Partial<Record<HeatmapMode, number>>;

export type AnalyticsModel = {
  range: DayRange;
  previousRange: DayRange;
  freshness: string | null;
  operations: {
    throughputPerHour: ComparedKpi;
    throughputPerDay: ComparedKpi;
    unitsProcessed: ComparedKpi;
    assetUtilization: ComparedKpi;
    areaUtilization: ComparedKpi;
    capacityUtilization: ComparedKpi;
    cycleTime: ComparedKpi;
    downtime: ComparedKpi;
    bottleneckCount: ComparedKpi;
    bottleneckSeverity: ComparedKpi;
    throughputSeries: TimePoint[];
    utilizationByArea: NamedValue[];
    assetPerformance: NamedValue[];
  } | null;
  finance: {
    operatingCost: ComparedKpi;
    costPerOrder: ComparedKpi;
    labor: ComparedKpi;
    maintenance: ComparedKpi;
    energy: ComparedKpi;
    equipment: ComparedKpi;
    overhead: ComparedKpi;
    costSeries: TimePoint[];
    costByCategory: NamedValue[];
    costByArea: NamedValue[];
    costByAsset: NamedValue[];
  } | null;
  heatmap: {
    modes: HeatmapMode[];
    assets: Record<string, HeatmapEntityValues>;
    areas: Record<string, HeatmapEntityValues>;
    scales: Partial<Record<HeatmapMode, { min: number; max: number }>>;
  };
};

const FACILITY_METRIC = (row: MetricSample) => row.areaId === null && row.assetId === null;
const AREA_METRIC = (row: MetricSample) => row.areaId !== null && row.assetId === null;
const ASSET_METRIC = (row: MetricSample) => row.assetId !== null;

export function compareKpis(current: KpiValue, previous: KpiValue): ComparedKpi {
  if (current.value === null || previous.value === null) {
    return {
      current,
      previous,
      delta: null,
      percentChange: null,
      comparisonReason: current.unavailableReason ?? previous.unavailableReason ?? "missing_inputs",
    };
  }
  const delta = current.value - previous.value;
  if (previous.value === 0) {
    return {
      current,
      previous,
      delta,
      percentChange: null,
      comparisonReason: "zero_denominator",
    };
  }
  return {
    current,
    previous,
    delta,
    percentChange: (delta / previous.value) * 100,
    comparisonReason: null,
  };
}

export function buildAnalytics(input: {
  range: DayRange;
  previousRange: DayRange;
  freshness: string | null;
  metrics: MetricSample[];
  costs: CostSample[];
  includeOperations: boolean;
  includeFinance: boolean;
}): AnalyticsModel {
  const currentMetrics = input.metrics.filter((row) => inDayRange(row.recordedOn, input.range));
  const previousMetrics = input.metrics.filter((row) =>
    inDayRange(row.recordedOn, input.previousRange),
  );
  const currentCosts = input.costs.filter((row) => inDayRange(row.recordedOn, input.range));
  const previousCosts = input.costs.filter((row) =>
    inDayRange(row.recordedOn, input.previousRange),
  );

  const operations = input.includeOperations
    ? buildOperations(currentMetrics, previousMetrics)
    : null;
  const finance = input.includeFinance
    ? buildFinance(currentCosts, previousCosts, currentMetrics, previousMetrics)
    : null;

  return {
    range: input.range,
    previousRange: input.previousRange,
    freshness: input.freshness,
    operations,
    finance,
    heatmap: buildHeatmap(currentMetrics, currentCosts, {
      operations: input.includeOperations,
      finance: input.includeFinance,
    }),
  };
}

function buildOperations(current: MetricSample[], previous: MetricSample[]) {
  return {
    throughputPerHour: compareKpis(throughputHour(current), throughputHour(previous)),
    throughputPerDay: compareKpis(throughputDay(current), throughputDay(previous)),
    unitsProcessed: compareKpis(unitsProcessed(current), unitsProcessed(previous)),
    assetUtilization: compareKpis(
      meanUtilization(current, ASSET_METRIC),
      meanUtilization(previous, ASSET_METRIC),
    ),
    areaUtilization: compareKpis(
      meanUtilization(current, AREA_METRIC),
      meanUtilization(previous, AREA_METRIC),
    ),
    capacityUtilization: compareKpis(capacityUtilization(current), capacityUtilization(previous)),
    cycleTime: compareKpis(cycleTime(current), cycleTime(previous)),
    downtime: compareKpis(facilityDowntime(current), facilityDowntime(previous)),
    bottleneckCount: compareKpis(bottlenecks(current), bottlenecks(previous)),
    bottleneckSeverity: compareKpis(meanSeverity(current), meanSeverity(previous)),
    throughputSeries: throughputSeries(current),
    utilizationByArea: utilizationByArea(current),
    assetPerformance: assetPerformance(current),
  };
}

function buildFinance(
  currentCosts: CostSample[],
  previousCosts: CostSample[],
  currentMetrics: MetricSample[],
  previousMetrics: MetricSample[],
) {
  const currentTotal = sumAmounts(currentCosts);
  const previousTotal = sumAmounts(previousCosts);
  const currentOrders = facilitySum(currentMetrics, "orders_processed");
  const previousOrders = facilitySum(previousMetrics, "orders_processed");
  return {
    operatingCost: compareKpis(moneyKpi(currentTotal), moneyKpi(previousTotal)),
    costPerOrder: compareKpis(
      costPerOrder({ operatingCost: currentTotal, orders: currentOrders }),
      costPerOrder({ operatingCost: previousTotal, orders: previousOrders }),
    ),
    labor: compareKpis(categoryCost(currentCosts, "labor"), categoryCost(previousCosts, "labor")),
    maintenance: compareKpis(
      categoryCost(currentCosts, "maintenance"),
      categoryCost(previousCosts, "maintenance"),
    ),
    energy: compareKpis(
      categoryCost(currentCosts, "energy"),
      categoryCost(previousCosts, "energy"),
    ),
    equipment: compareKpis(
      categoryCost(currentCosts, "equipment"),
      categoryCost(previousCosts, "equipment"),
    ),
    overhead: compareKpis(
      categoryCost(currentCosts, "overhead"),
      categoryCost(previousCosts, "overhead"),
    ),
    costSeries: costSeries(currentCosts),
    costByCategory: groupCosts(
      currentCosts,
      (row) => row.category,
      (row) => row.category,
    ),
    costByArea: groupCosts(
      currentCosts,
      (row) => row.areaId ?? "facility",
      (row) => row.areaName ?? "Facility-wide",
    ),
    costByAsset: groupCosts(
      currentCosts.filter((row) => row.assetId),
      (row) => row.assetId as string,
      (row) => row.assetName ?? "Asset",
    ),
  };
}

function throughputHour(rows: MetricSample[]) {
  return throughputOrdersPerHour({
    orders: facilitySum(rows, "orders_processed"),
    hours: facilitySum(rows, "operating_hours"),
  });
}

function throughputDay(rows: MetricSample[]) {
  const orders = facilitySum(rows, "orders_processed");
  const days = distinctDays(
    rows.filter(FACILITY_METRIC).filter((row) => row.metricType === "orders_processed"),
  );
  return throughputOrdersPerDay({ orders, days });
}

function unitsProcessed(rows: MetricSample[]): KpiValue {
  const total = facilitySum(rows, "units_processed");
  if (total === null) return { value: null, unit: "units", unavailableReason: "empty_period" };
  return { value: total, unit: "units", unavailableReason: null };
}

function meanUtilization(rows: MetricSample[], predicate: (row: MetricSample) => boolean) {
  return utilizationFromSamples(
    rows
      .filter(predicate)
      .filter((row) => row.metricType === "utilization")
      .map((row) => row.value),
  );
}

function capacityUtilization(rows: MetricSample[]) {
  const packing = rows.filter((row) => row.assetType === "packing_station" && row.assetId !== null);
  const busy = sumValues(packing.filter((row) => row.metricType === "busy_minutes"));
  const available = sumValues(packing.filter((row) => row.metricType === "available_minutes"));
  return utilizationPercent({ busy, available });
}

function cycleTime(rows: MetricSample[]) {
  return averageCycleTime(
    rows
      .filter(FACILITY_METRIC)
      .filter((row) => row.metricType === "cycle_time_minutes")
      .map((row) => row.value),
  );
}

function facilityDowntime(rows: MetricSample[]): KpiValue {
  const total = facilitySum(rows, "downtime_minutes");
  if (total === null) return { value: null, unit: "minutes", unavailableReason: "empty_period" };
  return { value: total, unit: "minutes", unavailableReason: null };
}

function bottlenecks(rows: MetricSample[]) {
  return bottleneckCount(severityObservations(rows), BOTTLENECK_WARNING_THRESHOLD);
}

function meanSeverity(rows: MetricSample[]) {
  const samples = rows
    .filter((row) => row.metricType === "bottleneck_severity")
    .map((row) => row.value);
  const averaged = utilizationFromSamples(samples);
  return { ...averaged, unit: "ratio" };
}

function throughputSeries(rows: MetricSample[]): TimePoint[] {
  const facility = rows.filter(FACILITY_METRIC);
  const days = uniqueDays(
    facility.filter(
      (row) => row.metricType === "orders_processed" || row.metricType === "operating_hours",
    ),
  );
  return days.map((date) => {
    const dayRows = facility.filter((row) => row.recordedOn === date);
    const kpi = throughputOrdersPerHour({
      orders: sumValues(dayRows.filter((row) => row.metricType === "orders_processed")),
      hours: sumValues(dayRows.filter((row) => row.metricType === "operating_hours")),
    });
    return { date, value: kpi.value };
  });
}

function utilizationByArea(rows: MetricSample[]): NamedValue[] {
  const grouped = new Map<string, { name: string; values: number[] }>();
  for (const row of rows.filter(AREA_METRIC).filter((row) => row.metricType === "utilization")) {
    if (!row.areaId) continue;
    const entry = grouped.get(row.areaId) ?? { name: row.areaName ?? "Area", values: [] };
    entry.values.push(row.value);
    grouped.set(row.areaId, entry);
  }
  return [...grouped.entries()]
    .map(([id, entry]) => {
      const kpi = utilizationFromSamples(entry.values);
      return kpi.value === null
        ? null
        : { id, name: entry.name, value: kpi.value, unit: "percent" };
    })
    .filter((entry): entry is NamedValue => entry !== null)
    .sort((a, b) => b.value - a.value);
}

function assetPerformance(rows: MetricSample[]): NamedValue[] {
  const grouped = new Map<string, { name: string; type: string | null; values: number[] }>();
  for (const row of rows.filter(ASSET_METRIC).filter((row) => row.metricType === "utilization")) {
    if (!row.assetId) continue;
    if (row.assetType === "storage_rack" || row.assetType === "pallet") continue;
    const entry = grouped.get(row.assetId) ?? {
      name: row.assetName ?? "Asset",
      type: row.assetType,
      values: [],
    };
    entry.values.push(row.value);
    grouped.set(row.assetId, entry);
  }
  return [...grouped.entries()]
    .map(([id, entry]) => {
      const kpi = utilizationFromSamples(entry.values);
      return kpi.value === null
        ? null
        : { id, name: entry.name, value: kpi.value, unit: "percent" };
    })
    .filter((entry): entry is NamedValue => entry !== null)
    .sort((a, b) => b.value - a.value);
}

function moneyKpi(amount: number | null): KpiValue {
  if (amount === null) return { value: null, unit: "USD", unavailableReason: "empty_period" };
  return { value: amount, unit: "USD", unavailableReason: null };
}

function categoryCost(rows: CostSample[], category: string): KpiValue {
  return moneyKpi(sumAmounts(rows.filter((row) => row.category === category)));
}

function costSeries(rows: CostSample[]): TimePoint[] {
  const days = uniqueCostDays(rows);
  return days.map((date) => ({
    date,
    value: sumAmounts(rows.filter((row) => row.recordedOn === date)),
  }));
}

function groupCosts(
  rows: CostSample[],
  idOf: (row: CostSample) => string,
  nameOf: (row: CostSample) => string,
): NamedValue[] {
  const grouped = new Map<string, { name: string; amount: number }>();
  for (const row of rows) {
    const id = idOf(row);
    const entry = grouped.get(id) ?? { name: nameOf(row), amount: 0 };
    entry.amount += row.amount;
    grouped.set(id, entry);
  }
  return [...grouped.entries()]
    .filter(([, entry]) => Number.isFinite(entry.amount))
    .map(([id, entry]) => ({ id, name: entry.name, value: entry.amount, unit: "USD" }))
    .sort((a, b) => b.value - a.value);
}

function buildHeatmap(
  metrics: MetricSample[],
  costs: CostSample[],
  access: { operations: boolean; finance: boolean },
): AnalyticsModel["heatmap"] {
  const modes: HeatmapMode[] = [];
  if (access.operations) modes.push("utilization", "throughput", "bottleneck_severity");
  if (access.finance) modes.push("operating_cost");

  const assets: Record<string, HeatmapEntityValues> = {};
  const areas: Record<string, HeatmapEntityValues> = {};

  if (access.operations) {
    assignGrouped(
      assets,
      meanBy(
        metrics.filter(ASSET_METRIC).filter((row) => row.metricType === "utilization"),
        (row) => row.assetId,
      ),
      "utilization",
    );
    assignGrouped(
      areas,
      meanBy(
        metrics.filter(AREA_METRIC).filter((row) => row.metricType === "utilization"),
        (row) => row.areaId,
      ),
      "utilization",
    );
    assignGrouped(assets, throughputByAsset(metrics), "throughput");
    assignGrouped(
      assets,
      maxBy(
        metrics.filter(ASSET_METRIC).filter((row) => row.metricType === "bottleneck_severity"),
        (row) => row.assetId,
      ),
      "bottleneck_severity",
    );
    assignGrouped(
      areas,
      maxBy(
        metrics.filter(AREA_METRIC).filter((row) => row.metricType === "bottleneck_severity"),
        (row) => row.areaId,
      ),
      "bottleneck_severity",
    );
  }
  if (access.finance) {
    assignGrouped(
      assets,
      sumCostBy(costs, (row) => row.assetId),
      "operating_cost",
    );
    assignGrouped(
      areas,
      sumCostBy(
        costs.filter((row) => row.areaId),
        (row) => row.areaId,
      ),
      "operating_cost",
    );
  }

  const throughputScale = scaleOf(assets, "throughput");
  const costScale = scaleOf({ ...assets, ...areas }, "operating_cost");
  return {
    modes,
    assets,
    areas,
    scales: {
      ...(throughputScale ? { throughput: throughputScale } : {}),
      ...(costScale ? { operating_cost: costScale } : {}),
    },
  };
}

function assignGrouped(
  target: Record<string, HeatmapEntityValues>,
  values: Map<string, number>,
  mode: HeatmapMode,
) {
  for (const [id, value] of values) {
    if (!Number.isFinite(value)) continue;
    target[id] = { ...target[id], [mode]: value };
  }
}

function meanBy(rows: MetricSample[], idOf: (row: MetricSample) => string | null) {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const id = idOf(row);
    if (!id) continue;
    const values = grouped.get(id) ?? [];
    values.push(row.value);
    grouped.set(id, values);
  }
  const result = new Map<string, number>();
  for (const [id, values] of grouped) {
    const kpi = utilizationFromSamples(values);
    if (kpi.value !== null) result.set(id, kpi.value);
  }
  return result;
}

function maxBy(rows: MetricSample[], idOf: (row: MetricSample) => string | null) {
  const result = new Map<string, number>();
  for (const row of rows) {
    const id = idOf(row);
    if (!id || !Number.isFinite(row.value)) continue;
    const current = result.get(id);
    if (current === undefined || row.value > current) result.set(id, row.value);
  }
  return result;
}

function throughputByAsset(rows: MetricSample[]) {
  const grouped = new Map<string, MetricSample[]>();
  for (const row of rows
    .filter(ASSET_METRIC)
    .filter((row) => row.metricType === "orders_processed")) {
    if (!row.assetId) continue;
    const list = grouped.get(row.assetId) ?? [];
    list.push(row);
    grouped.set(row.assetId, list);
  }
  const result = new Map<string, number>();
  for (const [id, list] of grouped) {
    const kpi = throughputOrdersPerDay({
      orders: sumValues(list),
      days: distinctDays(list),
    });
    if (kpi.value !== null) result.set(id, kpi.value);
  }
  return result;
}

function sumCostBy(rows: CostSample[], idOf: (row: CostSample) => string | null) {
  const result = new Map<string, number>();
  for (const row of rows) {
    const id = idOf(row);
    if (!id || !Number.isFinite(row.amount)) continue;
    result.set(id, (result.get(id) ?? 0) + row.amount);
  }
  return result;
}

function scaleOf(
  entities: Record<string, HeatmapEntityValues>,
  mode: HeatmapMode,
): { min: number; max: number } | null {
  const values = Object.values(entities)
    .map((entry) => entry[mode])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (values.length === 0) return null;
  return { min: Math.min(...values), max: Math.max(...values) };
}

function severityObservations(rows: MetricSample[]) {
  const maxes = new Map<string, number>();
  let saw = false;
  for (const row of rows.filter((row) => row.metricType === "bottleneck_severity")) {
    saw = true;
    const id = row.assetId ?? row.areaId;
    if (!id || !Number.isFinite(row.value)) continue;
    const current = maxes.get(id);
    if (current === undefined || row.value > current) maxes.set(id, row.value);
  }
  if (!saw) return [];
  return [...maxes.entries()].map(([id, severity]) => ({ id, severity }));
}

function facilitySum(rows: MetricSample[], metricType: string) {
  return sumValues(rows.filter(FACILITY_METRIC).filter((row) => row.metricType === metricType));
}

function sumValues(rows: MetricSample[]) {
  if (rows.length === 0) return null;
  return rows.reduce((total, row) => total + row.value, 0);
}

function sumAmounts(rows: CostSample[]) {
  if (rows.length === 0) return null;
  return rows.reduce((total, row) => total + row.amount, 0);
}

function distinctDays(rows: Array<{ recordedOn: string }>) {
  if (rows.length === 0) return null;
  return new Set(rows.map((row) => row.recordedOn)).size;
}

function uniqueDays(rows: MetricSample[]) {
  return [...new Set(rows.map((row) => row.recordedOn))].sort();
}

function uniqueCostDays(rows: CostSample[]) {
  return [...new Set(rows.map((row) => row.recordedOn))].sort();
}

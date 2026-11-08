export const BOTTLENECK_WARNING_THRESHOLD = 0.7;

export type UnavailableReason = "empty_period" | "zero_denominator" | "missing_inputs";

export type KpiValue = {
  value: number | null;
  unit: string;
  unavailableReason: UnavailableReason | null;
};

function available(value: number, unit: string): KpiValue {
  return { value, unit, unavailableReason: null };
}

function unavailable(unit: string, reason: UnavailableReason): KpiValue {
  return { value: null, unit, unavailableReason: reason };
}

function isMissing(value: number | null | undefined): boolean {
  return value === null || value === undefined || !Number.isFinite(value);
}

function divide(
  numerator: number | null | undefined,
  denominator: number | null | undefined,
  unit: string,
): KpiValue {
  if (isMissing(numerator) || isMissing(denominator)) {
    return unavailable(unit, "missing_inputs");
  }
  if (denominator === 0) {
    return unavailable(unit, "zero_denominator");
  }
  if ((denominator as number) < 0 || (numerator as number) < 0) {
    return unavailable(unit, "missing_inputs");
  }
  return available((numerator as number) / (denominator as number), unit);
}

export function throughputOrdersPerHour(input: {
  orders: number | null | undefined;
  hours: number | null | undefined;
}): KpiValue {
  return divide(input.orders, input.hours, "orders/hour");
}

export function throughputOrdersPerDay(input: {
  orders: number | null | undefined;
  days: number | null | undefined;
}): KpiValue {
  return divide(input.orders, input.days, "orders/day");
}

/** Busy time over available time, expressed as a percent. */
export function utilizationPercent(input: {
  busy: number | null | undefined;
  available: number | null | undefined;
}): KpiValue {
  const ratio = divide(input.busy, input.available, "percent");
  if (ratio.value === null) return ratio;
  return available(ratio.value * 100, "percent");
}

/**
 * Average of stored utilization samples (already in percent).
 * Null samples are ignored. An empty collection is an empty period, not 0%.
 */
export function utilizationFromSamples(samples: Array<number | null | undefined>): KpiValue {
  const usable = samples.filter((sample): sample is number => Number.isFinite(sample));
  if (usable.length === 0) return unavailable("percent", "empty_period");
  const total = usable.reduce((sum, sample) => sum + sample, 0);
  return available(total / usable.length, "percent");
}

export function costPerOrder(input: {
  operatingCost: number | null | undefined;
  orders: number | null | undefined;
}): KpiValue {
  return divide(input.operatingCost, input.orders, "currency/order");
}

export function averageCycleTime(samples: Array<number | null | undefined>): KpiValue {
  const usable = samples.filter(
    (sample): sample is number =>
      typeof sample === "number" && Number.isFinite(sample) && sample >= 0,
  );
  if (usable.length === 0) return unavailable("minutes", "empty_period");
  const total = usable.reduce((sum, sample) => sum + sample, 0);
  return available(total / usable.length, "minutes");
}

export type BottleneckObservation = {
  id: string;
  severity: number | null | undefined;
};

/**
 * Distinct assets or areas whose severity is strictly above the threshold.
 * An empty observation list is an empty period. Zero matches is a real zero.
 */
export function bottleneckCount(
  observations: BottleneckObservation[],
  threshold = BOTTLENECK_WARNING_THRESHOLD,
): KpiValue {
  if (!Number.isFinite(threshold)) return unavailable("count", "missing_inputs");
  if (observations.length === 0) return unavailable("count", "empty_period");
  const ids = new Set<string>();
  for (const observation of observations) {
    if (!Number.isFinite(observation.severity)) continue;
    if ((observation.severity as number) > threshold) ids.add(observation.id);
  }
  return available(ids.size, "count");
}

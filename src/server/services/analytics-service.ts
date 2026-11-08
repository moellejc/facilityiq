import { buildAnalytics, type AnalyticsModel } from "@/lib/analytics/aggregate";
import {
  defaultRange,
  isDay,
  normalizeRange,
  previousPeriod,
  type DayRange,
} from "@/lib/analytics/periods";
import { roleCan, type Role } from "@/lib/permissions";
import { AppError } from "@/lib/errors";
import { loadAnalyticsSamples, loadMetricCoverage } from "@/server/repositories/analytics";

export type AnalyticsQuery = {
  from?: string | null;
  to?: string | null;
};

export async function getFacilityAnalytics(input: {
  organizationId: string;
  userId: string;
  facilityId: string;
  role: Role;
  query?: AnalyticsQuery;
}): Promise<AnalyticsModel> {
  const includeOperations = roleCan(input.role, "operations:read");
  const includeFinance = roleCan(input.role, "finance:read");
  if (!includeOperations && !includeFinance) {
    throw new AppError("FORBIDDEN", "You do not have permission to view these metrics.", 403);
  }

  const freshness = await loadMetricCoverage(input.organizationId, input.userId, input.facilityId);
  const range = resolveQueryRange(input.query, freshness);
  const previous = previousPeriod(range);
  const samples = await loadAnalyticsSamples(input.organizationId, input.userId, input.facilityId, {
    from: previous.from,
    to: range.to,
  });

  return buildAnalytics({
    range,
    previousRange: previous,
    freshness,
    metrics: samples.metrics,
    costs: samples.costs,
    includeOperations,
    includeFinance,
  });
}

export function resolveQueryRange(
  query: AnalyticsQuery | undefined,
  freshness: string | null,
): DayRange {
  const fallback = defaultRange(freshness) ?? { from: "1970-01-01", to: "1970-01-01" };
  const from = isDay(query?.from) ? query.from : fallback.from;
  const to = isDay(query?.to) ? query.to : fallback.to;
  return normalizeRange(from, to);
}

export function analyticsPresets(freshness: string | null) {
  const full = defaultRange(freshness);
  if (!full) return [];
  const latest = full.to;
  const last7from = shift(latest, -6);
  const last14from = shift(latest, -13);
  return [
    { label: "Full coverage", from: full.from, to: full.to },
    { label: "Last 14 days", from: last14from < full.from ? full.from : last14from, to: latest },
    { label: "Last 7 days", from: last7from < full.from ? full.from : last7from, to: latest },
  ];
}

function shift(day: string, days: number) {
  const time = Date.parse(`${day}T00:00:00.000Z`) + days * 24 * 60 * 60 * 1000;
  return new Date(time).toISOString().slice(0, 10);
}

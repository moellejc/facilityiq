import type { ComparedKpi } from "./aggregate";
import type { KpiValue, UnavailableReason } from "./kpis";

const REASON_LABEL: Record<UnavailableReason, string> = {
  empty_period: "No samples in this period",
  zero_denominator: "Denominator is zero",
  missing_inputs: "Missing inputs",
};

export function unavailableLabel(reason: UnavailableReason | null) {
  if (!reason) return "Unavailable";
  return `${REASON_LABEL[reason]} (${reason})`;
}

export function formatKpiValue(kpi: KpiValue) {
  if (kpi.value === null) return "Unavailable";
  return `${formatMeasure(kpi.value, kpi.unit)} ${unitSuffix(kpi.unit)}`.trim();
}

export function formatMeasure(value: number, unit: string) {
  if (unit === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }
  if (unit === "count" || unit === "units" || unit === "orders") {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
  }
  if (unit === "ratio") return value.toFixed(2);
  return value.toFixed(1);
}

export function unitSuffix(unit: string) {
  if (unit === "percent") return "%";
  if (unit === "USD" || unit === "count") return "";
  return unit;
}

export function formatComparison(compared: ComparedKpi) {
  if (compared.delta === null) {
    return `Previous period unavailable: ${unavailableLabel(compared.comparisonReason)}`;
  }
  const sign = compared.delta > 0 ? "+" : "";
  const amount =
    `${sign}${formatMeasure(compared.delta, compared.current.unit)} ${unitSuffix(compared.current.unit)}`.trim();
  if (compared.percentChange === null) {
    return `${amount} vs previous period (${unavailableLabel(compared.comparisonReason)})`;
  }
  const percentSign = compared.percentChange > 0 ? "+" : "";
  return `${amount} (${percentSign}${compared.percentChange.toFixed(1)}%) vs previous period`;
}

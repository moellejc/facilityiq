import type { HeatmapMode } from "./aggregate";

export const HEATMAP_MODE_LABEL: Record<HeatmapMode, string> = {
  utilization: "Utilization",
  throughput: "Throughput",
  operating_cost: "Operating cost",
  bottleneck_severity: "Bottleneck severity",
};

export function heatmapColor(
  mode: HeatmapMode,
  value: number | null | undefined,
  scale: { min: number; max: number } | null,
): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (mode === "utilization") {
    if (value > 90) return "#dc2626";
    if (value >= 70) return "#d97706";
    return "#059669";
  }
  if (mode === "bottleneck_severity") {
    if (value > 0.7) return "#dc2626";
    if (value > 0.4) return "#d97706";
    return "#059669";
  }
  if (!scale) return "#d97706";
  if (scale.max === scale.min) return "#d97706";
  const normalized = (value - scale.min) / (scale.max - scale.min);
  if (normalized >= 2 / 3) return "#dc2626";
  if (normalized >= 1 / 3) return "#d97706";
  return "#059669";
}

export function heatmapUnit(mode: HeatmapMode) {
  if (mode === "utilization") return "percent";
  if (mode === "throughput") return "orders/day";
  if (mode === "operating_cost") return "USD";
  return "ratio";
}

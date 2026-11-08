"use client";

import type { AnalyticsModel, HeatmapMode } from "@/lib/analytics/aggregate";
import { HEATMAP_MODE_LABEL, heatmapUnit } from "@/lib/analytics/heatmap";
import { formatMeasure, unitSuffix } from "@/lib/analytics/display";

export function HeatmapOverlay({
  enabled,
  mode,
  heatmap,
}: {
  enabled: boolean;
  mode: HeatmapMode;
  heatmap: AnalyticsModel["heatmap"] | null;
}) {
  if (!enabled || !heatmap) return null;
  const scale = heatmap.scales[mode];
  const absolute =
    mode === "utilization"
      ? "Green below 70%. Amber from 70% through 90%. Red above 90%."
      : mode === "bottleneck_severity"
        ? "Green at or below 0.40. Amber through 0.70. Red above 0.70."
        : scale
          ? `Green, amber, and red split the observed range ${formatMeasure(scale.min, heatmapUnit(mode))}–${formatMeasure(scale.max, heatmapUnit(mode))} ${unitSuffix(heatmapUnit(mode))}. Equal values stay amber.`
          : "No samples are available for this mode.";

  return (
    <div className="pointer-events-none absolute right-3 bottom-3 max-w-xs rounded-lg border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-sm">
      <p className="font-medium text-slate-900">{HEATMAP_MODE_LABEL[mode]}</p>
      <div className="mt-2 flex gap-1">
        <span className="h-2 flex-1 rounded-sm bg-emerald-600" />
        <span className="h-2 flex-1 rounded-sm bg-amber-600" />
        <span className="h-2 flex-1 rounded-sm bg-rose-600" />
      </div>
      <p className="mt-2">{absolute}</p>
      <p className="mt-1 text-slate-500">
        Objects without a stored sample keep their normal color.
      </p>
    </div>
  );
}

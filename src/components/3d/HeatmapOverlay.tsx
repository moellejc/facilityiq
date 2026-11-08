"use client";

export function HeatmapOverlay({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <div className="pointer-events-none absolute right-3 bottom-3 max-w-xs rounded-lg border border-slate-200 bg-white/95 p-3 text-xs text-slate-700 shadow-sm">
      <p className="font-medium text-slate-900">Heatmap</p>
      <p className="mt-1">
        Metric coloring is not applied. Utilization, throughput, operating cost, and bottleneck
        colors are calculated in the analytics phase.
      </p>
    </div>
  );
}

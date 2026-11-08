"use client";

import dynamic from "next/dynamic";

import type { AnalyticsModel } from "@/lib/analytics/aggregate";
import type { FacilityScene } from "@/lib/twin/types";

const FacilityCanvas = dynamic(
  () =>
    import("@/components/3d/FacilityCanvas")
      .then((mod) => mod.FacilityCanvas)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown load error";
        return function CanvasLoadError() {
          return (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              The 3D viewer failed to load. {message}
            </div>
          );
        };
      }),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[420px] items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-600">
        Loading the facility model…
      </div>
    ),
  },
);

export function TwinLoader({
  scene,
  heatmap,
}: {
  scene: FacilityScene;
  heatmap: AnalyticsModel["heatmap"] | null;
}) {
  return <FacilityCanvas scene={scene} heatmap={heatmap} />;
}

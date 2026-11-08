"use client";

import { useEffect, useMemo, useReducer } from "react";
import { Canvas } from "@react-three/fiber";

import { AssetTooltip } from "@/components/3d/AssetTooltip";
import { HeatmapOverlay } from "@/components/3d/HeatmapOverlay";
import { SceneToolbar } from "@/components/3d/SceneToolbar";
import { WarehouseScene } from "@/components/3d/WarehouseScene";
import { SelectionPanel } from "@/components/facilities/selection-panel";
import { formatMeasure, unitSuffix } from "@/lib/analytics/display";
import { heatmapUnit } from "@/lib/analytics/heatmap";
import type { AnalyticsModel, HeatmapMode } from "@/lib/analytics/aggregate";
import type { InsightMatch } from "@/lib/ai/match";
import { findAsset, focusPoint } from "@/lib/twin/scene";
import type { FacilityScene, TwinSelection } from "@/lib/twin/types";
import { initialTwinViewState, twinViewReducer } from "@/lib/twin/view-state";

export function FacilityCanvas({
  scene,
  heatmap,
  insights = [],
  initialSelection = null,
}: {
  scene: FacilityScene;
  heatmap: AnalyticsModel["heatmap"] | null;
  insights?: InsightMatch[];
  initialSelection?: TwinSelection;
}) {
  const [view, dispatch] = useReducer(twinViewReducer, {
    ...initialTwinViewState,
    selection: initialSelection,
  });
  useEffect(() => {
    if (!initialSelection) return;
    if (initialSelection.kind === "asset") {
      dispatch({ type: "select-asset", id: initialSelection.id });
    } else {
      dispatch({ type: "select-area", id: initialSelection.id });
    }
    dispatch({ type: "focus-selected" });
  }, [initialSelection]);
  const focusTarget = useMemo(() => focusPoint(scene, view.selection), [scene, view.selection]);
  const hovered = view.hoverId ? findAsset(scene, view.hoverId) : null;
  const hoveredMetric = hovered ? heatmapCaption(heatmap, view, hovered.id, "asset") : null;

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <SceneToolbar view={view} modes={heatmap?.modes ?? []} dispatch={dispatch} />
        <div className="relative h-[min(72vh,820px)] min-h-[420px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
          <Canvas
            shadows
            dpr={[1, 1.5]}
            camera={{ position: [18, 36, 42], fov: 42, near: 0.1, far: 500 }}
            gl={{ antialias: true, powerPreference: "high-performance" }}
            onPointerMissed={(event) => {
              if (event.type === "click") dispatch({ type: "clear-selection" });
            }}
          >
            <WarehouseScene
              scene={scene}
              view={view}
              focusTarget={focusTarget}
              heatmap={heatmap}
              onSelectAsset={(id) => dispatch({ type: "select-asset", id })}
              onSelectArea={(id) => dispatch({ type: "select-area", id })}
              onHover={(id) => dispatch({ type: "hover", id })}
            />
          </Canvas>
          <AssetTooltip asset={hovered} metric={hoveredMetric} />
          <HeatmapOverlay enabled={view.heatmapEnabled} mode={view.heatmapMode} heatmap={heatmap} />
        </div>
        <p className="text-xs text-slate-500">
          {scene.facility.name}
          {scene.layout ? ` · ${scene.layout.name} v${scene.layout.version}` : ""} ·{" "}
          {scene.assets.length} assets from the facility record
        </p>
      </div>
      <SelectionPanel scene={scene} selection={view.selection} insights={insights} />
    </div>
  );
}

function heatmapCaption(
  heatmap: AnalyticsModel["heatmap"] | null,
  view: { heatmapEnabled: boolean; heatmapMode: HeatmapMode },
  id: string,
  kind: "asset" | "area",
) {
  if (!view.heatmapEnabled || !heatmap) return null;
  const values = kind === "asset" ? heatmap.assets[id] : heatmap.areas[id];
  const value = values?.[view.heatmapMode];
  const unit = heatmapUnit(view.heatmapMode);
  if (value === undefined) return "No stored sample for this heatmap";
  return `${formatMeasure(value, unit)} ${unitSuffix(unit)}`.trim();
}

"use client";

import { useMemo, useReducer } from "react";
import { Canvas } from "@react-three/fiber";

import { AssetTooltip } from "@/components/3d/AssetTooltip";
import { HeatmapOverlay } from "@/components/3d/HeatmapOverlay";
import { SceneToolbar } from "@/components/3d/SceneToolbar";
import { WarehouseScene } from "@/components/3d/WarehouseScene";
import { SelectionPanel } from "@/components/facilities/selection-panel";
import { findAsset, focusPoint } from "@/lib/twin/scene";
import type { FacilityScene } from "@/lib/twin/types";
import { initialTwinViewState, twinViewReducer } from "@/lib/twin/view-state";

export function FacilityCanvas({ scene }: { scene: FacilityScene }) {
  const [view, dispatch] = useReducer(twinViewReducer, initialTwinViewState);
  const focusTarget = useMemo(() => focusPoint(scene, view.selection), [scene, view.selection]);
  const hovered = view.hoverId ? findAsset(scene, view.hoverId) : null;

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <SceneToolbar view={view} dispatch={dispatch} />
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
              onSelectAsset={(id) => dispatch({ type: "select-asset", id })}
              onSelectArea={(id) => dispatch({ type: "select-area", id })}
              onHover={(id) => dispatch({ type: "hover", id })}
            />
          </Canvas>
          <AssetTooltip asset={hovered} />
          <HeatmapOverlay enabled={view.heatmapEnabled} />
        </div>
        <p className="text-xs text-slate-500">
          {scene.facility.name}
          {scene.layout ? ` · ${scene.layout.name} v${scene.layout.version}` : ""} ·{" "}
          {scene.assets.length} assets from the facility record
        </p>
      </div>
      <SelectionPanel scene={scene} selection={view.selection} />
    </div>
  );
}

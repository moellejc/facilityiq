"use client";

import { Button } from "@/components/ui/button";
import { ASSET_CATEGORIES, type AssetCategory, type CameraProjection } from "@/lib/twin/types";
import { isCategoryVisible, type TwinViewAction, type TwinViewState } from "@/lib/twin/view-state";

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  storage_rack: "Racks",
  pallet: "Pallets",
  loading_dock: "Docks",
  packing_station: "Packing",
  conveyor: "Conveyors",
  forklift: "Forklifts",
};

export function SceneToolbar({
  view,
  dispatch,
}: {
  view: TwinViewState;
  dispatch: (action: TwinViewAction) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {ASSET_CATEGORIES.map((category) => {
        const visible = isCategoryVisible(view, category);
        return (
          <Button
            key={category}
            type="button"
            size="sm"
            variant={visible ? "default" : "outline"}
            aria-pressed={visible}
            onClick={() => dispatch({ type: "toggle-category", category })}
          >
            {CATEGORY_LABEL[category]}
          </Button>
        );
      })}
      <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
      <Button
        type="button"
        size="sm"
        variant={view.showLabels ? "default" : "outline"}
        aria-pressed={view.showLabels}
        onClick={() => dispatch({ type: "toggle-labels" })}
      >
        Labels
      </Button>
      <Button
        type="button"
        size="sm"
        variant={view.projection === "top-down" ? "default" : "outline"}
        onClick={() =>
          dispatch({
            type: "set-projection",
            projection: nextProjection(view.projection),
          })
        }
      >
        {view.projection === "top-down" ? "Top-down" : "Perspective"}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => dispatch({ type: "reset-camera" })}
      >
        Reset
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={view.selection === null}
        onClick={() => dispatch({ type: "focus-selected" })}
      >
        Focus
      </Button>
      <Button
        type="button"
        size="sm"
        variant={view.heatmapEnabled ? "default" : "outline"}
        aria-pressed={view.heatmapEnabled}
        onClick={() => dispatch({ type: "toggle-heatmap" })}
      >
        Heatmap
      </Button>
    </div>
  );
}

function nextProjection(projection: CameraProjection): CameraProjection {
  return projection === "perspective" ? "top-down" : "perspective";
}

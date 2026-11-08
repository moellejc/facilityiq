import { describe, expect, it } from "vitest";

import { boundsFromAreas, partitionAssets, readBounds, toSample } from "@/lib/twin/scene";
import type { SceneAsset } from "@/lib/twin/types";
import {
  initialTwinViewState,
  isCategoryVisible,
  twinViewReducer,
  visibleCategories,
} from "@/lib/twin/view-state";

describe("twin view state", () => {
  it("hides and shows an asset category without touching other layers", () => {
    const hidden = twinViewReducer(initialTwinViewState, {
      type: "toggle-category",
      category: "pallet",
    });
    expect(hidden.hiddenCategories).toEqual(["pallet"]);
    expect(isCategoryVisible(hidden, "pallet")).toBe(false);
    expect(isCategoryVisible(hidden, "storage_rack")).toBe(true);
    expect(visibleCategories(hidden)).not.toContain("pallet");

    const shown = twinViewReducer(hidden, { type: "toggle-category", category: "pallet" });
    expect(shown.hiddenCategories).toEqual([]);
  });

  it("selects an asset, then an area, then clears", () => {
    const asset = twinViewReducer(initialTwinViewState, { type: "select-asset", id: "rack-1" });
    expect(asset.selection).toEqual({ kind: "asset", id: "rack-1" });
    const area = twinViewReducer(asset, { type: "select-area", id: "aisle-4" });
    expect(area.selection).toEqual({ kind: "area", id: "aisle-4" });
    expect(twinViewReducer(area, { type: "clear-selection" }).selection).toBeNull();
  });

  it("resets the camera to perspective and ignores focus when nothing is selected", () => {
    const moved = twinViewReducer(initialTwinViewState, {
      type: "set-projection",
      projection: "top-down",
    });
    expect(moved.projection).toBe("top-down");
    expect(moved.cameraResetToken).toBe(1);

    const focused = twinViewReducer(moved, { type: "focus-selected" });
    expect(focused.focusToken).toBe(0);

    const reset = twinViewReducer(moved, { type: "reset-camera" });
    expect(reset.projection).toBe("perspective");
    expect(reset.cameraResetToken).toBe(2);
  });

  it("focuses only after a selection and does not store metric values", () => {
    const selected = twinViewReducer(initialTwinViewState, { type: "select-asset", id: "PS-02" });
    const focused = twinViewReducer(selected, { type: "focus-selected" });
    expect(focused.focusToken).toBe(1);
    expect(focused.selection).toEqual({ kind: "asset", id: "PS-02" });

    const heatmap = twinViewReducer(focused, { type: "toggle-heatmap" });
    expect(heatmap.heatmapEnabled).toBe(true);
    expect(heatmap).not.toHaveProperty("heatmapValues");
    expect(Object.keys(heatmap).sort()).toEqual(
      [
        "cameraResetToken",
        "focusToken",
        "heatmapEnabled",
        "hiddenCategories",
        "hoverId",
        "projection",
        "selection",
        "showLabels",
      ].sort(),
    );
  });

  it("toggles labels", () => {
    expect(initialTwinViewState.showLabels).toBe(true);
    expect(twinViewReducer(initialTwinViewState, { type: "toggle-labels" }).showLabels).toBe(false);
  });
});

describe("scene helpers", () => {
  it("reads layout bounds and falls back to area extents", () => {
    expect(
      readBounds({ bounds: { width: 100, depth: 60, height: 10 }, gridSize: 1 }, null),
    ).toEqual({ width: 100, depth: 60, height: 10, gridSize: 1 });
    expect(readBounds(null, { bounds: { width: 40, depth: 20, height: 8 } })?.width).toBe(40);
    expect(readBounds({ bounds: { width: 0, depth: 10, height: 10 } }, null)).toBeNull();
    expect(
      boundsFromAreas([{ position: { x: 20, z: 4 }, size: { width: 14, depth: 40, height: 8 } }]),
    ).toEqual({ width: 34, depth: 44, height: 8, gridSize: 1 });
  });

  it("drops an unusable utilization sample", () => {
    expect(toSample(null, "percent", "2026-11-01T12:00:00.000Z")).toBeNull();
    expect(toSample("97.5", "percent", "2026-11-01T12:00:00.000Z")?.value).toBe(97.5);
  });

  it("partitions racks and pallets for instancing", () => {
    const assets = [
      asset("storage_rack"),
      asset("storage_rack"),
      asset("pallet"),
      asset("forklift"),
    ];
    const grouped = partitionAssets(assets);
    expect(grouped.storage_rack).toHaveLength(2);
    expect(grouped.pallet).toHaveLength(1);
    expect(grouped.forklift).toHaveLength(1);
    expect(grouped.conveyor).toHaveLength(0);
  });
});

function asset(assetType: SceneAsset["assetType"]): SceneAsset {
  return {
    id: assetType,
    name: assetType,
    assetType,
    status: "active",
    areaId: null,
    areaName: null,
    position: { x: 0, y: 0, z: 0 },
    rotationDegrees: { x: 0, y: 0, z: 0 },
    modelUrl: null,
    rackName: null,
    level: null,
    latestUtilization: null,
  };
}

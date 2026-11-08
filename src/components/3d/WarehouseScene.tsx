"use client";

import { AssetMesh } from "@/components/3d/AssetMesh";
import { CameraControls } from "@/components/3d/CameraControls";
import { Conveyor } from "@/components/3d/Conveyor";
import { FacilityArea } from "@/components/3d/FacilityArea";
import { Forklift } from "@/components/3d/Forklift";
import { LoadingDock } from "@/components/3d/LoadingDock";
import { PackingStation } from "@/components/3d/PackingStation";
import { Pallet } from "@/components/3d/Pallet";
import { StorageRack } from "@/components/3d/StorageRack";
import { WarehouseFloor } from "@/components/3d/WarehouseFloor";
import { heatmapColor } from "@/lib/analytics/heatmap";
import type { AnalyticsModel } from "@/lib/analytics/aggregate";
import { partitionAssets } from "@/lib/twin/scene";
import type { FacilityScene, SceneVector } from "@/lib/twin/types";
import { isCategoryVisible, type TwinViewState } from "@/lib/twin/view-state";

export function WarehouseScene({
  scene,
  view,
  focusTarget,
  heatmap,
  onSelectAsset,
  onSelectArea,
  onHover,
}: {
  scene: FacilityScene;
  view: TwinViewState;
  focusTarget: SceneVector | null;
  heatmap: AnalyticsModel["heatmap"] | null;
  onSelectAsset: (id: string) => void;
  onSelectArea: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const visible = scene.assets.filter((asset) => isCategoryVisible(view, asset.assetType));
  const grouped = partitionAssets(visible);
  const selectedAssetId = view.selection?.kind === "asset" ? view.selection.id : null;
  const selectedAreaId = view.selection?.kind === "area" ? view.selection.id : null;
  const colorFor = (id: string, kind: "asset" | "area") => {
    if (!view.heatmapEnabled || !heatmap || !heatmap.modes.includes(view.heatmapMode)) return null;
    const values = kind === "asset" ? heatmap.assets[id] : heatmap.areas[id];
    return heatmapColor(
      view.heatmapMode,
      values?.[view.heatmapMode],
      heatmap.scales[view.heatmapMode] ?? null,
    );
  };

  return (
    <>
      <color attach="background" args={["#eef2ff"]} />
      <ambientLight intensity={0.62} />
      <hemisphereLight args={["#dbeafe", "#cbd5e1", 0.38]} />
      <directionalLight
        position={[scene.bounds.width * 0.2, 48, scene.bounds.depth * 0.15]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-camera-left={-70}
        shadow-camera-right={70}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <group position={[-scene.bounds.width / 2, 0, -scene.bounds.depth / 2]}>
        <WarehouseFloor bounds={scene.bounds} />
        {scene.areas.map((area) => (
          <FacilityArea
            key={area.id}
            area={area}
            selected={area.id === selectedAreaId}
            showLabel={view.showLabels}
            tint={colorFor(area.id, "area")}
            onSelect={onSelectArea}
          />
        ))}
        <StorageRack
          assets={grouped.storage_rack}
          selectedId={selectedAssetId}
          colorFor={(id) => colorFor(id, "asset")}
          onSelect={onSelectAsset}
          onHover={onHover}
        />
        <Pallet
          assets={grouped.pallet}
          selectedId={selectedAssetId}
          colorFor={(id) => colorFor(id, "asset")}
          onSelect={onSelectAsset}
          onHover={onHover}
        />
        {grouped.loading_dock.map((asset) => (
          <AssetMesh key={asset.id} asset={asset} onSelect={onSelectAsset} onHover={onHover}>
            <LoadingDock
              selected={asset.id === selectedAssetId}
              tint={colorFor(asset.id, "asset")}
            />
          </AssetMesh>
        ))}
        {grouped.packing_station.map((asset) => (
          <AssetMesh key={asset.id} asset={asset} onSelect={onSelectAsset} onHover={onHover}>
            <PackingStation
              selected={asset.id === selectedAssetId}
              tint={colorFor(asset.id, "asset")}
            />
          </AssetMesh>
        ))}
        {grouped.conveyor.map((asset) => (
          <AssetMesh key={asset.id} asset={asset} onSelect={onSelectAsset} onHover={onHover}>
            <Conveyor selected={asset.id === selectedAssetId} tint={colorFor(asset.id, "asset")} />
          </AssetMesh>
        ))}
        {grouped.forklift.map((asset) => (
          <AssetMesh key={asset.id} asset={asset} onSelect={onSelectAsset} onHover={onHover}>
            <Forklift selected={asset.id === selectedAssetId} tint={colorFor(asset.id, "asset")} />
          </AssetMesh>
        ))}
      </group>
      <CameraControls
        bounds={scene.bounds}
        projection={view.projection}
        resetToken={view.cameraResetToken}
        focusToken={view.focusToken}
        focusTarget={focusTarget}
      />
    </>
  );
}

import type {
  AssetCategory,
  FacilityScene,
  SceneAsset,
  SceneBounds,
  SceneSample,
  SceneVector,
  TwinSelection,
} from "./types";

export function asNumber(value: unknown, fallback = 0) {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readBounds(layoutData: unknown, metadata: unknown): SceneBounds | null {
  const layout = isRecord(layoutData) ? layoutData : null;
  const layoutBounds = layout && isRecord(layout.bounds) ? layout.bounds : null;
  const facility = isRecord(metadata) ? metadata : null;
  const facilityBounds = facility && isRecord(facility.bounds) ? facility.bounds : null;
  const source = layoutBounds ?? facilityBounds;
  if (!source) return null;
  const width = asNumber(source.width, 0);
  const depth = asNumber(source.depth, 0);
  const height = asNumber(source.height, 0);
  if (width <= 0 || depth <= 0 || height <= 0) return null;
  const gridSize = asNumber(layout?.gridSize, 1);
  return { width, depth, height, gridSize: gridSize > 0 ? gridSize : 1 };
}

export function boundsFromAreas(
  areas: Array<{
    position: { x: number; z: number };
    size: { width: number; depth: number; height: number };
  }>,
): SceneBounds {
  let width = 10;
  let depth = 10;
  let height = 4;
  for (const area of areas) {
    width = Math.max(width, area.position.x + area.size.width);
    depth = Math.max(depth, area.position.z + area.size.depth);
    height = Math.max(height, area.size.height);
  }
  return { width, depth, height, gridSize: 1 };
}

export function toSample(
  value: unknown,
  unit: unknown,
  recordedAt: Date | string | null | undefined,
): SceneSample | null {
  if (value === null || value === undefined || recordedAt == null) return null;
  const numeric = asNumber(value, Number.NaN);
  if (!Number.isFinite(numeric)) return null;
  const date = recordedAt instanceof Date ? recordedAt : new Date(recordedAt);
  if (Number.isNaN(date.getTime())) return null;
  return {
    value: numeric,
    unit: typeof unit === "string" && unit.length > 0 ? unit : "percent",
    recordedAt: date.toISOString(),
  };
}

export function partitionAssets(assets: SceneAsset[]) {
  const grouped: Record<AssetCategory, SceneAsset[]> = {
    storage_rack: [],
    pallet: [],
    loading_dock: [],
    packing_station: [],
    conveyor: [],
    forklift: [],
  };
  for (const asset of assets) {
    grouped[asset.assetType].push(asset);
  }
  return grouped;
}

export function findAsset(scene: FacilityScene, id: string) {
  return scene.assets.find((asset) => asset.id === id) ?? null;
}

export function findArea(scene: FacilityScene, id: string) {
  return scene.areas.find((area) => area.id === id) ?? null;
}

export function eventsForAsset(scene: FacilityScene, assetId: string) {
  return scene.events.filter((event) => event.assetId === assetId);
}

export function eventsForArea(scene: FacilityScene, areaId: string) {
  return scene.events.filter((event) => event.areaId === areaId);
}

export function degreesToRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

export function focusPoint(scene: FacilityScene, selection: TwinSelection): SceneVector | null {
  if (!selection) return null;
  if (selection.kind === "asset") {
    const asset = findAsset(scene, selection.id);
    if (!asset) return null;
    return { x: asset.position.x, y: asset.position.y + 1.2, z: asset.position.z };
  }
  const area = findArea(scene, selection.id);
  if (!area) return null;
  return {
    x: area.position.x + area.size.width / 2,
    y: 1,
    z: area.position.z + area.size.depth / 2,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

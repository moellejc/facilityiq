export const ASSET_CATEGORIES = [
  "storage_rack",
  "pallet",
  "loading_dock",
  "packing_station",
  "conveyor",
  "forklift",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export type SceneVector = { x: number; y: number; z: number };

export type SceneSample = {
  value: number;
  unit: string;
  recordedAt: string;
};

export type SceneEvent = {
  id: string;
  assetId: string | null;
  areaId: string | null;
  eventType: string;
  severity: "info" | "warning" | "critical";
  description: string;
  occurredAt: string;
};

export type SceneArea = {
  id: string;
  name: string;
  areaType: string;
  position: SceneVector;
  size: { width: number; height: number; depth: number };
  latestUtilization: SceneSample | null;
};

export type SceneAsset = {
  id: string;
  name: string;
  assetType: AssetCategory;
  status: "active" | "inactive" | "maintenance" | "retired";
  areaId: string | null;
  areaName: string | null;
  position: SceneVector;
  rotationDegrees: SceneVector;
  modelUrl: string | null;
  rackName: string | null;
  level: number | null;
  latestUtilization: SceneSample | null;
};

export type SceneBounds = {
  width: number;
  depth: number;
  height: number;
  gridSize: number;
};

export type FacilityScene = {
  facility: {
    id: string;
    name: string;
    location: string | null;
    facilityType: string;
  };
  layout: {
    id: string;
    name: string;
    version: number;
    createdAt: string;
  } | null;
  bounds: SceneBounds;
  areas: SceneArea[];
  assets: SceneAsset[];
  events: SceneEvent[];
};

export type TwinSelection = { kind: "asset"; id: string } | { kind: "area"; id: string } | null;

export type CameraProjection = "perspective" | "top-down";

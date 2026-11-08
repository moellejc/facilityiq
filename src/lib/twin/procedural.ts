import type { AssetCategory } from "./types";

/** Visual size used when an asset row has no dimensions of its own. */
export const PROCEDURAL_SIZE: Record<
  AssetCategory,
  { width: number; height: number; depth: number }
> = {
  storage_rack: { width: 1.15, height: 4.4, depth: 0.95 },
  pallet: { width: 1.02, height: 0.16, depth: 1.2 },
  loading_dock: { width: 3.2, height: 0.4, depth: 2.6 },
  packing_station: { width: 2.2, height: 1.05, depth: 1.25 },
  conveyor: { width: 7.2, height: 0.32, depth: 0.85 },
  forklift: { width: 1.05, height: 1.65, depth: 2.05 },
};

export const CATEGORY_COLOR: Record<AssetCategory, string> = {
  storage_rack: "#64748b",
  pallet: "#b45309",
  loading_dock: "#334155",
  packing_station: "#4338ca",
  conveyor: "#1e293b",
  forklift: "#ca8a04",
};

export const SELECTED_COLOR = "#6366f1";

export const AREA_TINT: Record<string, string> = {
  aisle: "#93c5fd",
  packing: "#c4b5fd",
  shipping: "#94a3b8",
  receiving: "#99f6e4",
  staging: "#fcd34d",
  returns: "#fda4af",
  maintenance: "#fdba74",
  office: "#cbd5e1",
};

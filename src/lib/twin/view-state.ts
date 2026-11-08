import {
  ASSET_CATEGORIES,
  type AssetCategory,
  type CameraProjection,
  type TwinSelection,
} from "./types";

export type TwinViewState = {
  selection: TwinSelection;
  hoverId: string | null;
  hiddenCategories: AssetCategory[];
  showLabels: boolean;
  projection: CameraProjection;
  heatmapEnabled: boolean;
  cameraResetToken: number;
  focusToken: number;
};

export type TwinViewAction =
  | { type: "select-asset"; id: string }
  | { type: "select-area"; id: string }
  | { type: "clear-selection" }
  | { type: "hover"; id: string | null }
  | { type: "toggle-category"; category: AssetCategory }
  | { type: "toggle-labels" }
  | { type: "set-projection"; projection: CameraProjection }
  | { type: "toggle-heatmap" }
  | { type: "reset-camera" }
  | { type: "focus-selected" };

export const initialTwinViewState: TwinViewState = {
  selection: null,
  hoverId: null,
  hiddenCategories: [],
  showLabels: true,
  projection: "perspective",
  heatmapEnabled: false,
  cameraResetToken: 0,
  focusToken: 0,
};

export function twinViewReducer(state: TwinViewState, action: TwinViewAction): TwinViewState {
  switch (action.type) {
    case "select-asset":
      return { ...state, selection: { kind: "asset", id: action.id } };
    case "select-area":
      return { ...state, selection: { kind: "area", id: action.id } };
    case "clear-selection":
      return { ...state, selection: null };
    case "hover":
      return state.hoverId === action.id ? state : { ...state, hoverId: action.id };
    case "toggle-category": {
      const hidden = state.hiddenCategories.includes(action.category)
        ? state.hiddenCategories.filter((category) => category !== action.category)
        : [...state.hiddenCategories, action.category];
      return { ...state, hiddenCategories: hidden };
    }
    case "toggle-labels":
      return { ...state, showLabels: !state.showLabels };
    case "set-projection":
      return state.projection === action.projection
        ? state
        : { ...state, projection: action.projection, cameraResetToken: state.cameraResetToken + 1 };
    case "toggle-heatmap":
      return { ...state, heatmapEnabled: !state.heatmapEnabled };
    case "reset-camera":
      return {
        ...state,
        projection: "perspective",
        cameraResetToken: state.cameraResetToken + 1,
      };
    case "focus-selected":
      if (!state.selection) return state;
      return { ...state, focusToken: state.focusToken + 1 };
    default:
      return state;
  }
}

export function isCategoryVisible(state: TwinViewState, category: AssetCategory) {
  return !state.hiddenCategories.includes(category);
}

export function visibleCategories(state: TwinViewState) {
  return ASSET_CATEGORIES.filter((category) => isCategoryVisible(state, category));
}

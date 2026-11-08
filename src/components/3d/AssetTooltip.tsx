"use client";

import { ASSET_TYPE_LABELS } from "@/lib/format";
import type { SceneAsset } from "@/lib/twin/types";

export function AssetTooltip({ asset }: { asset: SceneAsset | null }) {
  if (!asset) return null;
  return (
    <div className="pointer-events-none absolute top-3 left-3 rounded-md bg-slate-950/90 px-2.5 py-1.5 text-xs text-white shadow-sm">
      <span className="font-medium">{asset.name}</span>
      <span className="text-slate-300">
        {" "}
        · {ASSET_TYPE_LABELS[asset.assetType] ?? asset.assetType}
      </span>
    </div>
  );
}

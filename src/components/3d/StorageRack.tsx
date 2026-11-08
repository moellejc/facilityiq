"use client";

import { InstancedCategory } from "@/components/3d/instanced-category";
import { CATEGORY_COLOR, PROCEDURAL_SIZE } from "@/lib/twin/procedural";
import type { SceneAsset } from "@/lib/twin/types";

export function StorageRack({
  assets,
  selectedId,
  onSelect,
  onHover,
}: {
  assets: SceneAsset[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <InstancedCategory
      assets={assets}
      size={PROCEDURAL_SIZE.storage_rack}
      color={CATEGORY_COLOR.storage_rack}
      selectedId={selectedId}
      castShadow
      onSelect={onSelect}
      onHover={onHover}
    />
  );
}

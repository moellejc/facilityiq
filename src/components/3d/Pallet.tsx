"use client";

import { InstancedCategory } from "@/components/3d/instanced-category";
import { CATEGORY_COLOR, PROCEDURAL_SIZE } from "@/lib/twin/procedural";
import type { SceneAsset } from "@/lib/twin/types";

export function Pallet({
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
      size={PROCEDURAL_SIZE.pallet}
      color={CATEGORY_COLOR.pallet}
      selectedId={selectedId}
      onSelect={onSelect}
      onHover={onHover}
    />
  );
}

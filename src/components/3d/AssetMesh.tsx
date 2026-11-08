"use client";

import type { ReactNode } from "react";

import { degreesToRadians } from "@/lib/twin/scene";
import type { SceneAsset } from "@/lib/twin/types";

export function AssetMesh({
  asset,
  children,
  onSelect,
  onHover,
}: {
  asset: SceneAsset;
  children: ReactNode;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <group
      position={[asset.position.x, asset.position.y, asset.position.z]}
      rotation={[
        degreesToRadians(asset.rotationDegrees.x),
        degreesToRadians(asset.rotationDegrees.y),
        degreesToRadians(asset.rotationDegrees.z),
      ]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(asset.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHover(asset.id);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHover(null);
      }}
    >
      {children}
    </group>
  );
}

"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { BoxGeometry, Color, MeshStandardMaterial, Object3D, type InstancedMesh } from "three";

import { degreesToRadians } from "@/lib/twin/scene";
import type { SceneAsset } from "@/lib/twin/types";

const selectedColor = new Color("#818cf8");

export function InstancedCategory({
  assets,
  size,
  color,
  selectedId,
  castShadow = false,
  onSelect,
  onHover,
}: {
  assets: SceneAsset[];
  size: { width: number; height: number; depth: number };
  color: string;
  selectedId: string | null;
  castShadow?: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const ref = useRef<InstancedMesh>(null);
  const geometry = useMemo(
    () => new BoxGeometry(size.width, size.height, size.depth),
    [size.width, size.height, size.depth],
  );
  const material = useMemo(() => new MeshStandardMaterial(), []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const base = new Color(color);
    const dummy = (mesh.userData.dummy as Object3D | undefined) ?? new Object3D();
    mesh.userData.dummy = dummy;
    assets.forEach((asset, index) => {
      dummy.position.set(asset.position.x, asset.position.y + size.height / 2, asset.position.z);
      dummy.rotation.set(
        degreesToRadians(asset.rotationDegrees.x),
        degreesToRadians(asset.rotationDegrees.y),
        degreesToRadians(asset.rotationDegrees.z),
      );
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, asset.id === selectedId ? selectedColor : base);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [assets, color, selectedId, size.height]);

  if (assets.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, assets.length]}
      castShadow={castShadow}
      receiveShadow
      frustumCulled={false}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        const asset = assetAt(assets, event.instanceId);
        if (asset) onSelect(asset.id);
      }}
      onPointerOver={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        const asset = assetAt(assets, event.instanceId);
        if (asset) onHover(asset.id);
      }}
      onPointerOut={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        onHover(null);
      }}
    />
  );
}

function assetAt(assets: SceneAsset[], instanceId: number | undefined) {
  if (instanceId === undefined) return null;
  return assets[instanceId] ?? null;
}

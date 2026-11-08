"use client";

import { useEffect, useRef } from "react";
import { OrbitControls } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

import type { CameraProjection, SceneBounds, SceneVector } from "@/lib/twin/types";

export function CameraControls({
  bounds,
  projection,
  resetToken,
  focusToken,
  focusTarget,
}: {
  bounds: SceneBounds;
  projection: CameraProjection;
  resetToken: number;
  focusToken: number;
  focusTarget: SceneVector | null;
}) {
  const camera = useThree((state) => state.camera);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const focusTokenRef = useRef(focusToken);
  const resetTokenRef = useRef(resetToken);
  const framed = useRef(false);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const first = !framed.current;
    const resetChanged = resetTokenRef.current !== resetToken;
    const focusChanged = focusTokenRef.current !== focusToken;
    framed.current = true;
    resetTokenRef.current = resetToken;
    focusTokenRef.current = focusToken;
    if (!first && !resetChanged && !focusChanged) return;

    const span = Math.max(bounds.width, bounds.depth);
    const homeTarget = new Vector3(0, 0, 0);
    const homePosition =
      projection === "top-down"
        ? new Vector3(0, span * 0.9, 0.02)
        : new Vector3(span * 0.12, Math.max(span * 0.38, 28), span * 0.55);

    let target = homeTarget;
    let position = homePosition;
    if (focusChanged && !resetChanged && focusTarget) {
      target = new Vector3(
        focusTarget.x - bounds.width / 2,
        focusTarget.y,
        focusTarget.z - bounds.depth / 2,
      );
      position =
        projection === "top-down"
          ? new Vector3(target.x, target.y + 16, target.z + 0.02)
          : new Vector3(target.x + 7, target.y + 9, target.z + 7);
    }

    camera.position.copy(position);
    controls.target.copy(target);
    controls.update();
  }, [
    bounds.depth,
    bounds.height,
    bounds.width,
    camera,
    focusTarget,
    focusToken,
    projection,
    resetToken,
  ]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      maxPolarAngle={projection === "top-down" ? 0.45 : Math.PI / 2.05}
      minDistance={3}
      maxDistance={220}
    />
  );
}

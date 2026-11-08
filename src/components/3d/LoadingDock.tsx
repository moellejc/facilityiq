"use client";

import { SELECTED_COLOR } from "@/lib/twin/procedural";

export function LoadingDock({ selected }: { selected: boolean }) {
  const door = selected ? SELECTED_COLOR : "#475569";
  return (
    <group>
      <mesh position={[0, 0.2, 0]} receiveShadow castShadow>
        <boxGeometry args={[3.2, 0.4, 2.6]} />
        <meshStandardMaterial color={selected ? SELECTED_COLOR : "#cbd5e1"} />
      </mesh>
      <mesh position={[0, 1.7, -1.15]} castShadow>
        <boxGeometry args={[2.8, 2.6, 0.12]} />
        <meshStandardMaterial color={door} />
      </mesh>
    </group>
  );
}

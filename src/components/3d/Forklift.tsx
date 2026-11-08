"use client";

import { SELECTED_COLOR } from "@/lib/twin/procedural";

export function Forklift({ selected, tint }: { selected: boolean; tint?: string | null }) {
  const body = selected ? SELECTED_COLOR : (tint ?? "#eab308");
  return (
    <group>
      <mesh position={[0, 0.38, 0.05]} castShadow>
        <boxGeometry args={[1.05, 0.48, 1.7]} />
        <meshStandardMaterial color={body} />
      </mesh>
      <mesh position={[0, 0.95, -0.72]} castShadow>
        <boxGeometry args={[0.95, 1.15, 0.12]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 0.18, 0.55]} castShadow>
        <boxGeometry args={[0.9, 0.28, 0.28]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[-0.42, 0.16, 0.15]} castShadow>
        <boxGeometry args={[0.16, 0.32, 0.16]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0.42, 0.16, 0.15]} castShadow>
        <boxGeometry args={[0.16, 0.32, 0.16]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
    </group>
  );
}

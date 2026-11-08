"use client";

import { SELECTED_COLOR } from "@/lib/twin/procedural";

export function PackingStation({ selected, tint }: { selected: boolean; tint?: string | null }) {
  const top = selected ? SELECTED_COLOR : (tint ?? "#4f46e5");
  return (
    <group>
      <mesh position={[0, 0.92, 0]} castShadow>
        <boxGeometry args={[2.2, 0.12, 1.25]} />
        <meshStandardMaterial color={top} />
      </mesh>
      {[
        [-0.95, -0.5],
        [0.95, -0.5],
        [-0.95, 0.5],
        [0.95, 0.5],
      ].map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x ?? 0, 0.45, z ?? 0]} castShadow>
          <boxGeometry args={[0.1, 0.9, 0.1]} />
          <meshStandardMaterial color="#312e81" />
        </mesh>
      ))}
    </group>
  );
}

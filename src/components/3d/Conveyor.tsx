"use client";

import { SELECTED_COLOR } from "@/lib/twin/procedural";

export function Conveyor({ selected, tint }: { selected: boolean; tint?: string | null }) {
  return (
    <group>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[7.2, 0.28, 0.85]} />
        <meshStandardMaterial color={selected ? SELECTED_COLOR : (tint ?? "#334155")} />
      </mesh>
      <mesh position={[0, 0.58, 0]}>
        <boxGeometry args={[6.8, 0.06, 0.55]} />
        <meshStandardMaterial color={selected ? "#c7d2fe" : "#0f172a"} />
      </mesh>
    </group>
  );
}

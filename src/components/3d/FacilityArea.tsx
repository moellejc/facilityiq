"use client";

import { Html } from "@react-three/drei";

import { AREA_TINT, SELECTED_COLOR } from "@/lib/twin/procedural";
import type { SceneArea } from "@/lib/twin/types";

export function FacilityArea({
  area,
  selected,
  showLabel,
  onSelect,
}: {
  area: SceneArea;
  selected: boolean;
  showLabel: boolean;
  onSelect: (id: string) => void;
}) {
  const centerX = area.position.x + area.size.width / 2;
  const centerZ = area.position.z + area.size.depth / 2;
  const tint = AREA_TINT[area.areaType] ?? "#cbd5e1";

  return (
    <group>
      <mesh
        position={[centerX, 0.05, centerZ]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(area.id);
        }}
      >
        <boxGeometry args={[area.size.width, 0.08, area.size.depth]} />
        <meshStandardMaterial
          color={selected ? SELECTED_COLOR : tint}
          transparent
          opacity={selected ? 0.55 : 0.22}
        />
      </mesh>
      {showLabel ? (
        <Html position={[centerX, 0.35, centerZ]} center style={{ pointerEvents: "none" }}>
          <div className="rounded bg-white/85 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-slate-900 shadow-sm">
            {area.name}
          </div>
        </Html>
      ) : null}
    </group>
  );
}

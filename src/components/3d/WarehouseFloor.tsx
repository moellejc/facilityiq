"use client";

import { Grid } from "@react-three/drei";

import type { SceneBounds } from "@/lib/twin/types";

export function WarehouseFloor({ bounds }: { bounds: SceneBounds }) {
  const { width, depth, height } = bounds;
  const wallThickness = 0.28;
  const wallHeight = Math.max(height, 6);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[width / 2, 0, depth / 2]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#f5f5f4" />
      </mesh>
      <Grid
        args={[width, depth]}
        position={[width / 2, 0.02, depth / 2]}
        cellSize={bounds.gridSize}
        cellThickness={0.7}
        cellColor="#cbd5e1"
        sectionSize={Math.max(bounds.gridSize * 5, 5)}
        sectionThickness={1.2}
        sectionColor="#94a3b8"
        fadeDistance={Math.max(width, depth)}
        fadeStrength={1}
        infiniteGrid={false}
        followCamera={false}
      />
      <Wall
        position={[width / 2, wallHeight / 2, -wallThickness / 2]}
        size={[width, wallHeight, wallThickness]}
      />
      <Wall
        position={[width / 2, wallHeight / 2, depth + wallThickness / 2]}
        size={[width, wallHeight, wallThickness]}
      />
      <Wall
        position={[-wallThickness / 2, wallHeight / 2, depth / 2]}
        size={[wallThickness, wallHeight, depth]}
      />
      <Wall
        position={[width + wallThickness / 2, wallHeight / 2, depth / 2]}
        size={[wallThickness, wallHeight, depth]}
      />
    </group>
  );
}

function Wall({
  position,
  size,
}: {
  position: [number, number, number];
  size: [number, number, number];
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color="#e2e8f0" />
    </mesh>
  );
}

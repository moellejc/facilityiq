---
name: facilityiq-3d-digital-twin
description: FacilityIQ 3D digital twin standards with Three.js, React Three Fiber, and Drei — FacilityCanvas client loading, data-driven scene components, InstancedMesh, per-frame state in refs, resource disposal, selection, heatmaps with no-data semantics, and the separate layout editor. Use when working in src/components/3d, src/lib/twin, the twin page, heatmaps, or facility layouts.
---

# 3D Digital Twin (FacilityIQ)

Source: Notion Coding Conventions §10, §15.

## Loading

- `FacilityCanvas` loads only through a **small Client Component wrapper** using `next/dynamic(..., { ssr: false })` with a loading state and failure fallback — that's `src/components/facilities/twin-loader.tsx`. `ssr: false` is not allowed directly in a Server Component.
- The parent page stays server-rendered and passes a serializable `FacilityScene` DTO (`src/lib/twin/types.ts`).

## Scene components

- Reusable, data-driven components under `src/components/3d/` (`WarehouseScene`, `AssetMesh`, `StorageRack`, `Pallet`, `HeatmapOverlay`, `CameraControls`, `SceneToolbar`, …).
- Scene geometry is built from stored data (`src/lib/twin/scene.ts`, `procedural.ts`) — **never hardcoded demo strings or positions**.
- Selected-object details resolve from the data model by entity ID.

## Performance

- Use `InstancedMesh` for repeated objects (racks, pallets — hundreds to thousands). See `instanced-category.tsx`.
- Reuse geometry and materials; don't create them per render (`useMemo`).
- Per-frame camera/animation state lives in refs and `useFrame`, **never** React state.
- View state (layers, selection, heatmap mode, camera reset/focus tokens) uses the reducer in `src/lib/twin/view-state.ts`.

## Cleanup

- Dispose geometries, materials, and textures the viewer owns on unmount (`useEffect` cleanup calling `.dispose()`).
- Don't dispose shared resources still used elsewhere.
- Verify by mounting/unmounting repeatedly (navigate away and back).

## Heatmaps

- Modes: utilization, throughput, operating cost, bottleneck severity (`src/lib/analytics/heatmap.ts`).
- Colors come from **server-normalized** values with units, thresholds, and a legend.
- **Missing samples get a distinct "no data" appearance** — never the zero/healthy color.
- Cost heatmap only when the caller has `finance:read` (server omits the data otherwise).

## Layout editor

- Separate route/mode (`/facilities/layouts`) from the operational viewer.
- Grid snap, bounds checks, AABB overlap checks, enforced on the **server** too.
- Saves create a new version in `facility_layouts`; stale version → 409 conflict. Requires `layouts:write` (viewer can't save).

## Testing

- Unit-test pure twin logic (`view-state`, scene building, heatmap color) in `tests/unit` (e.g. `twin-view.test.ts`).
- WebGL interactions (selection, layer toggles, camera reset, heatmap, layout persistence) need Playwright — see `facilityiq-e2e-testing`.

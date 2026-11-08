import { describe, expect, it } from "vitest";

import { seedDatabase } from "@/db/seed";
import { facilityId, organizationId, userId } from "@/db/seed/ids";
import { loadFacilityScene } from "@/server/repositories/scene";

describe("facility scene", () => {
  it("builds the West Distribution Center from stored layout and assets", async () => {
    await seedDatabase();
    const scene = await loadFacilityScene(organizationId, userId("admin@acme.example"), facilityId);
    expect(scene?.facility.name).toBe("West Distribution Center");
    expect(scene?.layout?.name).toBe("As-built November 2026");
    expect(scene?.bounds).toEqual({ width: 100, depth: 60, height: 10, gridSize: 1 });
    expect(scene?.areas).toHaveLength(8);
    expect(scene?.assets.filter((asset) => asset.assetType === "storage_rack")).toHaveLength(80);
    expect(scene?.assets.filter((asset) => asset.assetType === "pallet")).toHaveLength(500);

    const station = scene?.assets.find((asset) => asset.name === "PS-02");
    expect(station?.areaName).toBe("Packing");
    expect(station?.latestUtilization?.value).toBeGreaterThan(95);
    expect(station?.latestUtilization?.unit).toBe("percent");

    const pallet = scene?.assets.find((asset) => asset.assetType === "pallet");
    expect(pallet?.latestUtilization).toBeNull();
    expect(pallet?.rackName).toMatch(/^RK-/);

    const aisle = scene?.areas.find((area) => area.name === "Aisle 04");
    expect(aisle?.latestUtilization?.value).toBeGreaterThan(90);
    expect(scene?.events.some((event) => event.description.includes("PS-02"))).toBe(true);
  });
});

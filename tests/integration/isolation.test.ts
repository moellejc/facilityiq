import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb } from "@/db";
import {
  assets,
  facilities,
  facilityAreas,
  organizationMembers,
  organizations,
  users,
} from "@/db/schema";
import {
  getFacility,
  listAreas,
  listAssets,
  listFacilities,
  updateFacility,
} from "@/server/repositories/facilities";

const suffix = randomUUID().slice(0, 8);
const orgA = randomUUID();
const orgB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const facilityA = randomUUID();
const facilityB = randomUUID();
const areaB = randomUUID();
const assetB = randomUUID();

describe("organization isolation", () => {
  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values([
      { id: userA, email: `a-${suffix}@isolation.test`, name: "Org A" },
      { id: userB, email: `b-${suffix}@isolation.test`, name: "Org B" },
    ]);
    await db.insert(organizations).values([
      { id: orgA, name: "Isolation A", slug: `isolation-a-${suffix}` },
      { id: orgB, name: "Isolation B", slug: `isolation-b-${suffix}` },
    ]);
    await db.insert(organizationMembers).values([
      { organizationId: orgA, userId: userA, role: "org_admin" },
      { organizationId: orgB, userId: userB, role: "viewer" },
    ]);
    await db.insert(facilities).values([
      { id: facilityA, organizationId: orgA, name: "Plant A", facilityType: "plant" },
      { id: facilityB, organizationId: orgB, name: "Plant B", facilityType: "warehouse" },
    ]);
    await db.insert(facilityAreas).values({
      id: areaB,
      organizationId: orgB,
      facilityId: facilityB,
      name: "Secret aisle",
      areaType: "aisle",
    });
    await db.insert(assets).values({
      id: assetB,
      organizationId: orgB,
      facilityId: facilityB,
      areaId: areaB,
      name: "Secret rack",
      assetType: "storage_rack",
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(organizations).where(eq(organizations.id, orgA));
    await db.delete(organizations).where(eq(organizations.id, orgB));
    await db.delete(users).where(eq(users.id, userA));
    await db.delete(users).where(eq(users.id, userB));
  });

  it("does not list another organization's facilities", async () => {
    const visible = await listFacilities(orgA, userA);
    expect(visible.map((facility) => facility.id)).toEqual([facilityA]);
    expect(visible.map((facility) => facility.id)).not.toContain(facilityB);
  });

  it("does not fetch another organization's facility by id", async () => {
    expect(await getFacility(orgA, userA, facilityB)).toBeNull();
    expect((await getFacility(orgA, userA, facilityA))?.name).toBe("Plant A");
  });

  it("does not read or update another organization's street address", async () => {
    const db = getDb();
    await db
      .update(facilities)
      .set({
        addressStreet: "9 Secret Road",
        addressCity: "Hidden",
        addressRegion: "OR",
        addressPostalCode: "97000",
        addressCountry: "United States",
      })
      .where(eq(facilities.id, facilityB));

    const own = await listFacilities(orgB, userB);
    expect(own.find((facility) => facility.id === facilityB)).toMatchObject({
      addressStreet: "9 Secret Road",
      addressCity: "Hidden",
      addressRegion: "OR",
      addressPostalCode: "97000",
      addressCountry: "United States",
    });
    const other = await listFacilities(orgA, userA);
    expect(other.find((facility) => facility.id === facilityB)).toBeUndefined();
    expect(await getFacility(orgA, userA, facilityB)).toBeNull();

    const updated = await updateFacility(orgA, userA, facilityB, {
      addressStreet: "Stolen Street",
      addressCity: "Nope",
      addressRegion: "WA",
      addressPostalCode: "98000",
      addressCountry: "United States",
    });
    expect(updated.status).toBe("missing");

    const [still] = await db
      .select({ addressStreet: facilities.addressStreet })
      .from(facilities)
      .where(eq(facilities.id, facilityB));
    expect(still?.addressStreet).toBe("9 Secret Road");
  });

  it("hides nested areas and assets when the facility id is from another org", async () => {
    const areas = await listAreas(orgA, userA, facilityB, 1, 50);
    expect(areas.total).toBe(0);
    expect(areas.data).toEqual([]);

    const assetPage = await listAssets(orgA, userA, facilityB, {
      page: 1,
      limit: 50,
      order: "asc",
      sort: "name",
    });
    expect(assetPage.total).toBe(0);
    expect(assetPage.data.find((asset) => asset.id === assetB)).toBeUndefined();
  });
});

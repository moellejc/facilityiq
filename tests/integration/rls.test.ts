import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb } from "@/db";
import { assets, facilities, organizationMembers, organizations, users } from "@/db/schema";

const suffix = randomUUID().slice(0, 8);
const orgA = randomUUID();
const orgB = randomUUID();
const userA = randomUUID();
const facilityA = randomUUID();
const facilityB = randomUUID();
const assetA = randomUUID();
const assetB = randomUUID();

const appUrl = "postgres://facilityiq_app:facilityiq_app_dev@localhost:5432/facilityiq_test";

describe("row-level security", () => {
  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values({ id: userA, email: `rls-${suffix}@test.local`, name: "RLS" });
    await db.insert(organizations).values([
      { id: orgA, name: "RLS A", slug: `rls-a-${suffix}` },
      { id: orgB, name: "RLS B", slug: `rls-b-${suffix}` },
    ]);
    await db.insert(organizationMembers).values({
      organizationId: orgA,
      userId: userA,
      role: "org_admin",
    });
    await db.insert(facilities).values([
      { id: facilityA, organizationId: orgA, name: "Visible", facilityType: "warehouse" },
      { id: facilityB, organizationId: orgB, name: "Hidden", facilityType: "warehouse" },
    ]);
    await db.insert(assets).values([
      {
        id: assetA,
        organizationId: orgA,
        facilityId: facilityA,
        name: "Visible rack",
        assetType: "storage_rack",
      },
      {
        id: assetB,
        organizationId: orgB,
        facilityId: facilityB,
        name: "Hidden rack",
        assetType: "storage_rack",
      },
    ]);
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(organizations).where(eq(organizations.id, orgA));
    await db.delete(organizations).where(eq(organizations.id, orgB));
    await db.delete(users).where(eq(users.id, userA));
  });

  it("hides every tenant row until the organization setting is present", async () => {
    const client = new Client({ connectionString: appUrl });
    await client.connect();
    try {
      const hidden = await client.query("select count(*)::int as total from assets");
      expect(hidden.rows[0].total).toBe(0);

      await client.query("select set_config('app.current_organization_id', $1, false)", [orgA]);
      await client.query("select set_config('app.current_user_id', $1, false)", [userA]);
      const facilitiesResult = await client.query("select id from facilities order by name");
      const assetsResult = await client.query("select id from assets");
      expect(facilitiesResult.rows.map((row) => row.id)).toEqual([facilityA]);
      expect(assetsResult.rows.map((row) => row.id)).toEqual([assetA]);
    } finally {
      await client.end();
    }
  });
});

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { getDb } from "@/db";
import { facilities, facilityAreas, organizationMembers, organizations, users } from "@/db/schema";

const suffix = randomUUID().slice(0, 8);
const orgId = randomUUID();
const userId = randomUUID();
const facilityId = randomUUID();

function errorText(error: unknown) {
  const parts: string[] = [];
  let current = error;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else {
      parts.push(String(current));
      break;
    }
  }
  return parts.join("\n");
}

describe("referential integrity", () => {
  afterAll(async () => {
    const db = getDb();
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it("rejects a facility street address that is only partly filled", async () => {
    const db = getDb();
    const localOrg = randomUUID();
    const localUser = randomUUID();
    await db.insert(users).values({
      id: localUser,
      email: `address-${suffix}@test.local`,
      name: "Address",
    });
    await db.insert(organizations).values({
      id: localOrg,
      name: "Address Org",
      slug: `address-${suffix}`,
    });
    await db.insert(facilities).values({
      organizationId: localOrg,
      name: "Complete address",
      facilityType: "warehouse",
      addressStreet: "1 Main Street",
      addressCity: "Tacoma",
      addressRegion: "WA",
      addressPostalCode: "98421",
      addressCountry: "United States",
    });

    let thrown: unknown;
    try {
      await db.insert(facilities).values({
        organizationId: localOrg,
        name: "Partial address",
        facilityType: "warehouse",
        addressStreet: "1 Main Street",
        addressCity: "Tacoma",
      });
    } catch (error) {
      thrown = error;
    }
    expect(errorText(thrown)).toContain("facilities_address_complete");

    await db.delete(organizations).where(eq(organizations.id, localOrg));
    await db.delete(users).where(eq(users.id, localUser));
  });

  it("rejects a street address made only of spaces", async () => {
    const db = getDb();
    const localOrg = randomUUID();
    const localUser = randomUUID();
    await db.insert(users).values({
      id: localUser,
      email: `blank-address-${suffix}@test.local`,
      name: "Blank address",
    });
    await db.insert(organizations).values({
      id: localOrg,
      name: "Blank Address Org",
      slug: `blank-address-${suffix}`,
    });

    let thrown: unknown;
    try {
      await db.insert(facilities).values({
        organizationId: localOrg,
        name: "Blank address",
        facilityType: "warehouse",
        addressStreet: " ",
        addressCity: " ",
        addressRegion: " ",
        addressPostalCode: " ",
        addressCountry: " ",
      });
    } catch (error) {
      thrown = error;
    }
    expect(errorText(thrown)).toContain("facilities_address_complete");

    await db.delete(organizations).where(eq(organizations.id, localOrg));
    await db.delete(users).where(eq(users.id, localUser));
  });

  it("rejects a facility that points at a missing organization", async () => {
    await expect(
      getDb().insert(facilities).values({
        organizationId: randomUUID(),
        name: "Orphan",
        facilityType: "other",
      }),
    ).rejects.toThrow();
  });

  it("rejects an area whose organization does not match its facility", async () => {
    const db = getDb();
    await db
      .insert(users)
      .values({ id: userId, email: `integrity-${suffix}@test.local`, name: "Integrity" });
    await db
      .insert(organizations)
      .values({ id: orgId, name: "Integrity Org", slug: `integrity-${suffix}` });
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId,
      role: "org_admin",
    });
    await db.insert(facilities).values({
      id: facilityId,
      organizationId: orgId,
      name: "Integrity Plant",
      facilityType: "plant",
    });

    let thrown: unknown;
    try {
      await db.insert(facilityAreas).values({
        organizationId: randomUUID(),
        facilityId,
        name: "Mismatched",
        areaType: "office",
      });
    } catch (error) {
      thrown = error;
    }
    expect(errorText(thrown)).toContain("organization_id does not match facility organization");
  });

  it("cascades facility removal when the organization is deleted", async () => {
    const db = getDb();
    await db.delete(organizations).where(eq(organizations.id, orgId));
    const remaining = await db.execute(
      sql`select count(*)::int as total from facilities where id = ${facilityId}`,
    );
    const total = Number(remaining.rows[0]?.total ?? 0);
    expect(total).toBe(0);
  });

  it("rejects a duplicate membership", async () => {
    const db = getDb();
    const localOrg = randomUUID();
    const localUser = randomUUID();
    await db.insert(users).values({
      id: localUser,
      email: `dup-${suffix}@test.local`,
      name: "Dup",
    });
    await db.insert(organizations).values({
      id: localOrg,
      name: "Dup Org",
      slug: `dup-${suffix}`,
    });
    await db.insert(organizationMembers).values({
      organizationId: localOrg,
      userId: localUser,
      role: "viewer",
    });
    await expect(
      db.insert(organizationMembers).values({
        organizationId: localOrg,
        userId: localUser,
        role: "org_admin",
      }),
    ).rejects.toThrow();
    await db.delete(organizations).where(eq(organizations.id, localOrg));
    await db.delete(users).where(eq(users.id, localUser));
  });
});

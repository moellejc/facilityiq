import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { getDb } from "@/db";
import { facilities, insights, organizationMembers, organizations, users } from "@/db/schema";
import { seedDatabase } from "@/db/seed";
import { deterministicUuid, facilityId, organizationId, userId } from "@/db/seed/ids";
import { AppError } from "@/lib/errors";
import {
  generateFacilityInsights,
  listInsightsForFacility,
  setInsightStatus,
} from "@/server/services/insight-service";

const operationsUser = userId("operations@acme.example");
const viewerUser = userId("viewer@acme.example");
const financeUser = userId("finance@acme.example");
const suffix = randomUUID().slice(0, 8);
const otherOrg = randomUUID();
const otherUser = randomUUID();
const otherFacility = randomUUID();
let previousApiKey: string | undefined;

describe("generated insights", () => {
  afterAll(async () => {
    if (previousApiKey === undefined) delete process.env.AI_API_KEY;
    else process.env.AI_API_KEY = previousApiKey;
    const db = getDb();
    await db.delete(organizations).where(eq(organizations.id, otherOrg));
    await db.delete(users).where(eq(users.id, otherUser));
  });

  it("attaches calculated insights to the seeded facility and keeps them inside the organization", async () => {
    await seedDatabase();
    previousApiKey = process.env.AI_API_KEY;
    delete process.env.AI_API_KEY;

    await expect(
      generateFacilityInsights({
        organizationId,
        userId: viewerUser,
        facilityId,
        role: "viewer",
        query: { from: "2026-10-03", to: "2026-11-01" },
      }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      generateFacilityInsights({
        organizationId,
        userId: financeUser,
        facilityId,
        role: "finance_manager",
        query: { from: "2026-10-03", to: "2026-11-01" },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const generated = await generateFacilityInsights({
      organizationId,
      userId: operationsUser,
      facilityId,
      role: "operations_manager",
      query: { from: "2026-10-03", to: "2026-11-01" },
    });
    expect(generated.enriched).toBe(false);
    expect(generated.generated).toBeGreaterThanOrEqual(5);

    const rows = await listInsightsForFacility({
      organizationId,
      userId: operationsUser,
      facilityId,
      role: "operations_manager",
    });
    const ofType = (type: string) => rows.filter((row) => row.insightType === type);

    expect(ofType("excessive_utilization").map((row) => row.areaName)).toEqual(["Aisle 04"]);
    expect(ofType("excessive_utilization")[0]?.areaId).toBe(deterministicUuid("area:aisle-04"));
    expect(ofType("capacity_constraint").map((row) => row.assetName)).toEqual(["PS-02"]);
    expect(ofType("capacity_constraint")[0]?.assetId).toBe(deterministicUuid("asset:PS-02"));
    expect(ofType("capacity_constraint")[0]?.impactLabel).toBe("not_calculable");

    const forklifts = ofType("underutilized_equipment");
    expect(forklifts).toHaveLength(1);
    expect(forklifts[0]?.affectedAssetIds).toEqual(
      expect.arrayContaining([deterministicUuid("asset:FL-04"), deterministicUuid("asset:FL-05")]),
    );
    expect(forklifts[0]?.affectedAssetIds).toHaveLength(2);
    expect(forklifts[0]?.estimatedFinancialImpact).toBeNull();

    const dwell = ofType("rising_dwell_time");
    expect(dwell).toHaveLength(1);
    expect(dwell[0]?.affectedAssetIds).toHaveLength(6);
    expect(dwell[0]?.areaId).toBe(deterministicUuid("area:shipping"));
    expect(dwell[0]?.impactLabel).toBe("not_calculable");

    const maintenance = ofType("rising_maintenance_cost");
    expect(maintenance).toHaveLength(1);
    expect(maintenance[0]?.assetId).toBe(deterministicUuid("asset:CV-02"));
    expect(maintenance[0]?.impactLabel).toBe("estimate");
    expect(Number(maintenance[0]?.estimatedFinancialImpact)).toBeGreaterThan(0);
    expect(
      rows.some(
        (row) =>
          row.areaId === deterministicUuid("area:receiving") &&
          row.insightType === "stable_operations",
      ),
    ).toBe(true);

    const db = getDb();
    const stored = await db.select().from(insights).where(eq(insights.facilityId, facilityId));
    expect(stored.length).toBe(rows.length);
    expect(stored.every((row) => row.organizationId === organizationId)).toBe(true);

    await db
      .insert(users)
      .values({ id: otherUser, email: `other-${suffix}@insights.test`, name: "Other" });
    await db.insert(organizations).values({
      id: otherOrg,
      name: "Other Manufacturing",
      slug: `other-${suffix}`,
    });
    await db.insert(organizationMembers).values({
      organizationId: otherOrg,
      userId: otherUser,
      role: "org_admin",
    });
    await db.insert(facilities).values({
      id: otherFacility,
      organizationId: otherOrg,
      name: "Other warehouse",
      facilityType: "warehouse",
    });

    const leakedByFacility = await listInsightsForFacility({
      organizationId: otherOrg,
      userId: otherUser,
      facilityId,
      role: "org_admin",
    });
    const otherRows = await listInsightsForFacility({
      organizationId: otherOrg,
      userId: otherUser,
      facilityId: otherFacility,
      role: "org_admin",
    });
    expect(leakedByFacility).toEqual([]);
    expect(otherRows).toEqual([]);

    const acmeInsight = rows[0];
    expect(acmeInsight).toBeTruthy();
    await expect(
      setInsightStatus({
        organizationId: otherOrg,
        userId: otherUser,
        facilityId,
        role: "org_admin",
        insightId: acmeInsight!.id,
        status: "dismissed",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const stillOpen = await listInsightsForFacility({
      organizationId,
      userId: viewerUser,
      facilityId,
      role: "viewer",
    });
    expect(stillOpen.find((row) => row.id === acmeInsight!.id)?.status).toBe("open");
  });
});

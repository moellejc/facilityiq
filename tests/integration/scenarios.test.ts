import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { getDb } from "@/db";
import { facilities, organizationMembers, organizations, users } from "@/db/schema";
import { seedDatabase } from "@/db/seed";
import { deterministicUuid, facilityId, organizationId, userId } from "@/db/seed/ids";
import { AppError } from "@/lib/errors";
import {
  compareScenarios,
  createScenario,
  deleteScenario,
  duplicateScenario,
  getScenarioDetail,
  listScenariosForFacility,
  runScenario,
} from "@/server/services/scenario-service";

const operations = userId("operations@acme.example");
const finance = userId("finance@acme.example");
const viewer = userId("viewer@acme.example");
const suffix = randomUUID().slice(0, 8);
const otherOrg = randomUUID();
const otherUser = randomUUID();
const otherFacility = randomUUID();

describe("scenario planning", () => {
  afterAll(async () => {
    const db = getDb();
    await db.delete(organizations).where(eq(organizations.id, otherOrg));
    await db.delete(users).where(eq(users.id, otherUser));
  });

  it("saves, runs, duplicates, compares, deletes, and enforces isolation", async () => {
    await seedDatabase();

    await expect(
      createScenario({
        organizationId,
        userId: viewer,
        facilityId,
        role: "viewer",
        body: {
          name: "Viewer blocked",
          configuration: {
            kind: "extend_operating_hours",
            parameters: { additionalHoursPerDay: 1 },
          },
        },
      }),
    ).rejects.toBeInstanceOf(AppError);

    await expect(
      createScenario({
        organizationId,
        userId: finance,
        facilityId,
        role: "finance_manager",
        body: {
          name: "Finance blocked",
          configuration: {
            kind: "extend_operating_hours",
            parameters: { additionalHoursPerDay: 1 },
          },
        },
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const created = await createScenario({
      organizationId,
      userId: operations,
      facilityId,
      role: "operations_manager",
      body: {
        name: "Extra packing lane",
        description: "Integration create",
        status: "draft",
        configuration: {
          kind: "add_packing_station",
          parameters: {
            additionalStations: 1,
            referenceAssetId: deterministicUuid("asset:PS-02"),
            modeledMonthlyCostPerStation: 1000,
            modeledInvestment: 10000,
          },
        },
      },
    });
    expect(created.kind).toBe("add_packing_station");

    const ran = await runScenario({
      organizationId,
      userId: operations,
      scenarioId: created.id,
      role: "operations_manager",
      query: { from: "2026-10-03", to: "2026-11-01" },
    });
    expect(ran.projection.baseline.basis).toBe("observed");
    expect(ran.projection.projected.basis).toBe("modeled");
    expect(ran.projection.baseline.throughputOrdersPerDay.value).toBeGreaterThan(0);
    expect(ran.result.label).toContain("Modeled estimate");

    const detail = await getScenarioDetail({
      organizationId,
      userId: finance,
      scenarioId: created.id,
      role: "finance_manager",
    });
    expect(detail.results.length).toBeGreaterThanOrEqual(1);

    const copy = await duplicateScenario({
      organizationId,
      userId: operations,
      scenarioId: created.id,
      role: "operations_manager",
    });
    expect(copy.name).toContain("(copy)");
    expect(copy.status).toBe("draft");

    const vsBaseline = await compareScenarios({
      organizationId,
      userId: finance,
      facilityId,
      role: "finance_manager",
      leftId: created.id,
      query: { from: "2026-10-03", to: "2026-11-01" },
    });
    expect(vsBaseline.columns).toHaveLength(2);
    expect(vsBaseline.columns[0]?.basis).toBe("observed");
    expect(vsBaseline.columns[1]?.basis).toBe("modeled");

    const seeded = await listScenariosForFacility({
      organizationId,
      userId: viewer,
      facilityId,
      role: "viewer",
    });
    const downtime = seeded.find((row) => row.kind === "reduce_downtime");
    expect(downtime).toBeTruthy();
    const vsPeer = await compareScenarios({
      organizationId,
      userId: operations,
      facilityId,
      role: "operations_manager",
      leftId: created.id,
      rightId: downtime!.id,
      query: { from: "2026-10-03", to: "2026-11-01" },
    });
    expect(vsPeer.columns).toHaveLength(2);
    expect(vsPeer.columns.every((column) => column.basis === "modeled")).toBe(true);

    await expect(
      runScenario({
        organizationId,
        userId: viewer,
        scenarioId: created.id,
        role: "viewer",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const db = getDb();
    await db.insert(users).values({
      id: otherUser,
      email: `scenario-${suffix}@test.example`,
      name: "Other",
    });
    await db.insert(organizations).values({
      id: otherOrg,
      name: "Other Org",
      slug: `scenario-${suffix}`,
    });
    await db.insert(organizationMembers).values({
      organizationId: otherOrg,
      userId: otherUser,
      role: "org_admin",
    });
    await db.insert(facilities).values({
      id: otherFacility,
      organizationId: otherOrg,
      name: "Other plant",
      facilityType: "plant",
    });

    const leaked = await listScenariosForFacility({
      organizationId: otherOrg,
      userId: otherUser,
      facilityId,
      role: "org_admin",
    });
    expect(leaked).toEqual([]);

    await expect(
      getScenarioDetail({
        organizationId: otherOrg,
        userId: otherUser,
        scenarioId: created.id,
        role: "org_admin",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const deleted = await deleteScenario({
      organizationId,
      userId: operations,
      scenarioId: copy.id,
      role: "operations_manager",
    });
    expect(deleted.id).toBe(copy.id);
    await expect(
      getScenarioDetail({
        organizationId,
        userId: operations,
        scenarioId: copy.id,
        role: "operations_manager",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb } from "@/db";
import {
  assetEvents,
  assets,
  facilities,
  facilityAreas,
  organizationMembers,
  organizations,
  users,
} from "@/db/schema";
import { listFacilityAttentionEvents } from "@/server/repositories/events";
import { getFacilityAttention } from "@/server/services/attention-service";

const suffix = randomUUID().slice(0, 8);
const orgA = randomUUID();
const orgB = randomUUID();
const userA = randomUUID();
const userB = randomUUID();
const facilityA = randomUUID();
const facilityB = randomUUID();
const areaA = randomUUID();
const areaB = randomUUID();
const assetA = randomUUID();
const occurredAt = new Date("2026-11-01T00:00:00.000Z");

describe("facility attention events", () => {
  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values([
      { id: userA, email: `a-${suffix}@attention.test`, name: "Org A" },
      { id: userB, email: `b-${suffix}@attention.test`, name: "Org B" },
    ]);
    await db.insert(organizations).values([
      { id: orgA, name: "Attention A", slug: `attention-a-${suffix}` },
      { id: orgB, name: "Attention B", slug: `attention-b-${suffix}` },
    ]);
    await db.insert(organizationMembers).values([
      { organizationId: orgA, userId: userA, role: "viewer" },
      { organizationId: orgB, userId: userB, role: "org_admin" },
    ]);
    await db.insert(facilities).values([
      { id: facilityA, organizationId: orgA, name: "Plant A", facilityType: "plant" },
      { id: facilityB, organizationId: orgB, name: "Plant B", facilityType: "warehouse" },
    ]);
    await db.insert(facilityAreas).values([
      {
        id: areaA,
        organizationId: orgA,
        facilityId: facilityA,
        name: "Packing",
        areaType: "packing",
      },
      {
        id: areaB,
        organizationId: orgB,
        facilityId: facilityB,
        name: "Secret aisle",
        areaType: "aisle",
      },
    ]);
    await db.insert(assets).values({
      id: assetA,
      organizationId: orgA,
      facilityId: facilityA,
      areaId: areaA,
      name: "PS-02",
      assetType: "packing_station",
    });
    await db.insert(assetEvents).values([
      {
        organizationId: orgA,
        facilityId: facilityA,
        areaId: areaA,
        assetId: assetA,
        eventType: "capacity",
        severity: "critical",
        description: "PS-02 cannot clear its queue.",
        occurredAt,
      },
      {
        organizationId: orgA,
        facilityId: facilityA,
        areaId: areaA,
        eventType: "alert",
        severity: "info",
        description: "Packing is inside its target band.",
        occurredAt,
      },
      {
        organizationId: orgB,
        facilityId: facilityB,
        areaId: areaB,
        eventType: "utilization",
        severity: "critical",
        description: "Secret aisle is over capacity.",
        occurredAt,
      },
    ]);
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(organizations).where(eq(organizations.id, orgA));
    await db.delete(organizations).where(eq(organizations.id, orgB));
    await db.delete(users).where(eq(users.id, userA));
    await db.delete(users).where(eq(users.id, userB));
  });

  it("does not return another organization's alerts", async () => {
    const visible = await listFacilityAttentionEvents(orgA, userA, facilityA);
    expect(visible.data.map((row) => row.summary)).toEqual(["PS-02 cannot clear its queue."]);
    expect(visible.total).toBe(1);

    const crossed = await listFacilityAttentionEvents(orgA, userA, facilityB);
    expect(crossed.data).toEqual([]);
    expect(crossed.total).toBe(0);
  });

  it("lists the caller's warning and critical alerts and hides info", async () => {
    const model = await getFacilityAttention({
      organizationId: orgA,
      userId: userA,
      facilityId: facilityA,
      role: "viewer",
      filter: "all",
    });

    expect(model.status).toBe("ready");
    if (model.status !== "ready") return;
    expect(model.facilityName).toBe("Plant A");
    expect(model.items.map((item) => item.subjectName)).toEqual(["PS-02"]);
    expect(model.items[0]).toMatchObject({
      subjectKind: "asset",
      severity: "critical",
      areaName: "Packing",
    });
    expect(model.truncated).toBe(false);
  });

  it("reports another organization's facility as not found", async () => {
    const model = await getFacilityAttention({
      organizationId: orgA,
      userId: userA,
      facilityId: facilityB,
      role: "viewer",
      filter: "all",
    });
    expect(model).toEqual({ status: "not_found" });
  });
});

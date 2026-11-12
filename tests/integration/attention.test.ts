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
import { ATTENTION_EVENT_LIMIT, listFacilityAttentionEvents } from "@/server/repositories/events";
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
        eventType: "dwell",
        severity: "warning",
        description: "Dock dwell is rising.",
        occurredAt: new Date("2026-10-20T00:00:00.000Z"),
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
    const visible = await listFacilityAttentionEvents(orgA, userA, facilityA, "all");
    expect(visible.data.map((row) => row.summary)).toEqual([
      "PS-02 cannot clear its queue.",
      "Dock dwell is rising.",
    ]);
    expect(visible.total).toBe(2);

    const crossed = await listFacilityAttentionEvents(orgA, userA, facilityB, "all");
    expect(crossed.data).toEqual([]);
    expect(crossed.total).toBe(0);
  });

  it("returns warning alerts and leaves info alerts out", async () => {
    const warnings = await listFacilityAttentionEvents(orgA, userA, facilityA, "warning");
    expect(warnings.data.map((row) => row.summary)).toEqual(["Dock dwell is rising."]);
    expect(warnings.total).toBe(1);
    expect(warnings.data.some((row) => row.severity === "info")).toBe(false);
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
    expect(model.items.map((item) => item.subjectName)).toEqual(["PS-02", "Packing"]);
    expect(model.items[0]).toMatchObject({
      subjectKind: "asset",
      severity: "critical",
      areaName: "Packing",
    });
    expect(model.items[1]).toMatchObject({
      subjectKind: "area",
      severity: "warning",
      subjectName: "Packing",
    });
    expect(model.truncated).toBe(false);
  });

  it("omits critical subjects when the warning filter is selected", async () => {
    const model = await getFacilityAttention({
      organizationId: orgA,
      userId: userA,
      facilityId: facilityA,
      role: "viewer",
      filter: "warning",
    });
    expect(model.status).toBe("ready");
    if (model.status !== "ready") return;
    expect(model.items.map((item) => item.subjectName)).toEqual(["Packing"]);
    expect(model.totalSignals).toBe(1);
    expect(model.truncated).toBe(false);
  });

  it("returns no_facility when no facility is selected", async () => {
    const model = await getFacilityAttention({
      organizationId: orgA,
      userId: userA,
      facilityId: null,
      role: "viewer",
      filter: "all",
    });
    expect(model).toEqual({ status: "no_facility" });
  });

  it("does not attach another organization's area name", async () => {
    const db = getDb();
    const [inserted] = await db
      .insert(assetEvents)
      .values({
        organizationId: orgA,
        facilityId: facilityA,
        areaId: areaB,
        eventType: "alert",
        severity: "warning",
        description: "Cross-org area reference",
        occurredAt,
      })
      .returning({ id: assetEvents.id });
    try {
      const visible = await listFacilityAttentionEvents(orgA, userA, facilityA, "warning");
      const row = visible.data.find((item) => item.id === inserted?.id);
      expect(row?.areaName).toBeNull();
      expect(row?.assetName).toBeNull();
      expect(row?.summary).toBe("Cross-org area reference");
      expect(visible.data.some((item) => item.areaName === "Secret aisle")).toBe(false);
    } finally {
      if (inserted) await db.delete(assetEvents).where(eq(assetEvents.id, inserted.id));
    }
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

describe("attention alert window", () => {
  const suffix = randomUUID().slice(0, 8);
  const orgId = randomUUID();
  const user = randomUUID();
  const facility = randomUUID();
  const area = randomUUID();
  const oldest = new Date("2026-01-01T00:00:00.000Z");
  const day = 24 * 60 * 60 * 1000;
  const droppedId = "00000000-0000-4000-8000-000000000001";
  const keptTieId = "ffffffff-ffff-4fff-bfff-ffffffffffff";

  beforeAll(async () => {
    const db = getDb();
    await db
      .insert(users)
      .values({ id: user, email: `window-${suffix}@attention.test`, name: "Window" });
    await db.insert(organizations).values({
      id: orgId,
      name: "Attention window",
      slug: `attention-window-${suffix}`,
    });
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: user,
      role: "viewer",
    });
    await db.insert(facilities).values({
      id: facility,
      organizationId: orgId,
      name: "Window plant",
      facilityType: "plant",
    });
    await db.insert(facilityAreas).values({
      id: area,
      organizationId: orgId,
      facilityId: facility,
      name: "Window aisle",
      areaType: "aisle",
    });
    const recent = Array.from({ length: ATTENTION_EVENT_LIMIT - 1 }, (_, index) => {
      const sequence = index + 2;
      return {
        id: `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`,
        organizationId: orgId,
        facilityId: facility,
        areaId: area,
        eventType: "alert" as const,
        severity: "warning" as const,
        description: `Window ${sequence}`,
        occurredAt: new Date(oldest.getTime() + sequence * day),
      };
    });
    await db.insert(assetEvents).values([
      ...recent,
      {
        id: droppedId,
        organizationId: orgId,
        facilityId: facility,
        areaId: area,
        eventType: "alert" as const,
        severity: "warning" as const,
        description: "Dropped older id",
        occurredAt: oldest,
      },
      {
        id: keptTieId,
        organizationId: orgId,
        facilityId: facility,
        areaId: area,
        eventType: "alert" as const,
        severity: "warning" as const,
        description: "Kept newer id",
        occurredAt: oldest,
      },
    ]);
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, user));
  });

  it("keeps the 100 newest warning alerts and drops the older tied id", async () => {
    const visible = await listFacilityAttentionEvents(orgId, user, facility, "warning");
    expect(visible.data).toHaveLength(ATTENTION_EVENT_LIMIT);
    expect(visible.total).toBe(ATTENTION_EVENT_LIMIT + 1);
    expect(visible.data.some((row) => row.id === keptTieId)).toBe(true);
    expect(visible.data.some((row) => row.id === droppedId)).toBe(false);

    const model = await getFacilityAttention({
      organizationId: orgId,
      userId: user,
      facilityId: facility,
      role: "viewer",
      filter: "warning",
    });
    expect(model.status).toBe("ready");
    if (model.status !== "ready") return;
    expect(model.truncated).toBe(true);
    expect(model.totalSignals).toBe(ATTENTION_EVENT_LIMIT + 1);
    expect(model.items.some((item) => item.summary === "Dropped older id")).toBe(false);
  });
});

describe("attention severity before the window", () => {
  const suffix = randomUUID().slice(0, 8);
  const orgId = randomUUID();
  const user = randomUUID();
  const facility = randomUUID();
  const area = randomUUID();
  const oldest = new Date("2026-01-01T00:00:00.000Z");
  const day = 24 * 60 * 60 * 1000;

  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values({
      id: user,
      email: `severity-${suffix}@attention.test`,
      name: "Severity",
    });
    await db.insert(organizations).values({
      id: orgId,
      name: "Attention severity",
      slug: `attention-severity-${suffix}`,
    });
    await db.insert(organizationMembers).values({
      organizationId: orgId,
      userId: user,
      role: "viewer",
    });
    await db.insert(facilities).values({
      id: facility,
      organizationId: orgId,
      name: "Severity plant",
      facilityType: "plant",
    });
    await db.insert(facilityAreas).values({
      id: area,
      organizationId: orgId,
      facilityId: facility,
      name: "Severity aisle",
      areaType: "aisle",
    });
    await db.insert(assetEvents).values([
      ...Array.from({ length: ATTENTION_EVENT_LIMIT }, (_, index) => ({
        organizationId: orgId,
        facilityId: facility,
        areaId: area,
        eventType: "alert" as const,
        severity: "warning" as const,
        description: `Newer warning ${index + 1}`,
        occurredAt: new Date(oldest.getTime() + (index + 1) * day),
      })),
      {
        organizationId: orgId,
        facilityId: facility,
        areaId: area,
        eventType: "capacity" as const,
        severity: "critical" as const,
        description: "Older critical",
        occurredAt: oldest,
      },
    ]);
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(organizations).where(eq(organizations.id, orgId));
    await db.delete(users).where(eq(users.id, user));
  });

  it("still returns an older critical alert when that severity is selected", async () => {
    const mixed = await listFacilityAttentionEvents(orgId, user, facility, "all");
    expect(mixed.data).toHaveLength(ATTENTION_EVENT_LIMIT);
    expect(mixed.total).toBe(ATTENTION_EVENT_LIMIT + 1);
    expect(mixed.data.some((row) => row.summary === "Older critical")).toBe(false);

    const critical = await getFacilityAttention({
      organizationId: orgId,
      userId: user,
      facilityId: facility,
      role: "viewer",
      filter: "critical",
    });
    expect(critical.status).toBe("ready");
    if (critical.status !== "ready") return;
    expect(critical.items.map((item) => item.summary)).toEqual(["Older critical"]);
    expect(critical.totalSignals).toBe(1);
    expect(critical.truncated).toBe(false);
  });
});

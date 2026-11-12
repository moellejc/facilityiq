import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { getDb } from "@/db";
import {
  auditLogs,
  facilities,
  facilityAreas,
  organizationMembers,
  organizations,
  users,
} from "@/db/schema";
import { AppError } from "@/lib/errors";
import type { Role } from "@/lib/permissions";
import {
  createFacilityRecord,
  readFacilityRecord,
  removeFacilityRecord,
  updateFacilityRecord,
} from "@/server/services/facility-service";
import {
  createIntegrationRecord,
  listIntegrationRecords,
  removeIntegrationRecord,
  updateIntegrationRecord,
} from "@/server/services/integration-service";
import {
  addOrganizationMember,
  changeMemberRole,
  listOrganizationMembers,
  removeOrganizationMember,
} from "@/server/services/organization-service";
import type { RequestContext } from "@/server/services/context";

const suffix = randomUUID().slice(0, 8);
const orgA = randomUUID();
const orgB = randomUUID();
const adminA = randomUUID();
const viewerA = randomUUID();
const opsA = randomUUID();
const adminB = randomUUID();
const facilityB = randomUUID();

function context(userId: string, organizationId: string, role: Role): RequestContext {
  return {
    userId,
    email: "person@admin.test",
    name: "Person",
    organizationId,
    organizationName: "Admin Org",
    organizationSlug: "admin-org",
    role,
    facilityId: null,
    memberships: [],
    facilities: [],
  };
}

describe("admin panel services", () => {
  beforeAll(async () => {
    const db = getDb();
    await db.insert(users).values([
      { id: adminA, email: `admin-a-${suffix}@admin.test`, name: "Admin A" },
      { id: viewerA, email: `viewer-a-${suffix}@admin.test`, name: "Viewer A" },
      { id: opsA, email: `ops-a-${suffix}@admin.test`, name: "Ops A" },
      { id: adminB, email: `Admin-B-${suffix}@admin.test`, name: "Admin B" },
    ]);
    await db.insert(organizations).values([
      { id: orgA, name: "Admin A Org", slug: `admin-a-${suffix}` },
      { id: orgB, name: "Admin B Org", slug: `admin-b-${suffix}` },
    ]);
    await db.insert(organizationMembers).values([
      { organizationId: orgA, userId: adminA, role: "org_admin" },
      { organizationId: orgA, userId: viewerA, role: "viewer" },
      { organizationId: orgA, userId: opsA, role: "operations_manager" },
      { organizationId: orgB, userId: adminB, role: "org_admin" },
    ]);
    await db.insert(facilities).values({
      id: facilityB,
      organizationId: orgB,
      name: "Hidden plant",
      facilityType: "plant",
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.delete(organizations).where(eq(organizations.id, orgA));
    await db.delete(organizations).where(eq(organizations.id, orgB));
    await db.delete(users).where(eq(users.id, adminA));
    await db.delete(users).where(eq(users.id, viewerA));
    await db.delete(users).where(eq(users.id, opsA));
    await db.delete(users).where(eq(users.id, adminB));
  });

  it("denies facility, member, and integration changes to non-admins", async () => {
    const viewer = context(viewerA, orgA, "viewer");
    const ops = context(opsA, orgA, "operations_manager");

    await expect(
      createFacilityRecord(viewer, { name: "Blocked", facilityType: "warehouse" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(
      updateFacilityRecord(ops, facilityB, { name: "Renamed from ops" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(removeFacilityRecord(viewer, facilityB)).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    await expect(
      addOrganizationMember(viewer, { email: `admin-b-${suffix}@admin.test`, role: "viewer" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(
      changeMemberRole(ops, { memberId: randomUUID(), role: "viewer" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
    await expect(
      removeOrganizationMember(viewer, { memberId: randomUUID() }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    await expect(listIntegrationRecords(viewer, { page: 1, limit: 25 })).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    await expect(
      createIntegrationRecord(ops, { name: "Blocked sync", provider: "sap" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });
  });

  it("creates, updates, and removes a facility inside the active organization", async () => {
    const admin = context(adminA, orgA, "org_admin");
    const created = await createFacilityRecord(admin, {
      name: `North ${suffix}`,
      location: "  ",
      facilityType: "distribution_center",
      squareFootage: "1500.25",
      timezone: "America/Denver",
    });
    expect(created.data.location).toBeNull();
    expect(created.data.squareFootage).toBe("1500.25");

    const areaId = randomUUID();
    await getDb().insert(facilityAreas).values({
      id: areaId,
      organizationId: orgA,
      facilityId: created.data.id,
      name: "Packing",
      areaType: "packing",
    });

    const updated = await updateFacilityRecord(admin, created.data.id, {
      name: `North updated ${suffix}`,
      location: "Denver",
    });
    expect(updated.data.name).toBe(`North updated ${suffix}`);
    expect(updated.data.location).toBe("Denver");
    expect(updated.data.facilityType).toBe("distribution_center");
    expect(updated.data.timezone).toBe("America/Denver");
    expect(updated.data.squareFootage).toBe("1500.25");

    await expect(
      createFacilityRecord(admin, { name: `North updated ${suffix}`, facilityType: "plant" }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });

    await expect(updateFacilityRecord(admin, facilityB, { name: "Stolen" })).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    await expect(removeFacilityRecord(admin, facilityB)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });

    const sameNameOtherOrg = await createFacilityRecord(context(adminB, orgB, "org_admin"), {
      name: `North updated ${suffix}`,
      facilityType: "warehouse",
    });
    expect(sameNameOtherOrg.data.id).not.toBe(created.data.id);

    const removed = await removeFacilityRecord(admin, created.data.id);
    expect(removed.data.id).toBe(created.data.id);
    const [area] = await getDb()
      .select({ id: facilityAreas.id })
      .from(facilityAreas)
      .where(eq(facilityAreas.id, areaId));
    expect(area).toBeUndefined();

    const [audit] = await getDb()
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.organizationId, orgA),
          eq(auditLogs.entityId, created.data.id),
          eq(auditLogs.action, "facility.delete"),
        ),
      );
    expect(audit?.action).toBe("facility.delete");

    await removeFacilityRecord(context(adminB, orgB, "org_admin"), sameNameOtherOrg.data.id);
  });

  it("lets an admin set a street address and returns 404 for another organization", async () => {
    const admin = context(adminA, orgA, "org_admin");
    const viewer = context(viewerA, orgA, "viewer");
    const ops = context(opsA, orgA, "operations_manager");
    const created = await createFacilityRecord(admin, {
      name: `Address ${suffix}`,
      facilityType: "warehouse",
    });
    expect(created.data.address).toBeNull();

    const address = {
      street: "  4800 Harbor Avenue ",
      city: "Tacoma",
      region: "WA",
      postalCode: "98421",
      country: "United States",
    };
    await expect(updateFacilityRecord(viewer, created.data.id, { address })).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    await expect(updateFacilityRecord(ops, created.data.id, { address })).rejects.toMatchObject({
      code: "FORBIDDEN",
      status: 403,
    });
    await expect(
      updateFacilityRecord(admin, created.data.id, {
        address: { street: "4800 Harbor Avenue" },
      }),
    ).rejects.toBeInstanceOf(ZodError);

    const [unchanged] = await getDb()
      .select({ addressStreet: facilities.addressStreet })
      .from(facilities)
      .where(eq(facilities.id, created.data.id));
    expect(unchanged?.addressStreet).toBeNull();

    const saved = await updateFacilityRecord(admin, created.data.id, { address });
    expect(saved.data.address).toEqual({
      street: "4800 Harbor Avenue",
      city: "Tacoma",
      region: "WA",
      postalCode: "98421",
      country: "United States",
    });
    expect(saved.data.name).toBe(`Address ${suffix}`);

    const renamed = await updateFacilityRecord(admin, created.data.id, {
      name: `Address renamed ${suffix}`,
    });
    expect(renamed.data.address).toEqual(saved.data.address);

    const visible = await readFacilityRecord(viewer, created.data.id);
    expect(visible.data.address).toEqual(saved.data.address);

    await expect(updateFacilityRecord(admin, facilityB, { address })).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    await expect(readFacilityRecord(admin, facilityB)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
    const [hidden] = await getDb()
      .select({ addressStreet: facilities.addressStreet })
      .from(facilities)
      .where(eq(facilities.id, facilityB));
    expect(hidden?.addressStreet).toBeNull();

    const cleared = await updateFacilityRecord(admin, created.data.id, { address: null });
    expect(cleared.data.address).toBeNull();
    expect(cleared.data.name).toBe(`Address renamed ${suffix}`);

    await removeFacilityRecord(admin, created.data.id);
  });

  it("adds an existing account, blocks duplicates and the last administrator", async () => {
    const admin = context(adminA, orgA, "org_admin");
    const [adminMember] = await getDb()
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(eq(organizationMembers.organizationId, orgA), eq(organizationMembers.userId, adminA)),
      );

    await expect(
      changeMemberRole(admin, { memberId: adminMember!.id, role: "viewer" }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
    await expect(
      removeOrganizationMember(admin, { memberId: adminMember!.id }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });
    await expect(
      addOrganizationMember(admin, { email: `missing-${suffix}@admin.test`, role: "viewer" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    await expect(removeOrganizationMember(admin, { memberId: randomUUID() })).rejects.toMatchObject(
      {
        code: "NOT_FOUND",
        status: 404,
      },
    );

    const added = await addOrganizationMember(admin, {
      email: `admin-b-${suffix}@admin.test`,
      role: "operations_manager",
    });
    expect(added.email).toBe(`Admin-B-${suffix}@admin.test`);
    expect(added.role).toBe("operations_manager");

    await expect(
      addOrganizationMember(admin, { email: `ADMIN-B-${suffix}@admin.test`, role: "viewer" }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });

    const page = await listOrganizationMembers(admin, { page: 1, limit: 25 });
    expect(page.data.map((member) => member.email)).toContain(`Admin-B-${suffix}@admin.test`);
    expect(page.total).toBe(page.data.length);

    const otherOrgPage = await listOrganizationMembers(context(adminB, orgB, "org_admin"), {
      page: 1,
      limit: 25,
    });
    expect(otherOrgPage.data.map((member) => member.userId)).toEqual([adminB]);
    expect(otherOrgPage.data.map((member) => member.role)).toEqual(["org_admin"]);

    const [foreignMember] = await getDb()
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(eq(organizationMembers.organizationId, orgB), eq(organizationMembers.userId, adminB)),
      );
    await expect(
      removeOrganizationMember(admin, { memberId: foreignMember!.id }),
    ).rejects.toBeInstanceOf(AppError);
    await expect(
      removeOrganizationMember(admin, { memberId: foreignMember!.id }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    await removeOrganizationMember(admin, { memberId: added.memberId });
    const after = await listOrganizationMembers(admin, { page: 1, limit: 25 });
    expect(after.data.map((member) => member.userId)).not.toContain(adminB);
  });

  it("records, updates, and isolates integration rows without storing secrets", async () => {
    const admin = context(adminA, orgA, "org_admin");
    const created = await createIntegrationRecord(admin, {
      name: `SAP ${suffix}`,
      provider: "sap",
      externalReference: "PLANT-01",
    });
    expect(created.data).toMatchObject({
      name: `SAP ${suffix}`,
      provider: "sap",
      status: "active",
      externalReference: "PLANT-01",
    });
    expect(created.data).not.toHaveProperty("secret");

    const updated = await updateIntegrationRecord(admin, created.data.id, { status: "disabled" });
    expect(updated.data.status).toBe("disabled");
    expect(updated.data.externalReference).toBe("PLANT-01");

    await expect(
      createIntegrationRecord(admin, { name: `SAP ${suffix}`, provider: "custom" }),
    ).rejects.toMatchObject({ code: "CONFLICT", status: 409 });

    const listed = await listIntegrationRecords(admin, { page: 1, limit: 25 });
    expect(listed.data.map((row) => row.id)).toEqual([created.data.id]);
    expect(listed.total).toBe(1);

    const hidden = await listIntegrationRecords(context(adminB, orgB, "org_admin"), {
      page: 1,
      limit: 25,
    });
    expect(hidden.data.map((row) => row.id)).not.toContain(created.data.id);

    await expect(
      updateIntegrationRecord(admin, randomUUID(), { name: "Missing" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    await expect(
      removeIntegrationRecord(context(adminB, orgB, "org_admin"), created.data.id),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });

    const removed = await removeIntegrationRecord(admin, created.data.id);
    expect(removed.data.id).toBe(created.data.id);
    const after = await listIntegrationRecords(admin, { page: 1, limit: 25 });
    expect(after.data.map((row) => row.id)).not.toContain(created.data.id);
  });
});

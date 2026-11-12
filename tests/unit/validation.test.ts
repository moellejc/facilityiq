import { describe, expect, it } from "vitest";

import {
  facilityCreateSchema,
  facilityUpdateSchema,
  integrationCreateSchema,
  loginSchema,
  memberAddSchema,
  paginationSchema,
} from "@/lib/validation";

describe("request schemas", () => {
  it("accepts a demo login", () => {
    expect(
      loginSchema.parse({ email: "Admin@acme.example", password: "FacilityIQ-demo-2026" }).email,
    ).toBe("admin@acme.example");
  });

  it("rejects a short password and an oversized page", () => {
    expect(loginSchema.safeParse({ email: "a@acme.example", password: "short" }).success).toBe(
      false,
    );
    expect(() => paginationSchema.parse({ page: "1", limit: "500" })).toThrow();
  });

  it("caps default pagination", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 25, order: "asc" });
  });

  it("accepts a facility with optional location and square footage", () => {
    expect(
      facilityCreateSchema.parse({
        name: "  North Plant  ",
        location: "",
        squareFootage: "1200.5",
        timezone: "America/Chicago",
      }),
    ).toMatchObject({
      name: "North Plant",
      location: null,
      facilityType: "warehouse",
      squareFootage: "1200.5",
      timezone: "America/Chicago",
    });
  });

  it("rejects an invalid facility update", () => {
    expect(facilityUpdateSchema.safeParse({}).success).toBe(false);
    expect(facilityUpdateSchema.safeParse({ squareFootage: "-4" }).success).toBe(false);
    expect(facilityUpdateSchema.safeParse({ squareFootage: "10.555" }).success).toBe(false);
    expect(facilityCreateSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("accepts an integration record without a reference", () => {
    expect(
      integrationCreateSchema.parse({
        name: " SAP plant ",
        provider: "sap",
        externalReference: "  ",
      }),
    ).toEqual({
      name: "SAP plant",
      provider: "sap",
      status: "active",
      externalReference: null,
    });
    expect(memberAddSchema.parse({ email: "Person@Acme.Example", role: "viewer" }).email).toBe(
      "person@acme.example",
    );
  });
});

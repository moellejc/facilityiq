import { describe, expect, it } from "vitest";

import {
  facilityAddressSchema,
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

  it("accepts a complete street address and trims each line", () => {
    expect(
      facilityAddressSchema.parse({
        street: "  4800 Harbor Avenue  ",
        city: " Tacoma ",
        region: " WA ",
        postalCode: " 98421 ",
        country: " United States ",
      }),
    ).toEqual({
      street: "4800 Harbor Avenue",
      city: "Tacoma",
      region: "WA",
      postalCode: "98421",
      country: "United States",
    });
  });

  it("rejects a partial, blank, or oversized street address", () => {
    expect(facilityAddressSchema.safeParse({ street: "4800 Harbor Avenue" }).success).toBe(false);
    expect(
      facilityUpdateSchema.safeParse({
        address: {
          street: "   ",
          city: "Tacoma",
          region: "WA",
          postalCode: "98421",
          country: "United States",
        },
      }).success,
    ).toBe(false);
    expect(
      facilityCreateSchema.safeParse({
        name: "North Plant",
        address: {
          street: "4800 Harbor Avenue",
          city: "Tacoma",
          region: "WA",
          postalCode: "123456789012345678901",
          country: "United States",
        },
      }).success,
    ).toBe(false);
    const blankStreet = facilityAddressSchema.safeParse({
      street: " ",
      city: "Tacoma",
      region: "WA",
      postalCode: "98421",
      country: "United States",
    });
    expect(blankStreet.success).toBe(false);
    if (!blankStreet.success) {
      expect(
        blankStreet.error.issues.some((issue) => issue.message === "Street is required."),
      ).toBe(true);
    }
  });

  it("allows an address to be omitted or cleared without changing other facility fields", () => {
    expect(facilityCreateSchema.parse({ name: "North Plant" }).address).toBeUndefined();
    expect(facilityUpdateSchema.parse({ address: null })).toEqual({ address: null });
    expect(facilityUpdateSchema.parse({ name: "North Plant" }).address).toBeUndefined();
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

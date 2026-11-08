import { describe, expect, it } from "vitest";

import { loginSchema, paginationSchema } from "@/lib/validation";

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
});

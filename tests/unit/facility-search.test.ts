import { describe, expect, it } from "vitest";

import { searchFacilitiesByName } from "@/server/services/facility-service";
import type { RequestContext, ShellFacility } from "@/server/services/context";

function facility(
  partial: Partial<ShellFacility> & Pick<ShellFacility, "id" | "name">,
): ShellFacility {
  return {
    location: null,
    facilityType: "warehouse",
    squareFootage: null,
    timezone: "America/Los_Angeles",
    ...partial,
  };
}

function context(
  facilities: ShellFacility[],
  role: RequestContext["role"] = "viewer",
): RequestContext {
  return {
    userId: "11111111-1111-4111-8111-111111111111",
    email: "viewer@acme.example",
    name: "Viewer",
    organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    organizationName: "Acme",
    organizationSlug: "acme",
    role,
    facilityId: facilities[0]?.id ?? null,
    memberships: [
      {
        memberId: "22222222-2222-4222-8222-222222222222",
        organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        name: "Acme",
        slug: "acme",
        role,
      },
    ],
    facilities,
  };
}

describe("searchFacilitiesByName", () => {
  const west = facility({
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "West Distribution Center",
    location: "Portland",
  });
  const north = facility({
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "North Plant",
  });
  const east = facility({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    name: "East Distribution Center",
  });

  it("returns paginated name matches from the session organization only", async () => {
    const result = await searchFacilitiesByName(context([west, north, east]), {
      q: "Distribution",
      limit: "1",
      page: "1",
    });
    expect(result).toEqual({
      data: [
        {
          id: east.id,
          name: east.name,
          location: east.location,
          facilityType: east.facilityType,
        },
      ],
      page: 1,
      limit: 1,
      total: 2,
    });
  });

  it("ignores a client organizationId and does not return another org's facilities", async () => {
    const otherOrgFacility = facility({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      name: "West Other Org",
    });
    const result = await searchFacilitiesByName(context([west]), {
      q: "West",
      organizationId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    });
    expect(result.total).toBe(1);
    expect(result.data.map((row) => row.id)).toEqual([west.id]);
    expect(result.data.map((row) => row.id)).not.toContain(otherOrgFacility.id);
  });

  it("rejects a query that is too short", async () => {
    await expect(searchFacilitiesByName(context([west]), { q: "W" })).rejects.toThrow();
  });
});

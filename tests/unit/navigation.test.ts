import { describe, expect, it } from "vitest";

import { ADMIN_NAV_ITEM, NAV_ITEMS, navItemsForRole } from "@/components/layout/navigation";
import { ROLES } from "@/lib/permissions";

const originalTitles = [
  "Dashboard",
  "Facilities",
  "Operations",
  "Finance",
  "Scenarios",
  "AI Insights",
  "Reports",
  "Settings",
];

describe("sidebar navigation", () => {
  it("keeps the existing items and order for every role", () => {
    expect(NAV_ITEMS.map((item) => item.title)).toEqual(originalTitles);
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      "/dashboard",
      "/facilities",
      "/operations/throughput",
      "/finance/operating-costs",
      "/scenarios",
      "/insights",
      "/reports",
      "/settings",
    ]);
    expect(NAV_ITEMS.at(-1)).toMatchObject({ title: "Settings", href: "/settings" });

    for (const role of ROLES) {
      const visible = navItemsForRole(role);
      expect(visible.slice(0, NAV_ITEMS.length).map((item) => item.title)).toEqual(originalTitles);
      expect(visible.slice(0, NAV_ITEMS.length).map((item) => item.href)).toEqual(
        NAV_ITEMS.map((item) => item.href),
      );
    }
  });

  it("appends Admin only for an organization administrator", () => {
    expect(navItemsForRole("org_admin")).toEqual([...NAV_ITEMS, ADMIN_NAV_ITEM]);
    expect(navItemsForRole("org_admin").at(-1)).toMatchObject({ title: "Admin", href: "/admin" });
    for (const role of ["operations_manager", "finance_manager", "viewer"] as const) {
      expect(navItemsForRole(role).some((item) => item.href === "/admin")).toBe(false);
      expect(navItemsForRole(role)).toHaveLength(NAV_ITEMS.length);
    }
  });
});

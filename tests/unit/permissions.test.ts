import { describe, expect, it } from "vitest";

import {
  PERMISSIONS,
  ROLES,
  canAccessAdmin,
  roleCan,
  type Permission,
  type Role,
} from "@/lib/permissions";

const expected: Record<Role, Record<Permission, boolean>> = {
  org_admin: Object.fromEntries(PERMISSIONS.map((permission) => [permission, true])) as Record<
    Permission,
    boolean
  >,
  operations_manager: {
    "members:read": true,
    "members:write": false,
    "organization:update": false,
    "settings:manage": false,
    "integrations:manage": false,
    "facilities:read": true,
    "facilities:write": false,
    "layouts:read": true,
    "layouts:write": true,
    "operations:read": true,
    "operations:write": true,
    "finance:read": true,
    "finance:write": false,
    "scenarios:read": true,
    "scenarios:write": true,
    "scenarios:review": true,
    "insights:read": true,
    "insights:write": true,
    "reports:read": true,
    "uploads:write": true,
    "twin:read": true,
  },
  finance_manager: {
    "members:read": true,
    "members:write": false,
    "organization:update": false,
    "settings:manage": false,
    "integrations:manage": false,
    "facilities:read": true,
    "facilities:write": false,
    "layouts:read": true,
    "layouts:write": false,
    "operations:read": true,
    "operations:write": false,
    "finance:read": true,
    "finance:write": true,
    "scenarios:read": true,
    "scenarios:write": false,
    "scenarios:review": true,
    "insights:read": true,
    "insights:write": false,
    "reports:read": true,
    "uploads:write": false,
    "twin:read": true,
  },
  viewer: {
    "members:read": true,
    "members:write": false,
    "organization:update": false,
    "settings:manage": false,
    "integrations:manage": false,
    "facilities:read": true,
    "facilities:write": false,
    "layouts:read": true,
    "layouts:write": false,
    "operations:read": true,
    "operations:write": false,
    "finance:read": true,
    "finance:write": false,
    "scenarios:read": true,
    "scenarios:write": false,
    "scenarios:review": false,
    "insights:read": true,
    "insights:write": false,
    "reports:read": true,
    "uploads:write": false,
    "twin:read": true,
  },
};

describe("role permissions", () => {
  it("covers every role and every permission", () => {
    expect(ROLES).toEqual(["org_admin", "operations_manager", "finance_manager", "viewer"]);
    for (const role of ROLES) {
      for (const permission of PERMISSIONS) {
        expect(roleCan(role, permission), `${role} ${permission}`).toBe(expected[role][permission]);
      }
    }
  });

  it("keeps the viewer from every mutation", () => {
    const writes = PERMISSIONS.filter(
      (permission) =>
        permission.endsWith(":write") ||
        permission.endsWith(":update") ||
        permission.endsWith(":manage"),
    );
    for (const permission of writes) {
      expect(roleCan("viewer", permission)).toBe(false);
    }
    expect(roleCan("viewer", "scenarios:review")).toBe(false);
  });

  it("opens the admin panel only for organization administrators", () => {
    expect(canAccessAdmin("org_admin")).toBe(true);
    expect(canAccessAdmin("operations_manager")).toBe(false);
    expect(canAccessAdmin("finance_manager")).toBe(false);
    expect(canAccessAdmin("viewer")).toBe(false);
  });
});

import { AppError } from "@/lib/errors";

export const ROLES = ["org_admin", "operations_manager", "finance_manager", "viewer"] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "members:read",
  "members:write",
  "organization:update",
  "settings:manage",
  "integrations:manage",
  "facilities:read",
  "facilities:write",
  "layouts:read",
  "layouts:write",
  "operations:read",
  "operations:write",
  "finance:read",
  "finance:write",
  "scenarios:read",
  "scenarios:write",
  "scenarios:review",
  "insights:read",
  "insights:write",
  "reports:read",
  "uploads:write",
  "twin:read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL_READ: Permission[] = [
  "members:read",
  "facilities:read",
  "layouts:read",
  "operations:read",
  "finance:read",
  "scenarios:read",
  "insights:read",
  "reports:read",
  "twin:read",
];

/**
 * Role is stored on organization membership, never on the user.
 * Viewer is read-only. Mutations are denied even if the UI hides them.
 * Finance reviews scenarios. Operations creates and runs them.
 */
const MATRIX: Record<Role, readonly Permission[]> = {
  org_admin: PERMISSIONS,
  operations_manager: [
    ...ALL_READ,
    "layouts:write",
    "operations:write",
    "scenarios:write",
    "scenarios:review",
    "insights:write",
    "uploads:write",
  ],
  finance_manager: [...ALL_READ, "finance:write", "scenarios:review"],
  viewer: ALL_READ,
};

const granted = new Map<Role, Set<Permission>>(ROLES.map((role) => [role, new Set(MATRIX[role])]));

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function roleCan(role: Role, permission: Permission): boolean {
  return granted.get(role)?.has(permission) ?? false;
}

export function assertRole(role: Role, permission: Permission) {
  if (!roleCan(role, permission)) {
    throw new AppError("FORBIDDEN", "You do not have permission to do that.", 403);
  }
}

export function permissionsFor(role: Role): Permission[] {
  return PERMISSIONS.filter((permission) => roleCan(role, permission));
}

export const ROLE_LABELS: Record<Role, string> = {
  org_admin: "Organization administrator",
  operations_manager: "Operations manager",
  finance_manager: "Finance manager",
  viewer: "Viewer",
};

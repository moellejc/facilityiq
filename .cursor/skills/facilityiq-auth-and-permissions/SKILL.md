---
name: facilityiq-auth-and-permissions
description: FacilityIQ authentication and authorization standards — Auth.js v5 database sessions, password hashing, request context and active org/facility resolution, role/permission matrix, assertRole/roleCan, finance gating, viewer read-only, rate limiting, and audit logging. Use when touching src/lib/auth, src/lib/permissions, src/server/services/context.ts, src/proxy.ts, sign-in, sessions, roles, or any permission check.
---

# Auth and Permissions (FacilityIQ)

Source: Notion Coding Conventions §6, SDLC §6. This area is **security-sensitive** — also run `facilityiq-security-review`.

## Authentication

- Auth.js v5 (`next-auth` beta) + Drizzle adapter, credentials provider, **database sessions** (revocable). Config in `src/lib/auth`.
- Passwords hashed with Argon2id (`@node-rs/argon2`, `src/lib/auth/password.ts`). Demo passwords exist only for seeded users and are documented in `README.md`.
- `src/proxy.ts` redirects/401s unauthenticated requests except `/`, `/sign-in`, `/api/auth/*`, `/api/health`. It only checks cookie presence — **it is not authorization**.
- Rate-limit auth and upload routes (`src/lib/rate-limit.ts`).

## Request context

`requireRequestContext()` (`src/server/services/context.ts`, `React.cache`-deduped per request) resolves the session user, memberships, active org (`ORG_COOKIE`), role, and active facility (`FACILITY_COOKIE`).

- **Never trust a client-supplied `organizationId`.** It's a selection request; membership from `organization_members` is the proof.
- Active facility is re-checked against the active org on every request.
- Role is per `organization_members` row, never global on `users`.

## Permissions (`src/lib/permissions/index.ts`)

| Role                 | Grants                                                                                                                    |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `org_admin`          | All permissions                                                                                                           |
| `operations_manager` | All reads + `layouts:write`, `operations:write`, `scenarios:write`, `scenarios:review`, `insights:write`, `uploads:write` |
| `finance_manager`    | Financial dashboards, cost/ROI, scenario review                                                                           |
| `viewer`             | Reads only — **no mutations**, including layouts and scenarios                                                            |

Check the file for the exact matrix before relying on it.

- Use `assertRole(role, permission)` at the start of every service function; `roleCan` for conditional DTO fields.
- Add a new permission to `PERMISSIONS` and the `MATRIX` rather than checking role names directly.
- **Finance gating:** check `finance:read` before including cost/ROI in a DTO, heatmap, or cache entry. Hiding a chart is not protection.
- Hiding a button is not authorization; the service must reject.

## Audit logging

Write to `audit_logs` for administrative changes: members, roles, settings, layout restores. Same transaction as the change.

## Tests (required)

- Unit: role × permission matrix (`tests/unit/permissions.test.ts`).
- Integration/service-level: viewer cannot mutate (layout save, scenario create/run/delete); roles without `finance:read` never receive cost fields; non-member `organizationId` rejected; revoked membership denied on next request.

---
name: facilityiq-multi-tenancy-rls
description: FacilityIQ multi-tenant data isolation — repository organizationId scoping, nested resource joins, withTenant transaction-local settings, PostgreSQL row-level security policies, database roles (app, worker, migrate), and pooled-connection safety. Use when writing or reviewing src/server/repositories, src/db/tenant.ts, RLS policies, or any query touching tenant-owned data.
---

# Multi-Tenancy and RLS (FacilityIQ)

Source: Notion Coding Conventions §7, §14; Unit Test Standards §2, §7. **Security-critical** — a mistake here leaks one customer's data to another. Also run `facilityiq-security-review`.

## Two layers, both required

1. **Explicit org filters** in every repository query (primary defense).
2. **PostgreSQL RLS** keyed on `app.current_org_id()` (defense in depth). RLS never replaces explicit filters.

## Repository pattern

Follow `src/server/repositories/scenarios.ts`:

```ts
export async function getFacilityScenario(organizationId: string, userId: string, scenarioId: string) {
  return withTenant({ organizationId, userId }, async (tx) => {
    const [scenario] = await tx.select().from(scenarios)
      .where(and(eq(scenarios.organizationId, organizationId), eq(scenarios.id, scenarioId)));
    ...
  });
}
```

- First parameter is a **trusted** `organizationId` (from request context, never from the body).
- Every `select`, `update`, `delete`, `count`, and `join` includes `eq(table.organizationId, organizationId)`.
- Nested resources (facility → area → asset → file, scenario → results): constrain the child by org **and** verify it belongs to the given parent. Never load by child ID alone.
- Inside a service transaction, accept and use the passed `tx`; never open a second connection for part of the unit.
- No implicit tenant globals; no module-level "current org".

## `withTenant` (`src/db/tenant.ts`)

Opens a transaction and runs `set_config('app.current_organization_id', …, true)` (and `app.current_user_id`) — **transaction-local**, so pooled connections can't carry tenant context to the next request. All tenant queries must run inside it on the same `tx`.

## Database roles

| Role                   | Env var                | RLS                                                                    |
| ---------------------- | ---------------------- | ---------------------------------------------------------------------- |
| `facilityiq_app`       | `DATABASE_URL`         | Enforced (NOBYPASSRLS) — the app must use this                         |
| `facilityiq_worker`    | `DATABASE_URL_WORKER`  | BYPASSRLS (dequeues across orgs) → explicit filters are the only guard |
| `facilityiq` superuser | `DATABASE_MIGRATE_URL` | Bypasses — migrations and seed only                                    |

Roles and helper functions (`app.current_org_id()`, `app.current_user_id()`, `app.assert_facility_org()`) are defined in `src/db/migrations/0001_rls.sql`.

## New tenant table

Enable RLS and add policies using `app.current_org_id()` in a **new** migration, mirroring existing policies in `0001_rls.sql`. Add parent-org consistency triggers where a child references a facility.

## Required tests (`tests/integration`)

- `isolation.test.ts` pattern: create org A and B; assert A can't list, count, get, update, or delete B's facilities/areas/assets/scenarios/files — including via nested routes.
- `rls.test.ts` pattern: connect as the actual app role; without the setting, rows are invisible; sequential different-tenant operations on pooled connections don't leak.
- Every new repository function gets a cross-org case.

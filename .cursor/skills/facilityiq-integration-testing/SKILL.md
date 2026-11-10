---
name: facilityiq-integration-testing
description: FacilityIQ PostgreSQL integration test standards — local test database setup, global migration setup, org isolation and nested-resource tests, RLS and pooled-connection tests, referential integrity, migration apply, seed idempotence, route contracts, atomicity and retry tests. Use when writing or running tests in tests/integration, or when a change touches repositories, RLS, migrations, seed, transactions, or API contracts.
---

# Integration Testing (FacilityIQ)

Source: Notion Unit Test Standards §2, §4, §7; CI Process §2.

> **Never claim tests passed unless they ran.** If Postgres isn't available, say "not run" with the reason.

## Setup

- Config: `vitest.integration.config.ts` — `tests/integration/**/*.test.ts`, `fileParallelism: false`, 120s timeouts, env pinned to `DATABASE_URL_TEST` (default `postgres://facilityiq:facilityiq_dev@localhost:5432/facilityiq_test`).
- `tests/integration/global-setup.ts` runs `drizzle-kit migrate` against the test DB first.
- Need PostgreSQL 16 with the `facilityiq` superuser and `facilityiq_test` database — see `README.md` (local psql) or run `docker compose up postgres` and create the DB.
- Run: `pnpm db:migrate && pnpm test:integration`.

## Required coverage

| Concern       | Existing file                                       | Must cover                                                                                                         |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Org isolation | `isolation.test.ts`                                 | Org A cannot list/count/get/update/delete org B's facilities, areas, assets, scenarios, files — incl. nested paths |
| RLS           | `rls.test.ts`                                       | Actual app role; transaction-local org setting; pooled connections don't retain prior tenant                       |
| Integrity     | `integrity.test.ts`                                 | FKs, cascades, unique constraints                                                                                  |
| Seed          | `seed.test.ts`                                      | Seed twice → identical data, no duplicates                                                                         |
| Domain flows  | `analytics`, `insights`, `scenarios`, `scene` tests | Service behavior against real data                                                                                 |

## Boundary regressions (when the boundary changes)

- **Route contract:** missing session, forbidden role, malformed JSON, invalid IDs/query/body, safe `{ error: { code, message } }`, no SQL/stack leakage.
- **Lists:** page/limit bounds, max 100, filter/sort allowlist, stable order, scoped filtered `total`.
- **Finance:** roles without `finance:read` never get cost fields; viewer direct API mutations rejected.
- **Atomicity:** inject a failure mid multi-table write → full rollback.
- **Retries:** concurrent same-key requests → one durable result; same key + different payload → 409; stale layout version → 409.
- **Worker:** handler scoped by job org; retry idempotent.

## Writing tests

- Create isolated orgs/users with `randomUUID()` and a unique suffix (see `isolation.test.ts`), or use the deterministic seed. Clean up in `afterAll` or use isolated transactions.
- Call services/repositories directly to prove server enforcement.
- Name by behavior; no cross-test ordering dependencies.
- Bug fixes: regression fails before the fix.

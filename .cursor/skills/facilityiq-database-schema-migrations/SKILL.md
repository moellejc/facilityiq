---
name: facilityiq-database-schema-migrations
description: FacilityIQ PostgreSQL 16 schema and migration standards with Drizzle ORM and Drizzle Kit — table/enum/relation files, data type conventions (UUID, timestamptz, numeric money, JSONB), indexes and foreign keys, generating append-only versioned migrations, and verification. Use when changing src/db/schema, creating migrations in src/db/migrations, adding tables, columns, enums, or indexes.
---

# Database Schema and Migrations (FacilityIQ)

Source: Notion Coding Conventions §4, SDLC §2–3, CI §2.

## Files

- `src/db/schema/tables.ts` — `pgTable` definitions
- `src/db/schema/enums.ts` — `pgEnum`s
- `src/db/schema/relations.ts` — Drizzle relations (defined alongside tables)
- `src/db/schema/index.ts` — re-exports
- `src/db/migrations/*.sql` + `meta/` — versioned SQL (`0000_init.sql`, `0001_rls.sql`, …)
- `drizzle.config.ts` — Drizzle Kit config (uses `DATABASE_MIGRATE_URL`)

## The migration rule

**Never edit, rename, reorder, or delete an applied migration.** Every schema change is a **new** migration:

```bash
# 1. edit src/db/schema/*.ts
pnpm db:generate     # drizzle-kit generate → new src/db/migrations/NNNN_*.sql
# 2. review the generated SQL; hand-add RLS policies/triggers/data backfills if needed
pnpm db:migrate      # apply locally
```

`src/db/migrations` is in `.prettierignore` — don't reformat it.

## Data conventions

| Concern          | Convention                                                                     |
| ---------------- | ------------------------------------------------------------------------------ |
| Primary keys     | `uuid` with `gen_random_uuid()` default                                        |
| Timestamps       | `timestamptz`, stored UTC (`created_at`, `updated_at`)                         |
| Money amounts    | `numeric(15,2)` + ISO `currency` defaulting to `USD` — never float             |
| Rates            | `numeric(18,4)`                                                                |
| Extension data   | JSONB: `metadata`, `layout_data`, scenario `configuration`, insight `evidence` |
| Tenant ownership | `organization_id uuid not null` FK on every tenant-owned table                 |

- Foreign keys with deliberate `onDelete` behavior; unique constraints for invariants (e.g. `(organization_id, user_id)` on members; global unique org `slug`).
- Indexes for access paths: `(organization_id, recorded_at)` on metrics, `(facility_id)` on areas/assets, plus any new filter/sort column.
- Idempotency keys get a unique constraint scoped by org + operation.

## New tenant table checklist

- [ ] `organization_id` column + FK + index
- [ ] RLS enabled with policy keyed on `app.current_org_id()` — see `facilityiq-multi-tenancy-rls`
- [ ] Parent-child org consistency (e.g. facility trigger `app.assert_facility_org()` pattern in `0001_rls.sql`)
- [ ] Grants for `facilityiq_app` / `facilityiq_worker` roles as needed
- [ ] Relations in `relations.ts`
- [ ] Repository functions taking `organizationId`
- [ ] Seed updated if the demo story needs it (`facilityiq-seed-data`)
- [ ] `docs/ARCHITECTURE.md` data model updated

## Changing existing data

Backfills go in a new migration (or a documented one-off script). Consider existing rows, nullability transitions (add nullable → backfill → set not null), and lock impact on large tables.

## Verify

- Migrations apply to an **empty** PostgreSQL 16 DB (the integration global setup does this) and to a representative existing schema.
- `pnpm db:seed` still runs twice with identical results.
- `pnpm test:integration` passes (integrity, isolation, RLS, seed tests).

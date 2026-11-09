---
name: facilityiq-seed-data
description: FacilityIQ deterministic seed standards — the Acme Manufacturing / West Distribution Center demo story, deterministic UUIDs and fixed timestamps, seeded problem conditions and healthy areas, demo accounts, replace strategy, and idempotence tests. Use when editing src/db/seed, adding demo data, or changing anything the seeded dashboard, insights, or scenarios depend on.
---

# Seed Data (FacilityIQ)

Source: Notion SDLC §7, CI §5, Unit Test Standards §2. Details from `src/db/seed/` and `README.md`.

## The demo story

- Organization **Acme Manufacturing** (`acme-manufacturing`), facility **West Distribution Center**.
- Areas: receiving, aisles 01–04, packing, shipping, staging; ~598 assets; 30 days of metrics ending **2026-11-01 UTC**; alerts; six insights; three scenarios.
- Five seeded **problem conditions** plus healthy areas. Metrics, events, insights, and scenarios must all tell the **same story** — if you change a metric pattern, check that `DeterministicRulesProvider` still detects (or still ignores) it and scenarios still make sense.
- Demo accounts (`README.md`): `admin@`, `operations@`, `finance@`, `viewer@acme.example`, one shared demo password defined in `src/db/seed/ids.ts`.

## Determinism

- IDs via `deterministicUuid(name)` (`src/db/seed/ids.ts`) — stable across runs. Never `randomUUID()` or `gen_random_uuid()` for seeded rows.
- Fixed times: `PERIOD_END`, `SEEDED_AT`. Never `new Date()` / `now()`.
- No randomness unless from a fixed-seed PRNG.
- Password hashes are salted (not byte-identical) — that's the documented exception.

## Strategy

- The seed **replaces** Acme Manufacturing (delete then insert) — documented in `README.md`. Keep that documentation accurate if the strategy changes.
- Runs with `DATABASE_MIGRATE_URL` (superuser, bypasses RLS). Compose runs it on boot when `SEED_ON_BOOT=true`.
- Batch inserts inside a transaction.

## Commands

```bash
pnpm db:migrate
pnpm db:seed   # run twice to confirm idempotence
```

## Tests

`tests/integration/seed.test.ts` must pass: running the seed twice yields the same data with no duplicates. Update insight/scenario/analytics tests if the story changes intentionally, and update `README.md` counts.

---
name: facilityiq-unit-test-standards
description: FacilityIQ unit and integration testing standards with Vitest — formulas, permissions, Zod, org isolation, and when to run which suite. Use when adding or changing tests.
---

# FacilityIQ unit test standards

## Layout

| Suite       | Config                         | Location                         | Role                                                                                                                                   |
| ----------- | ------------------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `vitest.config.ts`             | `tests/unit/**/*.test.ts`        | Pure logic: KPIs, permissions, Zod, insight rules, scenario projections, twin view state. Node environment. No live Postgres required. |
| Integration | `vitest.integration.config.ts` | `tests/integration/**/*.test.ts` | Seed, RLS, org isolation, repositories/services against Postgres. `fileParallelism: false`. Uses `DATABASE_URL_TEST`.                  |
| E2E         | Playwright (later)             | `tests/e2e`                      | Browser smoke. Do not claim e2e coverage that was not run.                                                                             |

Run:

```bash
pnpm test:unit
pnpm test:integration
```

Do **not** claim tests passed unless those commands were executed in the change.

## What to unit test

- **Formulas:** every KPI and scenario projection kind, including `empty_period`, `missing_inputs`, and `zero_denominator`. Assert missing ≠ `0`.
- **Permissions:** matrix in `tests/unit/permissions.test.ts` style — each role × permission.
- **Zod / providers:** reject invalid insight language payloads (extra financial fields); accept valid rephrase-only payloads; no-key insight path must not call `fetch`.
- **View state:** twin reducers and selection helpers without WebGL.
- Prefer small fixtures and `deterministicUuid` / `crypto.randomUUID` for ids. Avoid depending on wall-clock “today” when the seed clock is fixed (metrics end `2026-11-01`).

## What to integration test

- Seed determinism / required problem conditions (do not break the seed fingerprint unless intentionally updating the assertion).
- Organization isolation: list/get/nested resources and insights/scenarios must not leak across orgs.
- Service mutations: insight generate, scenario create/run/duplicate/compare/delete with role checks (viewer/finance forbidden where write is required).
- Apply migrations in the integration global setup; use migrate URL for seed when needed.

## Assertions that match product rules

- Baseline blocks use basis `observed`; projected / estimate figures use `modeled` / estimate labels.
- Forbidden roles throw `AppError` with `FORBIDDEN` (or equivalent status), not silent empty success on writes.
- Heatmap / KPI absence: `undefined` / `null`, not coerced zero.

## React Testing Library / Playwright

- Prefer RTL for presentational components when behavior is non-trivial; keep business logic out of components so most coverage stays in unit tests of `src/lib` and services.
- Playwright smoke belongs in Phase 6 polish; if adding e2e, gate on a real running app and do not fake metrics in the test data path.

## Anti-patterns

- Snapshotting entire pages of invented KPIs.
- Integration tests that share mutable global org state without cleanup or reseeding.
- Skipping failure cases for division by zero or empty periods.
- Calling live LLM APIs in CI; stub `fetch` or leave `AI_API_KEY` unset.

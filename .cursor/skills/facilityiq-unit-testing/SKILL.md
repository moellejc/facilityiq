---
name: facilityiq-unit-testing
description: FacilityIQ Vitest unit test standards — required coverage for KPI formulas, permissions, Zod schemas, scenario projections, and insight rules; determinism (no network, no LLM, fixed clocks, exact decimals); behavior-based naming; and honest result reporting. Use when writing or running tests in tests/unit or testing pure logic in src/lib.
---

# Unit Testing (FacilityIQ)

Source: Notion Unit Test Standards §1–5.

> **Never claim tests passed unless they ran.** Report exact commands and results.

## Setup

- Vitest, `vitest.config.ts`, `environment: "node"`, files `tests/unit/**/*.test.ts`, `@` alias → `src`.
- Run: `pnpm test:unit` (or `pnpm exec vitest run --config vitest.config.ts tests/unit/kpis.test.ts` for one file).
- React Testing Library is in the standard stack but **not yet installed**. Adding component tests requires adding it plus a DOM environment (jsdom/happy-dom) — that's a dependency change (`facilityiq-dependency-upgrades`).

## Required coverage when touched

| Area            | Existing file                              | Must cover                                                                                                |
| --------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| KPI formulas    | `kpis.test.ts`, `analytics-phase3.test.ts` | Each formula per `docs/KPI_FORMULAS.md`; empty period, zero denominator, missing inputs → `null` + reason |
| Permissions     | `permissions.test.ts`                      | Each relevant role × permission; viewer has no write permissions                                          |
| Zod schemas     | `validation.test.ts`                       | Valid accepted; invalid rejected with expected code                                                       |
| Scenarios       | `scenarios.test.ts`                        | Known inputs → exact outputs; missing inputs → unavailable                                                |
| Insight rules   | `insights.test.ts`                         | Fires on seeded problem conditions; silent on healthy data                                                |
| Twin view logic | `twin-view.test.ts`                        | Reducer transitions, layer visibility, reset                                                              |

## Determinism

- No network, no LLM. Inject `fetchImpl` / clocks rather than mocking globals.
- Fixed time: `vi.useFakeTimers()` + `vi.setSystemTime(...)` or an injected clock.
- Exact decimal expectations for money; no `toBeCloseTo` on currency unless the formula documents rounding.
- Assert gaps produce `null` / unavailable, never `0`.

## Style

- Name by behavior: `returns null with unavailable_reason when no orders in period`.
- One behavior per test; arrange–act–assert; no ordering dependencies.
- Prefer real pure functions over mocks; don't assert internal call order.
- Bug fixes: add a test that fails without the fix and confirm it fails first.

## Reporting

```
pnpm test:unit — 7 files, 112 tests passed
```

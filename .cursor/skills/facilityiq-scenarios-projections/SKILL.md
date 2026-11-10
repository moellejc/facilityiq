---
name: facilityiq-scenarios-projections
description: FacilityIQ scenario and projection standards — deterministic projection functions in src/lib/scenarios, baseline vs projected separation, observed vs modeled basis, docs/SCENARIOS.md as the contract, scenario configuration schema, run/compare/duplicate flows, and estimate labeling. Use when adding a scenario kind, changing projection math, scenario APIs, or scenario UI.
---

# Scenarios and Projections (FacilityIQ)

Source: Notion Coding Conventions §11, SDLC §5, Unit Test Standards §2.

## Non-negotiables

- Projections are **deterministic TypeScript**. No LLM, no network, no randomness.
- `docs/SCENARIOS.md` documents every scenario formula, assumptions, and limitations. Code and doc change together.
- **Baseline (observed) and projected (estimated) are kept separate** in storage, DTOs, and UI. A projection never overwrites an observed metric.
- Estimated savings/ROI are labeled as estimates, never as verified facts.

## Where code goes

| Concern              | Location                                                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kinds and types      | `src/lib/scenarios/types.ts` (`SCENARIO_KINDS`, `ScenarioBasis = "observed" \| "modeled"`, `ScenarioFigure`, `ScenarioProjection`, `figure()`, `unavailableFigure()`) |
| Configuration schema | `src/lib/scenarios/schema.ts` (Zod; `scenarioWriteSchema`, `scenarioConfigurationSchema`)                                                                             |
| Baseline             | `src/lib/scenarios/baseline.ts`                                                                                                                                       |
| Projection math      | `src/lib/scenarios/project.ts` (`projectScenario` dispatch + `projectAddPackingStation`, `projectIncreaseConveyorCapacity`, …)                                        |
| Comparison           | `src/lib/scenarios/compare.ts`                                                                                                                                        |
| Labels               | `src/lib/scenarios/present.ts`                                                                                                                                        |
| Persistence          | `src/server/repositories/scenarios.ts` (`scenarios`, `scenario_results`)                                                                                              |
| Orchestration        | `src/server/services/scenario-service.ts`                                                                                                                             |
| Routes               | `/api/scenarios`, `/api/scenarios/[id]`, `/api/scenarios/[id]/run`, `/api/scenarios/compare`                                                                          |

## Adding a scenario kind

1. Document formula, inputs, assumptions, limitations in `docs/SCENARIOS.md`.
2. Add the kind to `SCENARIO_KINDS` and its configuration to the Zod schema.
3. Implement `projectX(baseline, config)` returning `ScenarioFigure`s with explicit `basis`; use `unavailableFigure` when inputs are missing — never invent zeros.
4. Wire into the `projectScenario` dispatch and `present.ts` labels.
5. Unit tests (`tests/unit/scenarios.test.ts`): known inputs → exact outputs, missing-input → unavailable, units/currency retained.
6. Integration test the run path (`tests/integration/scenarios.test.ts`): results stored per run with assumptions; observed metrics untouched.

## Permissions

- `scenarios:read` to view; `scenarios:write` to create/run/duplicate/delete (operations, admin); `scenarios:review` for finance review.
- Viewer cannot create, run, or delete.
- Financial projections only in DTOs for `finance:read` holders.

## Runs

- Store configuration and results; key results by scenario + run with the assumptions used.
- Running is `POST /api/scenarios/[id]/run`. If a run becomes long, move it to a job (202) with an idempotency key.
- UI shows baseline vs projected side by side, projected visually distinct (`facilityiq-charts-dataviz`). Never show a queued/optimistic run as a result.

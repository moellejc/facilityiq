---
name: facilityiq-analytics-kpis
description: FacilityIQ analytics and KPI standards — deterministic formulas in src/lib/analytics, KpiValue with null and unavailableReason, docs/KPI_FORMULAS.md as the contract, SQL aggregation in repositories, period comparison, heatmap normalization, and display helpers. Use when adding or changing a KPI, metric aggregation, analytics endpoint, dashboard figure, or heatmap calculation.
---

# Analytics and KPIs (FacilityIQ)

Source: Notion Coding Conventions §11, SDLC §5, Unit Test Standards §2–3.

## Non-negotiables

- KPIs are **deterministic TypeScript/SQL**. Never computed or adjusted by an LLM.
- `docs/KPI_FORMULAS.md` is the contract: numerator, denominator, units, aggregation, missing-data and zero-denominator behavior for every KPI. Code and doc change together.
- **Missing data is not zero.** Empty period, zero denominator, or missing inputs → `{ value: null, unit, unavailableReason }`.

## Where code goes

| Concern                        | Location                                                                                                                                |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Formulas                       | `src/lib/analytics/kpis.ts` (`throughputOrdersPerHour`, `utilizationPercent`, `costPerOrder`, `averageCycleTime`, `bottleneckCount`, …) |
| Aggregation / comparison       | `src/lib/analytics/aggregate.ts` (`AnalyticsModel`, `ComparedKpi`, `TimePoint`)                                                         |
| Periods                        | `src/lib/analytics/periods.ts`                                                                                                          |
| Heatmap normalization          | `src/lib/analytics/heatmap.ts`                                                                                                          |
| Display                        | `src/lib/analytics/display.ts`                                                                                                          |
| SQL loading                    | `src/server/repositories/analytics.ts` (org-scoped)                                                                                     |
| Orchestration + finance gating | `src/server/services/analytics-service.ts`                                                                                              |

## `KpiValue`

```ts
type UnavailableReason = "empty_period" | "zero_denominator" | "missing_inputs";
type KpiValue = { value: number | null; unit: string; unavailableReason: UnavailableReason | null };
```

Use the module-private `available(value, unit)` / `unavailable(unit, reason)` constructors and `isMissing()` in `kpis.ts`; add a new reason to the union (and `unavailableLabel`) rather than overloading an existing one.

## Adding a KPI

1. Define it in `docs/KPI_FORMULAS.md` first.
2. Pure function in `kpis.ts` with explicit inputs, returning `KpiValue`.
3. Repository query loads samples (org + facility + date range scoped); aggregation in SQL where it reduces data volume.
4. Service wires it in; cost-based KPIs only with `finance:read`.
5. Display via `formatKpiValue` / `KpiCard`.
6. Unit tests (`tests/unit/kpis.test.ts` pattern): known inputs → exact outputs, empty period, zero denominator, missing inputs, null samples ignored not zeroed.

## Rules

- Money uses `numeric` in storage; preserve precision through DTO serialization; tests assert exact decimals.
- Timestamps in UTC; period boundaries explicit and documented.
- Heatmaps use server-normalized values with thresholds; missing samples → no-data, not zero.
- Observed metrics are never overwritten by projections.
- Show data freshness where relevant.

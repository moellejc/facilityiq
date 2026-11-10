---
name: facilityiq-bug-fixing
description: Workflow for diagnosing and fixing FacilityIQ bugs — reproduce, classify severity, trace to the owning layer and its domain skill, write a failing regression test first, fix minimally, and report verified results. Use when fixing a bug, defect, regression, failing test, incorrect KPI, data leak, or error report in FacilityIQ.
---

# Bug Fixing (FacilityIQ)

Source: Notion SDLC Best Practices §2–4, §6; Unit Test Standards §7.

## Workflow

```
Bug fix progress:
- [ ] 1. Reproduce; expected vs actual
- [ ] 2. Classify severity
- [ ] 3. Trace to the owning layer; load its skill
- [ ] 4. Regression test that fails
- [ ] 5. Minimal fix at the owning layer
- [ ] 6. Verify
- [ ] 7. Side effects: data, migrations, docs, same pattern elsewhere
- [ ] 8. facilityiq-pr-readiness
```

**1. Reproduce.** Exact steps, role, org, facility, inputs; expected vs actual. Use the seeded demo and demo accounts (`README.md`). If you can't reproduce, say so — don't guess-fix.

**2. Classify.** Treat as **high severity** and run `facilityiq-security-review` if it involves: cross-tenant exposure or RLS leakage; authorization bypass (viewer mutation, finance fields without `finance:read`); wrong money/KPI/projection values or missing data shown as `0`; secrets or internal errors reaching the client.

**3. Trace to the owning layer** (route → service → repository → schema / pure lib) and load that skill:

| Symptom                    | Likely owner                                                       | Skill                                                           |
| -------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------- |
| Wrong number               | `src/lib/analytics` / `src/lib/scenarios` / repository aggregation | `facilityiq-analytics-kpis`, `facilityiq-scenarios-projections` |
| Permission wrong           | Service entry / `src/lib/permissions`                              | `facilityiq-auth-and-permissions`                               |
| Cross-tenant data          | Repository scoping / `withTenant` / RLS                            | `facilityiq-multi-tenancy-rls`                                  |
| Bad status or error body   | Adapter / `toErrorResponse`                                        | `facilityiq-api-routes`                                         |
| Partial write / duplicates | Service transaction / idempotency                                  | `facilityiq-services-and-domain-logic`                          |
| Stale UI after switch      | Query keys / state owner                                           | `facilityiq-client-state-and-caching`                           |
| Blank or broken view       | Missing data state                                                 | `facilityiq-ui-states-and-forms`                                |
| 3D leak, wrong heatmap     | Disposal / normalization                                           | `facilityiq-3d-digital-twin`                                    |
| Wrong insight              | Rule thresholds / evidence                                         | `facilityiq-insights-ai`                                        |
| Bad seed data              | `src/db/seed`                                                      | `facilityiq-seed-data`                                          |
| Job stuck/duplicated       | Worker handler                                                     | `facilityiq-background-worker`                                  |

Fix where the responsibility lives, not where the symptom shows.

**4. Regression first.** Behavior-named test at the right level (unit for pure logic/permissions; integration for tenancy, RLS, transactions; Playwright for browser/3D). Run it and confirm it fails for the right reason.

**5. Fix minimally.** No unrelated refactors, renames, or formatting. Note design problems as follow-ups.

**6. Verify.** New test passes; relevant suites, `pnpm typecheck`, `pnpm lint` pass.

**7. Side effects.**

- Schema fix → new migration; consider backfilling existing rows.
- Seed caused it → fix seed, keep deterministic.
- Formula/doc ambiguity → update `docs/KPI_FORMULAS.md` / `docs/SCENARIOS.md` / `docs/ARCHITECTURE.md`.
- Search for the same pattern elsewhere (e.g. other repositories missing the same org join); fix or list them.

**8. Gate.** `facilityiq-pr-readiness`. PR includes repro steps, root cause, the regression test, and evidence it failed before the fix.

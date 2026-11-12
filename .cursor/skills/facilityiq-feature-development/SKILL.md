---
name: facilityiq-feature-development
description: Workflow for implementing a new FacilityIQ feature as a production-oriented vertical slice, routing to the right domain skills for each layer (database, API, services, UI, 3D, analytics, tests). Use when adding a feature, endpoint, page, dashboard panel, KPI, scenario type, insight rule, job, or 3D capability to FacilityIQ.
---

# Feature Development (FacilityIQ)

Source: Notion SDLC Best Practices §1–3, §5.

## Principles

- **Vertical slices:** schema, service, API, UI, and tests together. No mockups, placeholders, or hardcoded KPI numbers.
- Respect the phase order in `docs/ARCHITECTURE.md`: Foundation → 3D viewer → Analytics → AI insights → Scenarios → Production readiness. Unbuilt pages are `ComingNext` shells, never fake data.
- One concern per PR. Agree substantial new scope with the user before implementing.

## Workflow

```
Feature progress:
- [ ] 1. Scope and acceptance criteria
- [ ] 2. Load the domain skills for each layer touched
- [ ] 3. Design the slice
- [ ] 4. Implement bottom-up
- [ ] 5. Test
- [ ] 6. Update docs
- [ ] 7. facilityiq-pr-readiness
```

**1. Scope.** State the user-visible behavior, acceptance criteria, which roles get it (and which are denied), and the phase it belongs to. Confirm if ambiguous or large.

**2. Load domain skills.** Read only those your slice touches:

| Layer touched                   | Skill                                   |
| ------------------------------- | --------------------------------------- |
| Tables, columns, enums, indexes | `facilityiq-database-schema-migrations` |
| Repository queries, tenant data | `facilityiq-multi-tenancy-rls`          |
| Demo data                       | `facilityiq-seed-data`                  |
| Business logic, transactions    | `facilityiq-services-and-domain-logic`  |
| Permissions, roles, sessions    | `facilityiq-auth-and-permissions`       |
| HTTP endpoints                  | `facilityiq-api-routes`                 |
| Long-running work               | `facilityiq-background-worker`          |
| Files                           | `facilityiq-file-storage-uploads`       |
| Pages, layouts, Server Actions  | `facilityiq-nextjs-app-router`          |
| Styling, components, formatting | `facilityiq-ui-design-system`           |
| Data states, forms              | `facilityiq-ui-states-and-forms`        |
| Charts, KPI cards               | `facilityiq-charts-dataviz`             |
| 3D viewer, heatmaps, layouts    | `facilityiq-3d-digital-twin`            |
| Client state, caching           | `facilityiq-client-state-and-caching`   |
| KPIs, metrics                   | `facilityiq-analytics-kpis`             |
| Scenarios                       | `facilityiq-scenarios-projections`      |
| Insights, LLM                   | `facilityiq-insights-ai`                |
| Env vars                        | `facilityiq-local-env-config`           |

Also read `docs/ARCHITECTURE.md` and find the nearest existing slice to mirror (e.g. `api/facilities/[id]/metrics/route.ts` → `analytics-service.ts` → `repositories/analytics.ts` → `lib/analytics`).

Picking files for a new segment, a Server Action versus a Route Handler, or a cache API: read `nextjs-app-router-route`, `nextjs-server-action-vs-route-handler`, or `nextjs-caching-and-revalidation`, then the domain skill in the table. A Next.js upgrade is `nextjs-upgrade-assistant`, not this workflow.

**3. Design.** Decide: route(s) and method semantics; permission(s); DTO shape (authorized fields, finance gating, observed vs projected, `unavailableReason`); transaction boundary; idempotency for retryable writes; request vs worker; caching (default none).

**4. Implement bottom-up.** Schema + new migration → repository (org-scoped) → pure lib functions → Zod schemas → service (permission, invariants, transaction, DTO) → route adapter / Server Component → UI with all six data states.

**5. Test.** Per `facilityiq-unit-testing`, `facilityiq-integration-testing`, and `facilityiq-e2e-testing` as applicable. Every new repository function gets a cross-org test; every new mutation gets a viewer-denied test. Run them.

**6. Docs.** Same change: `docs/ARCHITECTURE.md` (routes, data model, structure), `docs/KPI_FORMULAS.md`, `docs/SCENARIOS.md`, `README.md`, `.env.example` — see `facilityiq-documentation-updates`.

**7. Gate.** Run `facilityiq-pr-readiness`. If auth, tenancy, files, secrets, AI, or caching changed, also run `facilityiq-security-review`.

## Definition of done

Working end to end for the right roles and denied for others; tests actually run with results; new migration if schema changed; seed still deterministic; living docs updated; CI-equivalent checks green.

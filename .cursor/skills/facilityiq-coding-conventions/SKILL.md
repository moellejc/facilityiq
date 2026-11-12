---
name: facilityiq-coding-conventions
description: FacilityIQ architecture overview and index of domain skills — system shape, stack, repository layout, layering, and non-negotiable rules, with pointers to the detailed skill for each area. Use when orienting in the FacilityIQ codebase, deciding where code belongs, or finding which domain skill applies to a file or task.
---

# FacilityIQ Architecture Overview

Source: Notion "FacilityIQ Engineering Standards" (Coding Conventions §1–3, §13; hub ground rules) and `docs/ARCHITECTURE.md`. When Notion, the repo docs, and skills disagree, fix the disagreement — don't silently pick one.

## System shape

- **Modular monolith.** One repo: Next.js 16 App Router web app (UI + HTTP API) and a Node worker (`worker/`), PostgreSQL 16 as system of record, S3-compatible storage (MinIO locally).
- **Stack:** pnpm · TypeScript strict · Tailwind v4 + shadcn/ui · Three.js + React Three Fiber + Drei · Recharts · Drizzle ORM + Drizzle Kit · Zod · Auth.js v5 · Vitest (+ Playwright planned).

## Non-negotiables

1. Every tenant-owned query is scoped to the authenticated org; never trust a client `organizationId`.
2. Roles are enforced on the server; `viewer` never mutates.
3. Money, KPIs, projections are deterministic TS/SQL — never LLM. Missing data is `null` + `unavailableReason`, never `0`.
4. Thin routes and components; logic in services and `src/lib`; queries in repositories.
5. Schema changes are new migrations; applied migrations are never edited.
6. The app works without `AI_API_KEY`.
7. Never claim tests, CI, publishes, or deploys that weren't observed.

## Layout → skill index

| Path                                                                                   | Skill                                                                                   |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `src/app/(auth)`, `src/app/(dashboard)`, `layout.tsx`, `page.tsx`, `src/proxy.ts`      | `facilityiq-nextjs-app-router`                                                          |
| `src/app/api/**/route.ts`, `src/server/http.ts`, `src/lib/api.ts`, `src/lib/errors.ts` | `facilityiq-api-routes`                                                                 |
| `src/server/services`, `src/server/actions`                                            | `facilityiq-services-and-domain-logic`                                                  |
| `src/lib/auth`, `src/lib/permissions`, `src/lib/rate-limit.ts`, `services/context.ts`  | `facilityiq-auth-and-permissions`                                                       |
| `src/server/repositories`, `src/db/tenant.ts`                                          | `facilityiq-multi-tenancy-rls`                                                          |
| `src/db/schema`, `src/db/migrations`, `drizzle.config.ts`                              | `facilityiq-database-schema-migrations`                                                 |
| `src/db/seed`                                                                          | `facilityiq-seed-data`                                                                  |
| `worker/`                                                                              | `facilityiq-background-worker`                                                          |
| `src/lib/storage`, `/api/uploads`                                                      | `facilityiq-file-storage-uploads`                                                       |
| `src/lib/analytics`                                                                    | `facilityiq-analytics-kpis`                                                             |
| `src/lib/scenarios`                                                                    | `facilityiq-scenarios-projections`                                                      |
| `src/lib/ai`                                                                           | `facilityiq-insights-ai`                                                                |
| `src/components/ui`, `layout`, `globals.css`, `src/lib/format.ts`                      | `facilityiq-ui-design-system`                                                           |
| Feature components (data states, forms)                                                | `facilityiq-ui-states-and-forms`                                                        |
| `src/components/charts`, `dashboard/kpi-card.tsx`                                      | `facilityiq-charts-dataviz`                                                             |
| `src/components/3d`, `src/lib/twin`, `facilities/twin-loader.tsx`                      | `facilityiq-3d-digital-twin`                                                            |
| URL state, providers, caching, revalidation                                            | `facilityiq-client-state-and-caching`                                                   |
| `tests/unit` · `tests/integration` · `tests/e2e`                                       | `facilityiq-unit-testing` · `facilityiq-integration-testing` · `facilityiq-e2e-testing` |
| `.github/workflows`, `Dockerfile`                                                      | `facilityiq-ci-cd`                                                                      |
| `compose.yaml`, `docker/`, `.env.example`                                              | `facilityiq-local-env-config`                                                           |
| `docs/`, `README.md`, `AGENTS.md`, skills                                              | `facilityiq-documentation-updates`                                                      |

Decision skills sit beside that index. They link to the domain skill instead of repeating it.

| Decision                                            | Skill                                   | Domain skill                                              |
| --------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| Which App Router files to add                       | `nextjs-app-router-route`               | `facilityiq-nextjs-app-router`, `facilityiq-api-routes`   |
| Server Action or Route Handler                      | `nextjs-server-action-vs-route-handler` | `facilityiq-api-routes`, `facilityiq-ui-states-and-forms` |
| What `revalidatePath` / `revalidateTag` do          | `nextjs-caching-and-revalidation`       | `facilityiq-client-state-and-caching`                     |
| Next.js release notes, codemod, deprecated-API list | `nextjs-upgrade-assistant`              | `facilityiq-dependency-upgrades`                          |
| First PR                                            | `facilityiq-first-contribution`         | the workflow table in `AGENTS.md`                         |

Organize by domain inside these folders. Don't invent new top-level locations without updating `docs/ARCHITECTURE.md`.

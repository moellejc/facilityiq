# FacilityIQ agent guide

FacilityIQ is Acme AI's multi-tenant 3D facility-intelligence SaaS: a Next.js App Router web app plus a Node worker, backed by PostgreSQL 16. Company engineering standards are maintained in Notion under **FacilityIQ Engineering Standards** (Coding Conventions, Unit Test Standards, CI Process, SDLC Best Practices). They are condensed into project skills and rules so agents can apply them while working.

## How guidance is organized

- **Workflow skills** describe how to carry out a type of task. Start every task with one.
- **Domain skills** describe what good code looks like in one area (Next.js, UI, API, database, and so on). Workflow skills tell you which ones to load; you can also find them by folder in the tables below.
- **Rules** in `.cursor/rules/*.mdc` attach automatically when you open matching files. They hold the hard rules for that area and point to the full skill.

Skills live in `.cursor/skills/<name>/SKILL.md`. Read the whole skill before acting on it.

## 1. Pick a workflow skill

| Task                                                                                | Workflow skill                                                                     |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| New feature, endpoint, page, panel, KPI, scenario, insight rule, job, 3D capability | `facilityiq-feature-development`                                                   |
| Bug, regression, wrong number, failing test, data leak                              | `facilityiq-bug-fixing`                                                            |
| Refactor, restructure, cleanup, performance work                                    | `facilityiq-refactoring`                                                           |
| Add or upgrade a dependency, vulnerability fix                                      | `facilityiq-dependency-upgrades`                                                   |
| Next.js upgrade (release notes, official codemod, deprecated-API list)              | `nextjs-upgrade-assistant`, then `facilityiq-dependency-upgrades` for the lockfile |
| Docs, README, `.env.example`, skills, `AGENTS.md`                                   | `facilityiq-documentation-updates`                                                 |
| Before saying work is done, opening a PR, writing a PR description                  | `facilityiq-pr-readiness`                                                          |
| Reviewing a PR or diff                                                              | `facilityiq-code-review`                                                           |
| Change touching auth, tenancy, files, secrets, AI, or caching                       | add `facilityiq-security-review`                                                   |
| Orienting in the codebase                                                           | `facilityiq-coding-conventions` (overview and skill index)                         |
| First change, or "where do I start"                                                 | `facilityiq-first-contribution`                                                    |

Every code change ends with `facilityiq-pr-readiness`. Run `pnpm guard` before that. What the guard enforces, and what stays advisory, is in `docs/guardrails.md`. The `/first-pr` command follows the first-contribution skill. GitFlow says feature PRs target `develop`; this repo has no `develop` branch, so PRs target `main` until a maintainer creates it.

`automations/nextjs-drift-watcher.md` is the spec for a Cursor Automation that opens a pull request when Next.js release notes change the deprecated list or the Next.js skills. Joe creates that automation in the Cursor UI. It only opens pull requests. The procedure it follows is `nextjs-upgrade-assistant`.

## 2. Load the domain skills for the areas you touch

**Frontend**

| Area                                            | Paths                                                                        | Skill                                 |
| ----------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------- |
| Next.js routing, pages, layouts, Server Actions | `src/app/**`, `src/proxy.ts`, `src/server/actions`                           | `facilityiq-nextjs-app-router`        |
| Design system, styling, formatting              | `src/components/ui`, `src/components/layout`, `globals.css`, `lib/format.ts` | `facilityiq-ui-design-system`         |
| Data states and forms                           | feature components, forms, dialogs                                           | `facilityiq-ui-states-and-forms`      |
| Charts and KPI cards                            | `src/components/charts`, `src/components/dashboard`                          | `facilityiq-charts-dataviz`           |
| 3D digital twin                                 | `src/components/3d`, `src/lib/twin`                                          | `facilityiq-3d-digital-twin`          |
| Client state and caching                        | URL params, providers, `revalidatePath`                                      | `facilityiq-client-state-and-caching` |

Before editing those files, pick the pattern with `nextjs-app-router-route`, `nextjs-server-action-vs-route-handler`, or `nextjs-caching-and-revalidation`. Each one links back to the skill in this table.

**Backend**

| Area                     | Paths                                                        | Skill                                  |
| ------------------------ | ------------------------------------------------------------ | -------------------------------------- |
| HTTP API                 | `src/app/api/**/route.ts`, `src/server/http.ts`              | `facilityiq-api-routes`                |
| Services, business logic | `src/server/services`                                        | `facilityiq-services-and-domain-logic` |
| Auth and permissions     | `src/lib/auth`, `src/lib/permissions`, `services/context.ts` | `facilityiq-auth-and-permissions`      |
| Background jobs          | `worker/`, `background_jobs`                                 | `facilityiq-background-worker`         |
| File storage, uploads    | `src/lib/storage`, `/api/uploads`                            | `facilityiq-file-storage-uploads`      |

**Database**

| Area                     | Paths                                         | Skill                                   |
| ------------------------ | --------------------------------------------- | --------------------------------------- |
| Schema and migrations    | `src/db/schema`, `src/db/migrations`          | `facilityiq-database-schema-migrations` |
| Tenant isolation and RLS | `src/server/repositories`, `src/db/tenant.ts` | `facilityiq-multi-tenancy-rls`          |
| Seed data                | `src/db/seed`                                 | `facilityiq-seed-data`                  |

**Product domains**

| Area               | Paths                                       | Skill                              |
| ------------------ | ------------------------------------------- | ---------------------------------- |
| Analytics and KPIs | `src/lib/analytics`, `docs/KPI_FORMULAS.md` | `facilityiq-analytics-kpis`        |
| Scenarios          | `src/lib/scenarios`, `docs/SCENARIOS.md`    | `facilityiq-scenarios-projections` |
| Insights and AI    | `src/lib/ai`                                | `facilityiq-insights-ai`           |

**Quality and platform**

| Area                      | Paths                                     | Skill                            |
| ------------------------- | ----------------------------------------- | -------------------------------- |
| Unit tests                | `tests/unit`                              | `facilityiq-unit-testing`        |
| Integration tests         | `tests/integration`                       | `facilityiq-integration-testing` |
| End-to-end tests          | `tests/e2e`                               | `facilityiq-e2e-testing`         |
| CI/CD                     | `.github/workflows`, `Dockerfile`         | `facilityiq-ci-cd`               |
| Local environment, config | `compose.yaml`, `docker/`, `.env.example` | `facilityiq-local-env-config`    |

## Ground rules (always apply)

- Scope every tenant-owned query to the authenticated organization. Never trust a client-supplied `organizationId`.
- Enforce roles on the server (`src/lib/permissions` and services). `viewer` never mutates.
- Money, KPIs, and projections are deterministic TypeScript/SQL, never LLM output. Missing data is `null` with `unavailableReason`, never `0`.
- Keep layering intact: thin routes and components, logic in services and `src/lib`, queries in repositories.
- Schema changes ship as a new versioned migration. Never edit an applied one.
- The app must work without `AI_API_KEY`.
- Never claim tests passed, CI ran, an image was published, or a deploy happened unless you observed it. Report exact commands and results, including anything skipped or not run.

## Commands

```bash
pnpm install --frozen-lockfile
pnpm format:check && pnpm lint && pnpm typecheck
pnpm test:unit
pnpm db:migrate && pnpm test:integration   # requires PostgreSQL 16
pnpm build
pnpm guard                                 # new violations only; see docs/guardrails.md
docker compose up --build                  # full local stack (app, worker, postgres, minio)
```

## When guidance conflicts or is missing

- If a skill, a rule, the Notion standards, and the in-repo docs (`docs/ARCHITECTURE.md`, `docs/KPI_FORMULAS.md`, `docs/SCENARIOS.md`, `README.md`) disagree, don't silently pick one. Fix the in-repo doc or skill in the same change, or flag the conflict to the user.
- Some skills (UI design system, background worker, file storage) are partly derived from current code because Notion doesn't cover those areas in depth yet. Those sections are marked. Follow them, but treat them as existing practice rather than settled standards, and flag anything that seems wrong.
- When a Notion standard changes, update the matching skill and rule in the same PR. When a repo change alters a convention, update the skill, the rule, and the relevant `docs/` file, and flag the Notion page that needs to change.

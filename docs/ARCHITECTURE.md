# FacilityIQ Architecture Plan

Staff developer decisions for building FacilityIQ, a multi-tenant 3D operations and facility-intelligence SaaS. This plan governs Phase 1 and later phases. Prefer working vertical slices over placeholders.

## 1. System shape

Modular monolith, not microservices.

- **Web app:** Next.js App Router (TypeScript) serves the UI and authenticated HTTP API from one process.
- **Worker:** A separate Node.js process in the same repository consumes `background_jobs` for insight generation, metric rollups, and (later) model-processing. It shares schema, services, and validation with the app.
- **Data:** PostgreSQL 16 is the system of record.
- **Object storage:** S3-compatible API. Local development uses MinIO so no cloud account is required. Production can point at real S3/R2/GCS via env vars.
- **Boundary:** UI components and route handlers stay thin. Business logic lives in `src/server/services` and `src/lib/*`. Persistence lives in `src/server/repositories`.

## 2. Technology choices

Use current stable, mutually compatible versions and pin them with a lockfile (`pnpm-lock.yaml`). Prefer pnpm via Corepack.

| Area       | Choice                                           | Why                                                               |
| ---------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| Framework  | Next.js App Router + React + TypeScript (strict) | Server Components for dashboards; isolate 3D in client components |
| UI         | Tailwind CSS + shadcn/ui (New York style)        | Premium enterprise look, accessible primitives                    |
| 3D         | Three.js + React Three Fiber + Drei              | Required interactive digital twin                                 |
| Charts     | Recharts                                         | Required analytics charts                                         |
| DB / ORM   | PostgreSQL 16 + Drizzle ORM + Drizzle Kit        | Typed schema, versioned SQL migrations                            |
| Validation | Zod                                              | Shared request, env, and AI-output schemas                        |
| Auth       | Auth.js v5 (NextAuth) with Drizzle adapter       | Database sessions, first-class org membership                     |
| Tests      | Vitest + React Testing Library + Playwright      | Unit, component, and e2e                                          |
| Containers | Docker + Compose                                 | `docker compose up --build` is the demo path                      |
| CI         | GitHub Actions workflows in-repo                 | Ready when the repo is published to GitHub as `facilityiq`        |

Initial repo hosting: Cursor Origin draft created by the cloud agent (`new_repo`). Cursor cannot create a GitHub repository. Workflows, Dockerfile, and README are written as if the GitHub repo will be named `facilityiq`. Do not invent a GitHub remote or claim a GitHub repo was created.

## 3. Multi-tenancy and security

Every tenant-owned row is reachable only through the caller's organization.

1. Authenticate the session with Auth.js (database strategy, so access can be revoked).
2. Resolve membership from `organization_members`. Never trust a client-supplied `organizationId` without checking membership.
3. Repositories require `organizationId` as an explicit argument and always include it in queries, including nested resources (facility → area → asset → file).
4. File downloads and signed URLs are organization-scoped (`orgs/{organizationId}/...`) and re-checked on read.
5. Enable PostgreSQL row-level security as defense in depth, keyed off `current_setting('app.current_organization_id', true)`.
6. Validate all inputs with Zod. Return `{ error: { code, message } }` and never leak internal database errors.
7. Rate-limit auth and upload routes. Audit-log administrative changes (members, roles, settings, layout restores).
8. Secrets live in environment variables only. AI keys and database URLs must never ship in client bundles.

**Roles** (enforced in `src/lib/permissions` and server services, not only hidden in the UI):

- `org_admin` — users, facilities, integrations, subscription/settings, all data
- `operations_manager` — 3D explorer, operations metrics, bottlenecks, scenarios (create/run)
- `finance_manager` — financial dashboards, cost/ROI views, scenario review
- `viewer` — permitted dashboards and 3D exploration; no mutations

A user belongs to an organization through `organization_members`. Role is per membership, not global on `users`.

## 4. Identity and demo access

The product must run without an external IdP or cloud account.

- Auth.js credentials provider for email/password.
- Passwords hashed with a modern adaptive hash (Argon2id or bcrypt).
- Auth.js tables: `accounts`, `sessions`, `verification_tokens` (plus `users` from the product schema).
- Seeded Acme Manufacturing users, documented in the README (demo passwords only).
- Active organization stored in a validated session/cookie. Active facility stored in a validated cookie or search param and checked against the active org on every request.
- Route groups: `(auth)` for sign-in; `(dashboard)` for the signed-in shell. Middleware protects dashboard and API routes except auth and health.

## 5. Data model

Implement the full normalized schema in Phase 1 (even if later UI phases consume it) so we do not churn migrations.

**Specified domains:** `users`, `organizations`, `organization_members`, `facilities`, `facility_areas`, `assets`, `facility_layouts`, `operational_metrics`, `asset_events`, `financial_metrics`, `scenarios`, `scenario_results`, `insights`.

**Also required:** Auth.js adapter tables, `uploaded_files`, `import_jobs`, `audit_logs`, `background_jobs`.

Conventions:

- UUID primary keys (`gen_random_uuid()`).
- `timestamptz` for all timestamps; store UTC; display in the viewer's locale.
- Monetary amounts as `numeric` (amounts `numeric(15,2)`, rates `numeric(18,4)`), with an ISO currency code defaulting to `USD`.
- JSONB for `metadata`, `layout_data`, scenario `configuration`, insight `evidence`, and similar extension points.
- Foreign keys and indexes, including `(organization_id, recorded_at)` on metrics and `(facility_id)` on areas/assets.
- Unique `(organization_id, user_id)` on members; globally unique organization `slug`.
- Drizzle relations defined next to tables.
- Versioned SQL migrations via Drizzle Kit.
- Transactional writes for multi-table updates (seed batches, layout save, scenario run).

## 6. API

App Router handlers under `src/app/api/...` as specified:

`/api/organizations`, `/api/facilities`, `/api/facilities/[id]`, areas, assets, layout, metrics, financials, insights, `/api/scenarios`, `/api/scenarios/[id]`, `/api/scenarios/[id]/run`, `/api/uploads`, `/api/reports`.

Phase 1 implements auth, organization, facility list/get, and health. Remaining routes may return authenticated stubs only if the schema and services are not yet wired; prefer real list/get over fake JSON. Use page/limit pagination (max 100) with `total` for tables, plus filtering and sorting where lists need it.

## 7. Frontend information architecture

Professional enterprise shell:

- Collapsible dark-navy left sidebar
- Organization selector, facility selector, user menu, notifications, breadcrumbs
- Light analytics panels, subtle borders/shadows, blue/indigo accents
- Status colors: green healthy, amber warning, red critical
- Desktop-first, usable on tablet
- Typography: Geist or Inter, compact data-dense layouts

Primary nav as specified: Dashboard; Facilities (Overview, 3D Digital Twin, Areas, Assets, Layouts); Operations (Throughput, Utilization, Bottlenecks); Finance (Operating Costs, Cost per Order, Asset Costs); Scenarios; AI Insights; Reports; Settings.

Phase 1 builds the real shell and navigation. Pages other than sign-in, dashboard home, and settings may be routed shells that explain they will light up in later phases — do not fake KPI numbers.

**No reference image was supplied.** Follow this written visual language. Do not embed a stock screenshot as the UI.

## 8. 3D digital twin (Phase 2+, decisions now)

- Load `FacilityCanvas` with `next/dynamic` and `{ ssr: false }`.
- Procedural geometry for the seeded warehouse; uploaded GLB/glTF later via signed URLs.
- Reusable data-driven components under `src/components/3d/` matching the requested filenames.
- `InstancedMesh` for repeated racks and pallets (hundreds to thousands of objects).
- Orbit/pan/zoom, select asset or area, highlight, category visibility, labels, perspective vs top-down, reset, focus selected, heatmap toggle.
- Selected-object details come from the data model (side panel), never hardcoded demo strings.
- Heatmaps: utilization, throughput, operating cost, bottleneck severity — colors from server-normalized metrics, with legend and thresholds.
- Keep per-frame camera/animation state out of React state.
- Dispose Three.js resources on unmount.
- Layout editing is a separate route/mode from the operational viewer, with grid snap, bounds checks, AABB overlap checks, and versioned `facility_layouts`.

## 9. Analytics, insights, and scenarios

**Analytics (Phase 3):** Deterministic TypeScript in `src/lib/analytics` plus SQL aggregation in repositories. Document every KPI in `docs/KPI_FORMULAS.md` (numerator, denominator, units, aggregation, missing-data and zero-denominator behavior). Never use an LLM to compute financial metrics.

Core formulas (implement and test exactly):

- Throughput (orders/hour) = orders in period / hours in period
- Throughput (orders/day) = orders in period / days in period
- Utilization % = busy time / available time (or stored utilization samples averaged with explicit rules)
- Cost per order = operating cost in period / orders in period
- Average cycle time = mean cycle-time samples in period
- Bottleneck count = distinct assets/areas whose bottleneck severity exceeds the warning threshold in period

Division by zero or an empty period returns `null` with a machine-readable `unavailable_reason`. Do not render `0` as if it were a measured value.

Raw series live in `operational_metrics` and `financial_metrics` (`metric_type` / `cost_category` enums). Seed 30 days of internally consistent data, including the required problem conditions.

**Insights (Phase 4):** `InsightsProvider` in `src/lib/ai/provider.ts`. Default `DeterministicRulesProvider` always works without an API key and surfaces the seeded problems from calculated metrics. Optional language enrichment behind `AI_API_KEY` (`src/lib/ai/llm-language.ts`) may only rephrase text after Zod validation. Persistence is `generateFacilityInsights` → `replaceDeterministicInsights`. Model output cannot execute mutations. The insights page links to `/facilities/twin?select=asset:<id>` or `select=area:<id>`. Estimated savings stay labeled estimates.

**Scenarios (Phase 5):** Deterministic projections in `src/lib/scenarios` (see `docs/SCENARIOS.md`). APIs cover save, run, duplicate, compare, and delete. Baseline blocks are `observed`; projected dollars are labeled modeled estimates. The `/scenarios` page is a read-only summary; the full editor UI is deferred.

## 10. Files and worker

- Signed upload URLs, size and type limits (GLB/glTF only in MVP), private buckets, org-scoped access, progress UI, asset-to-file association.
- Procedural geometry if an asset has no model.
- Do not convert SolidWorks/STEP in MVP; define a worker job type so a conversion worker can be added later.
- Phase 1 includes MinIO, the `uploaded_files` table, and a worker process that can dequeue no-op or log-only jobs so Compose is complete.

## 11. Docker and local demo

Compose services: `app`, `worker`, `postgres` (16, healthcheck, named volume), `minio`.

- Multi-stage `Dockerfile` (deps → builder → runner) plus a dev-friendly compose setup with hot reload.
- `.env.example` documents every variable: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, S3/MinIO settings, optional `AI_API_KEY`.
- `docker compose up --build` starts the stack without any external cloud account.
- Document `pnpm db:migrate` (or `drizzle-kit migrate`) and `pnpm db:seed`.
- Seed command is deterministic and repeatable (truncate-or-upsert strategy documented).

## 12. Seed: Acme Manufacturing

Organization: **Acme Manufacturing**  
Facility: **West Distribution Center**

Populate: 1 warehouse, 8 operational areas, 80 storage racks, 500 pallets, 6 loading docks, 4 packing stations, 3 conveyor systems, 5 forklifts, 30 days of operational and financial metrics, several alerts, ≥5 insights, 3 sample scenarios.

Seeded issues (internally consistent metrics, events, and insights):

1. One aisle with excessive utilization
2. A packing station with insufficient capacity
3. Two underutilized forklifts
4. Increasing loading-dock dwell time
5. Rising maintenance cost on one conveyor

Include healthy areas so the demo is not uniformly red.

## 13. Testing and CI

- Unit: analytics formulas, permissions, Zod schemas.
- Integration: organization isolation (including nested resources), referential integrity, migration apply, seed idempotence/determinism.
- Component/e2e (later phases): 3D selection, heatmaps, login → facility → twin → select asset → scenario.
- Phase 1 must actually run: lint, typecheck, unit tests, and integration tests against PostgreSQL. Do not claim tests passed unless they ran.
- GitHub Actions PR workflow covers: install, format, ESLint, `tsc`, unit tests, Postgres service, migrate, integration tests, Next.js build, and a Playwright smoke hook (smoke can be skipped-if-absent in Phase 1 but the workflow should exist).
- `guardrails.yml` is a separate pull-request workflow: guard self-tests, a fingerprint ratchet (rule + source line, whitespace collapsed) over changed files, and a mocked deploy gate. It does not replace the checks above. See `docs/guardrails.md`. The pnpm version in CI comes from `package.json` `packageManager` only.
- Main-branch workflow: all checks, production image build, vulnerability scan step, GHCR publish (guarded), staging deploy stub that does **not** auto-deploy to production.

Minimum Actions permissions; no secrets committed.

## 14. Repository layout

Follow the specified `facilityiq/` tree (`src/app`, `components/{ui,layout,dashboard,charts,3d,facilities,scenarios}`, `db/{schema,migrations,seed}`, `lib/{auth,validation,permissions,storage,analytics,ai}`, `server/{services,repositories}`, `hooks`, `types`, `worker`, `tests/{unit,integration,e2e}`, `docker`, `.github/workflows`, `Dockerfile`, `compose.yaml`, `.env.example`, `drizzle.config.ts`, `README.md`).

Also add `docs/ARCHITECTURE.md` (this plan, kept in-repo) and `docs/KPI_FORMULAS.md`.

Guardrails add `scripts/guard`, `.cursor/guardrails.json`, `.cursor/hooks`, `demo/bad-change.patch` (a fixture, not applied), and `docs/guardrails.md`. Those paths are documented here so they are not an undocumented top-level layout.

## 15. Implementation order

1. **Phase 1 — Foundation (this increment):** Next.js + Tailwind + shadcn, Drizzle + full schema + migrations, Auth.js + orgs/roles, dashboard shell, Docker Compose (app, worker, postgres, minio), seed, README, CI workflows, tests for permissions and org isolation.
2. **Phase 2 — 3D viewer:** procedural warehouse bound to Postgres layout/assets, camera, selection, details panel, layers.
3. **Phase 3 — Analytics:** metric services, real KPI cards and charts, heatmaps, date filters.
4. **Phase 4 — AI insights:** deterministic rules + optional LLM, insights UI, object linking.
5. **Phase 5 — Scenarios:** models, editor, projections, compare/save.
6. **Phase 6 — Production readiness:** uploads, remaining tests, 3D perf, Docker polish, Actions, deploy docs.

After each phase, report: features, files changed, migrations, tests actually run and their results, known limitations, next steps.

## 16. Assumptions

1. Demo auth is email/password; no OAuth provider is required to start the stack.
2. Display currency is USD; timestamps are stored in UTC.
3. One seeded organization and facility are sufficient for the MVP demo.
4. The first repository is a Cursor Origin draft. GitHub named `facilityiq` is a later publish/create step by the user.
5. No visual reference image was provided; the written design language is the source of truth.
6. The app must work without `AI_API_KEY`.
7. English (en-US) copy and number formatting.
8. Viewer role is read-only, including layout and scenario mutations.
9. KPI values shown in the UI are calculated from stored data, never hardcoded, once the analytics phase lands. Phase 1 must not fake them.

## 17. Phase 1 divergences

These are concrete incompatibilities or practical additions. The rest of this document still governs later phases.

1. **Auth.js database sessions and the credentials provider.** `@auth/core` 0.41.3 (the core used by `next-auth@5.0.0-beta.32`, the current Auth.js v5 release) throws `UnsupportedStrategy` when Credentials is the only provider and `session.strategy` is `"database"`. The credentials callback also always writes a JWT cookie and never calls `adapter.createSession`. Password sign-in therefore verifies the Argon2id hash in `src/server/services/auth-service.ts`, inserts a row in `sessions`, and sets the `authjs.session-token` cookie Auth.js reads. `auth()` and `signOut()` still use the Drizzle adapter and the database strategy, so deleting the session row revokes access. There is no stable Auth.js v5 release; beta.32 is the current v5 line and it declares support for Next.js 16.

2. **`organization_id` on nested tables.** Areas, assets, layouts, metrics, events, scenario results, files, and import jobs carry `organization_id` even when the product spec only named the parent foreign key. Row-level security can then be a single predicate, and repositories still filter on it. Triggers reject a row whose organization does not match its facility, area, asset, or scenario.

3. **`asset_events.asset_id` is nullable.** Area-level alerts (Aisle 04, Receiving) need a target. A check constraint requires `asset_id` or `area_id`. `facility_id` is also stored so events stay org-scoped.

4. **Next.js 16 `proxy.ts`.** The `middleware.ts` convention is deprecated. `src/proxy.ts` only checks that the session cookie is present. The database session is validated in server layouts and route handlers, which run on the Node.js runtime.

5. **Cache Components are off.** The Next.js 16 scaffold enabled `cacheComponents`. Tenant pages are request-dynamic. Leaving the flag on risks caching one organization's data into another response, so it is disabled until a later phase adds explicit cache boundaries for non-tenant shells.

6. **shadcn preset.** Current shadcn no longer exposes the New York style flag. The project uses the `radix-nova` preset (Radix primitives, Lucide, Geist), which is the closest current equivalent, and the navy / indigo palette is applied on top.

7. **Development role passwords live in the RLS migration.** `facilityiq_app` / `facilityiq_app_dev` and `facilityiq_worker` / `facilityiq_worker_dev` are created by `0001_rls.sql` so `pnpm db:migrate` is enough for a local superuser. They match `.env.example`. Replace them before any shared or production deployment. The worker role has `BYPASSRLS` so it can dequeue jobs across organizations. A custom GUC is not used as a bypass, because the application role could set that itself.

8. **Seed clock is fixed.** Operational and financial history ends on 2026-11-01 UTC (30 days, inclusive). Repeating the seed deletes Acme Manufacturing and inserts the same business keys and values. Password hashes are Argon2id and are not byte-stable; the demo password is.

9. **Financial rows do not double-count conveyor maintenance.** Facility-level maintenance is building overhead ($180/day). CV-01, CV-02, and CV-03 maintenance is stored only on the asset. A later rollup must sum both scopes once each.

## 18. Phase 2 notes

`FacilityCanvas` is still loaded with `next/dynamic` and `{ ssr: false }`. Next.js 16 rejects that call inside a Server Component, so `src/components/facilities/twin-loader.tsx` (a client component) performs the import. The twin page stays a Server Component and passes the org-scoped scene DTO in.

Asset rows have no width or height. Procedural body sizes in `src/lib/twin/procedural.ts` are visual defaults. Positions, rotations, names, status, areas, utilization samples, and events come from PostgreSQL. The heatmap toggle does not recolor objects. Layout editing remains on `/facilities/layouts` and does not write.

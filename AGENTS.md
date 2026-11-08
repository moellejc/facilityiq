<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# FacilityIQ agent guide

FacilityIQ is a multi-tenant facility-operations SaaS. Treat the working tree, `docs/ARCHITECTURE.md`, `docs/KPI_FORMULAS.md`, `docs/SCENARIOS.md`, and the skills under `.cursor/skills/` as authoritative. Prefer working code over older plan notes when they disagree.

## Stack (do not reinvent)

- Modular monolith: Next.js App Router (TypeScript strict) + a separate Node worker in this repo
- Package manager: pnpm (Corepack); pin via `pnpm-lock.yaml`
- PostgreSQL 16 + Drizzle ORM + versioned SQL migrations under `src/db/migrations`
- Auth.js v5 database sessions; passwords hashed with Argon2id (`src/lib/auth/password.ts`)
- Zod at API / env / AI-language boundaries; structured `{ error: { code, message } }`
- Tailwind CSS + shadcn/ui (radix-nova preset in this repo)
- Three.js + React Three Fiber + Drei for the twin; Recharts for analytics
- Vitest unit + integration; Playwright e2e hooks exist for later smoke
- Docker Compose is the full-stack demo path; app port **43123**

## Layering

| Layer | Location | Rule |
| --- | --- | --- |
| UI | `src/components`, App Router pages | Thin. No KPI formulas, tenancy, or permission matrices. |
| Route handlers / server actions | `src/app/api`, `src/server/actions` | Auth + Zod parse + call a service. No SQL. |
| Services | `src/server/services`, pure logic in `src/lib/*` | Permissions, orchestration, projections, insight rules. |
| Repositories | `src/server/repositories` | Always take `organizationId` (and usually `userId`) and filter by it. Use `withTenant`. |
| Schema / seed | `src/db/schema`, `src/db/seed` | Never rewrite an applied migration. Add a new migration instead. |

## Tenancy, auth, roles

1. Resolve membership from `organization_members`. Never trust a client-supplied organization id without a membership check.
2. Active org / facility come from validated cookies (`facilityiq.org`, `facilityiq.facility`) and are re-checked against membership.
3. Enforce permissions with `assertRole` / `roleCan` in services (`src/lib/permissions`). Roles: `org_admin`, `operations_manager`, `finance_manager`, `viewer`. Viewer is read-only for mutations (layouts, scenarios, insights write, uploads).
4. RLS is defense in depth via `app.current_organization_id` / `app.current_user_id` inside `withTenant`. Repositories still filter by `organizationId`.
5. Secrets stay in env (`.env.example`). Never put `AI_API_KEY`, database URLs, or Auth secrets in client bundles.

## Domain invariants

- **KPIs and scenarios are deterministic.** Formulas live in `src/lib/analytics` and `src/lib/scenarios`. Document them in `docs/KPI_FORMULAS.md` / `docs/SCENARIOS.md`. An LLM must never compute money, throughput, or ROI.
- **Missing samples are not zero.** Return `null` with `unavailableReason` (`empty_period`, `missing_inputs`, `zero_denominator`). Do not paint absent data as `0`.
- **Baseline vs projected.** Observed metrics stay labeled `observed`. Scenario / insight dollar estimates stay labeled modeled / estimate — never verified savings.
- **Insights** work with no `AI_API_KEY`. Optional language enrichment may only rephrase Zod-validated text fields after rules already computed evidence. Model output cannot mutate the database.
- **3D twin:** load the canvas through a client `next/dynamic` import with `{ ssr: false }` (`twin-loader.tsx`). Use `InstancedMesh` for racks/pallets. Selection details come from the scene DTO / Postgres, not hardcoded demo strings.
- **Credentials + database sessions:** password sign-in inserts the Auth.js session row in `auth-service` (Auth.js credentials alone cannot create DB sessions in this version). Do not “fix” that by switching to JWT-only.

## Definition of done (every change)

1. Logic in the right layer; org scoping and roles enforced on the server.
2. `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, and (when DB/schema touched) `pnpm test:integration` actually run — do not claim pass without running.
3. No fake KPI numbers. Seeded demo password remains documented in README only.
4. Small, focused PRs. Prefer vertical slices that leave the app runnable without optional AI keys.

## Skills

- `.cursor/skills/coding-conventions/SKILL.md`
- `.cursor/skills/unit-test-standards/SKILL.md`
- `.cursor/skills/ci-process/SKILL.md`
- `.cursor/skills/sdlc-best-practices/SKILL.md`

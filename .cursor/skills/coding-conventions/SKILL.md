---
name: facilityiq-coding-conventions
description: FacilityIQ coding conventions for the Next.js modular monolith — layering, tenancy, Zod, Auth.js, Drizzle, twin, analytics, and insights. Use when writing or reviewing application code in this repository.
---

# FacilityIQ coding conventions

## Architecture

- Stay a **modular monolith**: App Router UI + API in one Next.js process; async work in `worker/`. Do not introduce microservices.
- Prefer **server components** for dashboards; isolate interactive 3D and browser-only widgets in client components.
- **Thin boundaries:** pages, components, and route handlers call services. Business rules live in `src/server/services` and pure modules under `src/lib`. SQL/Drizzle stays in `src/server/repositories` (or seed/migrate tooling).

## TypeScript and packages

- Keep `strict` TypeScript. Avoid `any` at API and persistence boundaries.
- Import with the `@/` alias into `src/`.
- Use **pnpm** and commit `pnpm-lock.yaml`. Do not add a second package manager.
- Prefer existing libraries already pinned (Zod 4, Drizzle, Auth.js v5 beta line, R3F, Recharts, Vitest).

## Validation and errors

- Validate request bodies, query params, and env with **Zod** (`src/lib/validation`, schema modules next to domain).
- Return structured errors via `AppError` / `toErrorResponse`: `{ error: { code, message } }`. Never leak raw Postgres / stack traces to clients.
- For optional AI language output, use **strict** Zod schemas and reject extra fields (especially financial ones).

## Auth and tenancy

- Auth.js v5 with **database sessions**. Password hashing is **Argon2id** (`@node-rs/argon2`). Sign-in creates the session row in `auth-service` because credentials alone cannot create DB sessions in this Auth.js version — keep that path.
- Resolve the active organization from membership, not from an unchecked client id. Facility selection must belong to that organization.
- Every repository method that reads tenant data takes `organizationId` and filters on it. Nested tables also store `organization_id` for RLS.
- Wrap tenant queries in `withTenant` so RLS GUCs are set. Do not bypass RLS from the app role.
- Enforce roles with `assertRole` / `roleCan`. Hiding a button is not enough. Viewer cannot mutate layouts, scenarios, insight generation, or uploads.

## Database

- Schema in `src/db/schema`; apply changes with **new** Drizzle SQL migrations. **Never rewrite or edit an already-applied migration.**
- Money: `numeric` columns; coerce with `Number()` and skip non-finite values — do not treat `NaN` as `0`.
- Timestamps: `timestamptz`, store UTC.
- Multi-table writes (seed, scenario run, insight replace) use transactions.

## UI and 3D

- Tailwind + shadcn primitives already in `src/components/ui`. Match the navy / indigo enterprise shell; do not invent a second design system.
- Load `FacilityCanvas` only through `twin-loader.tsx` with `next/dynamic({ ssr: false })`. Server pages must not call `dynamic(..., { ssr: false })` directly (Next 16).
- Use **InstancedMesh** for repeated racks and pallets. Prefer existing procedural geometry helpers over per-frame React state for camera animation.
- Selection / heatmap / KPI panels consume server DTOs. No hardcoded fake throughput or cost numbers.

## Analytics, insights, scenarios

- KPI aggregation: `src/lib/analytics` + analytics repositories. Missing series → `null` + `unavailableReason`, never a painted zero.
- Insights: `DeterministicRulesProvider` always runs. Optional LLM behind `AI_API_KEY` may only rephrase text after validation. Persistence only through the insight service/repository.
- Scenarios: deterministic projections in `src/lib/scenarios`. Keep **observed baseline** structurally separate from **modeled** projection. Label estimated savings as estimates.
- The app must remain usable with an empty `AI_API_KEY`.

## Secrets and config

- Document new env vars in `.env.example`. Never commit real secrets.
- Do not ship `AI_API_KEY`, `AUTH_SECRET`, or database URLs to the browser.

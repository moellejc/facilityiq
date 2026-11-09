---
name: facilityiq-services-and-domain-logic
description: FacilityIQ service-layer standards — layering between routes, services, repositories, and pure libraries; service input shape; permission enforcement; AppError; transactions; idempotency and optimistic concurrency; DTO projection; and request vs worker placement. Use when creating or editing src/server/services, src/server/repositories call patterns, or deciding where business logic belongs.
---

# Services and Domain Logic (FacilityIQ)

Source: Notion Coding Conventions §3, §14.

## Layering

| Layer      | Location                                                                      | Owns                                                               |
| ---------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Adapter    | `src/app/api/**/route.ts`, `src/server/actions/*`, Server Components          | Context + parsing + response mapping                               |
| Service    | `src/server/services/<domain>-service.ts`                                     | Permission checks, invariants, transactions, DTO projection        |
| Repository | `src/server/repositories/<domain>.ts`                                         | Org-scoped Drizzle queries (`facilityiq-multi-tenancy-rls`)        |
| Pure lib   | `src/lib/analytics`, `src/lib/scenarios`, `src/lib/ai`, `src/lib/twin`        | Deterministic calculations, explicit inputs/outputs, no DB/network |
| Validation | `src/lib/validation`, domain `schema.ts` (e.g. `src/lib/scenarios/schema.ts`) | Zod schemas + `z.infer` types                                      |

Services are the authorization boundary — middleware/proxy and UI are not. A Server Component, Server Action, or worker calling a service gets the same checks.

## Service shape

Follow `scenario-service.ts`:

```ts
export async function createScenario(input: {
  organizationId: string; userId: string; facilityId: string; role: Role; body: unknown;
}) {
  assertRole(input.role, "scenarios:write");
  const facility = await getFacility(input.organizationId, input.userId, input.facilityId);
  if (!facility) throw new AppError("NOT_FOUND", "Facility not found.", 404);
  const parsed = scenarioWriteSchema.parse(input.body);
  const row = await insertScenario(input.organizationId, input.userId, { ... });
  return presentScenarioSummary(row);
}
```

- Inputs: trusted context (`organizationId`, `userId`, `role`) + untrusted `body`/`query` as `unknown`, parsed inside.
- `assertRole` / `roleCan` from `src/lib/permissions` first.
- Verify parent ownership (facility belongs to org) before touching children.
- Throw `AppError(code, safeMessage, status)` for expected failures.
- Return a `present*` DTO — never raw rows. Gate finance fields with `roleCan(role, "finance:read")`.
- Mark server-only with `import "server-only"` where appropriate.

## Transactions

- Multi-table writes (layout save, scenario config + results, audit record, job enqueue) are **one** transaction owned by the service, passed into repositories (`withTenant` gives a `TenantTx`).
- Roll back the whole unit on failure.
- Never hold a transaction open across an LLM/network call or long computation — compute first, then write.

## Idempotency and concurrency

- Retryable creates, scenario runs, uploads, worker jobs: define an idempotency policy **before** implementing. Key scoped by org + operation, request fingerprint stored, DB unique constraint. Same key + same input → prior result; same key + different input → 409.
- Versioned edits (`facility_layouts`) detect stale versions → 409; never overwrite.

## Request vs worker

Request path: bounded authenticated reads, short validated writes. Worker (`facilityiq-background-worker`): rollups, insight generation, large reports/imports, model processing.

## Business rules belong in pure libs

KPI formulas → `src/lib/analytics` (`facilityiq-analytics-kpis`); projections → `src/lib/scenarios` (`facilityiq-scenarios-projections`); insight rules → `src/lib/ai` (`facilityiq-insights-ai`). Services orchestrate: load samples via repositories → call pure function → persist/present.

## Growth

Split a large service into focused files in the same directory (`<domain>/`). Add a new service/repository/schema set for an independent domain. No microservices, second ORM, or parallel persistence layer.

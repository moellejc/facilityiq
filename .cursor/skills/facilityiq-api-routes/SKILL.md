---
name: facilityiq-api-routes
description: FacilityIQ HTTP API standards — route surface, withApi/withFacilityApi adapters, request lifecycle, HTTP method semantics, Zod parsing, pagination/filter/sort contract, error envelope and status codes, finance field gating, and 202 job responses. Use when creating or editing src/app/api/**/route.ts, designing endpoints, or changing request/response contracts.
---

# API Routes (FacilityIQ)

Source: Notion Coding Conventions §5, §14.

Whether the change should be a Route Handler at all: `nextjs-server-action-vs-route-handler`. File-level conflicts with `page.tsx`: `nextjs-app-router-route`. This skill stays the HTTP contract.

## Route handlers are thin adapters

They own: HTTP methods, context resolution, boundary parsing, response mapping. They must **not** contain Drizzle queries, KPI formulas, scenario rules, or orchestration — that's services (`facilityiq-services-and-domain-logic`).

Lifecycle: **session → org membership → permission → Zod parse → service → HTTP mapping**. Don't read a body before authenticating.

## Use the existing wrappers (`src/server/http.ts`)

```ts
export const dynamic = "force-dynamic";

// Org-level route
export const GET = withApi(async (request, context) => listThings({ ...context }));

// Facility-nested route: resolves context, asserts permission, validates [id], checks facility belongs to org
export const GET = withFacilityApi("operations:read", async (request, context, facilityId) =>
  getMetrics({
    organizationId: context.organizationId,
    userId: context.userId,
    role: context.role,
    facilityId,
    query: parseQuery(request),
  }),
);

export const POST = withApi(async (request, context) =>
  createScenario({ ...context, body: await readJson(request) }),
);
```

- `readJson` (`src/lib/api.ts`) converts malformed JSON to `VALIDATION_ERROR`.
- `toErrorResponse` maps `AppError`, `ZodError` → 400, unknown → logged + generic 500.
- `notImplemented("Feature")` for routed stubs of later phases (501).
- Query params: `request.nextUrl.searchParams` → Zod schema in `src/lib/validation` or the domain `schema.ts`.

## Route surface

Keep the specified resources: `/api/organizations`, `/api/facilities`, `/api/facilities/[id]`, `/api/facilities/[id]/{areas,assets,layout,metrics,financials,insights,analytics}`, `/api/scenarios`, `/api/scenarios/[id]`, `/api/scenarios/[id]/run`, `/api/scenarios/compare`, `/api/uploads`, `/api/reports`, plus `/api/auth/*` and `/api/health`. Nest under the facility; no RPC-style endpoints (`/getFacilityAssets`). Document new routes in `docs/ARCHITECTURE.md`.

## Method semantics

`GET` no side effects · `POST` create or explicit command (e.g. `/run`) · `PATCH` partial update · `DELETE` remove · `PUT` only if documented as full replacement. Unsupported methods → 405.

## Lists

- Positive integer `page`, `limit` (default `page=1`, `limit=25`, max **100**).
- Response `{ data, page, limit, total }`; `total` = same org-scoped filtered query, before pagination.
- Allowlist filter/sort fields and direction; stable secondary sort on `id`; never interpolate client strings into SQL.

## Errors

`{ error: { code, message } }` with `ErrorCode` from `src/lib/errors.ts`:

| Status | Code                                                    |
| ------ | ------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`                                      |
| 401    | `UNAUTHORIZED`                                          |
| 403    | `FORBIDDEN`                                             |
| 404    | `NOT_FOUND` (absent **or** other org's — same response) |
| 409    | `CONFLICT` (stale version, idempotency key reuse)       |
| 429    | `RATE_LIMITED` (+ `Retry-After`)                        |
| 501    | `NOT_IMPLEMENTED`                                       |
| 500    | `INTERNAL`                                              |

Never return raw `error.message`, SQL, or stacks. Log server-side with secrets redacted.

## Response DTOs

- Only authorized fields. Check `finance:read` **before** including cost/ROI.
- Preserve units, currency, time range, `unavailableReason`; keep `numeric` precision via an explicit serialization policy.
- Observed and projected values in separate fields.

## Long-running work

Validate + authorize, enqueue a `background_jobs` row in the same transaction, return **202** with a durable job reference. No fire-and-forget promises after responding. See `facilityiq-background-worker`.

## Runtime

Node runtime (Postgres/Drizzle/Auth.js). Await `params` (Promise) — `withFacilityApi` does this for `[id]`.

## Tests

Cover per `facilityiq-integration-testing`: missing session, forbidden role, malformed JSON, invalid IDs/query/body, safe error envelope, cross-org 404, list bounds and totals.

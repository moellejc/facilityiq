---
name: facilityiq-ui-states-and-forms
description: FacilityIQ standards for UI data states (loading, empty, unavailable, forbidden, not-found, error) and for forms and mutations (server validation, pending/error feedback, optimistic UI, idempotency). Use when building data views, dashboard panels, forms, dialogs, or any client-side mutation in FacilityIQ.
---

# UI States and Forms (FacilityIQ)

Source: Notion Coding Conventions §15–16 and §17 checklist.

## Every data view handles six states

| State       | Meaning                                                        | Treatment                                                                         |
| ----------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Loading     | Request in flight                                              | `loading.tsx` or Suspense + `Skeleton`; meaningful shape, not a spinner-only page |
| Empty       | Query succeeded, no rows                                       | Explain what would appear and how to get it                                       |
| Unavailable | Data exists but metric can't be computed (`unavailableReason`) | `unavailableLabel(...)`; show `—`, never `0`                                      |
| Forbidden   | Role lacks permission                                          | Safe message; don't render the gated data or its shape                            |
| Not found   | Absent or other org's resource                                 | `not-found.tsx`; identical to truly missing                                       |
| Failed      | Unexpected error                                               | `error.tsx` or inline error with retry; no stack traces                           |

Examples in code: `KpiCard` (unavailable), `TimeSeriesChart` → `EmptyChart` (empty), `TwinLoader` (loading + failed).

## Presentational vs container

- Presentational components: typed props in, UI + intent callbacks out. No fetching, no permission logic, no money math.
- Server pages load data via services. Client containers call authenticated API routes — never import services.
- Permission flags on the client only control presentation; the server enforces.

## Forms and mutations

- Primary mutation boundary: existing authenticated route handlers (`src/app/api/**`). Server Actions are an optional adapter — see `facilityiq-nextjs-app-router`.
- Browser validation is UX only. The server always Zod-validates and authorizes.
- Show pending state, field-safe error messages, and success feedback (`sonner` toast or inline).
- Catch network/event-handler errors explicitly — error boundaries don't catch async event failures.
- Parse the `{ error: { code, message } }` envelope; show `message`, branch on `code` (e.g. `CONFLICT` → "someone else changed this, reload").
- A disabled submit button is **not** an idempotency guarantee; the API owns that.
- Treat hidden inputs and bound IDs as untrusted.
- After success, refresh affected data (router refresh / refetch) and, if persistent caching is used, rely on server-side invalidation.

## Optimistic UI

- Must roll back or refetch on failure.
- Never optimistically show computed money, KPI results, or a queued scenario run as verified.

## Org / facility switching

On switch, clear selection, drafts, and in-flight responses so the previous tenant's data cannot flash. Reset pagination to page 1 when filters change.

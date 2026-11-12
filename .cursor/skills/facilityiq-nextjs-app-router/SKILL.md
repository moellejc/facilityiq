---
name: facilityiq-nextjs-app-router
description: FacilityIQ Next.js 16 App Router conventions — routing files, route groups, Server vs Client Components, async params/searchParams, metadata, proxy.ts, Server Actions as thin adapters, and Next 16 breaking-change cautions. Use when creating or editing pages, layouts, loading/error/not-found files, route groups, src/proxy.ts, Server Actions, or deciding where 'use client' goes.
---

# Next.js App Router (FacilityIQ)

Source: Notion Coding Conventions §1, §14–15, §18. Next.js is **16.4.x** with breaking changes — read `node_modules/next/dist/docs/` before using any API you haven't verified in this repo.

## Routing files

| File                    | Use in FacilityIQ                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `page.tsx`              | Server entry: `requireRequestContext()`, load via services, compose feature UI                                           |
| `layout.tsx`            | Persistent chrome (`src/components/layout/app-shell.tsx`). Not an authorization boundary; doesn't rerender on navigation |
| `template.tsx`          | Opt-in remount on segment change only (not search-param change)                                                          |
| `loading.tsx`           | Meaningful skeleton; wrap independently slow panels in Suspense                                                          |
| `error.tsx`             | Client error boundary with safe recovery (use the installed signature)                                                   |
| `not-found.tsx`         | Missing _or inaccessible_ resource after scoped lookup — never reveal another org's data exists                          |
| `route.ts`              | HTTP adapter under `src/app/api` only — see `facilityiq-api-routes`                                                      |
| `_components/`, `_lib/` | Route-private code; not a security mechanism; no business logic                                                          |

- Groups: `(auth)` for sign-in, `(dashboard)` for the signed-in shell. Don't add new top-level groups without updating `docs/ARCHITECTURE.md`.
- No `page.tsx` and `route.ts` at the same path.
- Auth gating at the edge lives in `src/proxy.ts` (Next 16's replacement for `middleware.ts`). It's an early guard only — services still enforce auth.

## Page pattern

Mirror existing pages (e.g. `src/app/(dashboard)/operations/throughput/page.tsx`):

```tsx
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const context = await requireRequestContext();
  const query = await searchParams; // Zod-parse before use
  return <FeatureView context={context} query={query} />;
}
```

- `params` and `searchParams` are Promises — await them and Zod-validate.
- Read page-specific search params in the page, not a layout.
- Server Components call services directly; never fetch your own API from the server.
- Fetch independent authorized panels in parallel after context resolution.

## Server vs Client Components

- Server by default. Put `'use client'` on the **smallest interactive leaf** (forms, selectors, Recharts, 3D). It pulls its whole import graph into the client bundle.
- Pass server content into client wrappers via `children` / slot props.
- Props crossing the boundary: minimal, serializable, authorized DTOs. Never sessions, repositories, DB handles, Three.js objects, or secret-bearing rows.
- Client components must not import `src/server/**` or `src/db/**`. The `server-only` package is installed but not yet imported anywhere; add `import "server-only"` to new server-only modules (services, repositories, storage, AI providers) so accidental client imports fail at build time.
- No async Client Components (`@next/next/no-async-client-component`). Async event handlers are fine.

## Metadata

Use `metadata` / `generateMetadata` or metadata files. Never `next/head`.

## Server Actions (`src/server/actions`)

Optional thin adapters for progressive-enhancement forms. Pattern from `src/server/actions/admin.ts`:

- `"use server"`; call `requireRequestContext()`; pass raw `FormData` values to the **same service** the API uses (the service Zod-parses and checks permissions).
- Return a safe `{ error?, ok? }` state; map only `AppError` messages, otherwise a generic message.
- `revalidatePath` the narrowest affected path after success.
- Never a read API, never a second business implementation. Hidden/bound IDs are untrusted.

## Segment config

`export const dynamic = "force-dynamic"` is the current pattern for authenticated pages and routes. Don't copy `revalidate` / `fetchCache` / cache directives without checking the caching model in `next.config.ts` — see `facilityiq-client-state-and-caching`.

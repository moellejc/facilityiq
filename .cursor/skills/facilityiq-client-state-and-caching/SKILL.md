---
name: facilityiq-client-state-and-caching
description: FacilityIQ state ownership and caching rules — where state lives (database, server components, URL params, cookies, local state, refs), org/facility switching, query keys, React.cache, Next.js persistent caching, revalidatePath/revalidateTag, and freshness. Use when adding client state, URL filters, providers, caching, revalidation, or deciding how data flows between server and client.
---

# Client State and Caching (FacilityIQ)

Source: Notion Coding Conventions §16.

## State ownership

| State                                           | Owner                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Durable domain data                             | Postgres via org-scoped services                                                                       |
| Initial page data                               | Server Components calling services directly (no same-app HTTP hop)                                     |
| Shareable filters (dates, facility, sort, page) | URL search params, Zod-parsed with defaults; preserve unrelated params; support back/refresh/bookmarks |
| Active org                                      | Validated session/cookie (`ORG_COOKIE`)                                                                |
| Active facility                                 | Validated cookie (`FACILITY_COOKIE`) or search param, re-checked against org every request             |
| Ephemeral UI                                    | Local `useState` / `useReducer` (modals, hover, selection IDs, layer toggles)                          |
| Per-frame 3D                                    | Refs + R3F frame loop                                                                                  |
| Cross-component client UI                       | Nearest common owner; narrow provider only if composition fails                                        |

- No global store duplicating server data. A new state library requires a demonstrated need and an architecture decision.
- Derive display values from props; don't copy server KPIs into React state.
- Never keep tenant context in a process-global mutable variable.
- Providers go as deep as possible around the subtree that needs them.

## Switching org / facility / filters

- Clear incompatible selection and drafts; discard stale in-flight responses so the previous tenant's data can't flash.
- Any client query key includes org, facility, date range, and effective filters.
- Reset to page 1 when filters change.

## Caching

- Authenticated tenant data is **request-time and uncached by default**. Current pages/routes use `export const dynamic = "force-dynamic"`.
- `React.cache` (used in `src/server/services/context.ts`) dedupes within **one request** only. Include explicit org/context/filter args; never memoize an authorization-free lookup.
- Drizzle queries aren't governed by `fetch` cache options. Use `cache: 'no-store'` for sensitive HTTP fetches.
- **Before** introducing any persistent cache, check `package.json`, lockfile, and `next.config.ts` for the active caching model (previous model vs opt-in Cache Components). Don't add `unstable_cache` or experimental directives because a guide mentions them.
- A persistent cache must document: authorized DTO scope, key (org/facility/date/filter), permission-sensitive projection, freshness budget, invalidation events, and revocation handling. Never share a finance-capable cached DTO with a role lacking `finance:read`.

## Invalidation

- After a committed mutation, invalidate the narrowest path/tag (`revalidatePath("/settings")`, not the whole app) using the installed signature, then refresh client data.
- Router refresh alone doesn't invalidate a persistent data cache.
- Worker-produced rollups need a documented freshness/invalidation handoff.
- Show last-updated / freshness where data can be stale; never treat a stale aggregate as proof of current permission.

## Observed vs projected

Keep baseline/observed and projected/estimated in separate fields across DTOs, state, and chart view models. Missing/zero-denominator results stay `null` + `unavailableReason`.

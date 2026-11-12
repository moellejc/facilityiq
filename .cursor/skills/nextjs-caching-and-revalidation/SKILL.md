---
name: nextjs-caching-and-revalidation
description: Next.js 16 cache and revalidation APIs for FacilityIQ (force-dynamic, revalidatePath, revalidateTag, updateTag) while Cache Components stay off. Use when calling revalidatePath or revalidateTag, or when someone proposes a persistent cache. Policy and state ownership stay in facilityiq-client-state-and-caching.
---

# Caching and revalidation

This skill is the Next.js mechanism. Who owns data, and whether it may be cached, is `facilityiq-client-state-and-caching`. Do not copy that state table here.

Installed Next.js is **16.4.5**. `next.config.ts` does not set `cacheComponents`. `docs/ARCHITECTURE.md` §17.5 records why: tenant pages are request-dynamic, and the scaffold flag was turned off so one organization's response is not reused for another. Dashboard pages set `export const dynamic = "force-dynamic"`.

## Which doc model applies

Two models are both in the current docs. This repo uses the one **without** Cache Components.

- [Caching (previous model)](https://nextjs.org/docs/app/guides/caching) opens with: it assumes you are not using Cache Components. `fetch` is uncached unless you pass `cache: 'force-cache'`. `export const dynamic = 'force-dynamic'` forces request-time rendering and is equivalent to `cache: 'no-store'` on `fetch` in that segment.
- Cache Components (`cacheComponents: true`, `'use cache'`, `cacheLife`, `cacheTag`) are opt-in. The version 16 guide says turning the flag on is not a rename of the old options: `dynamic`, `revalidate`, and `fetchCache` are removed when the flag is on, and uncached data outside a Suspense boundary fails the build. Source: [version 16 upgrade](https://nextjs.org/docs/app/guides/upgrading/version-16), [route segment config](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config).

Do not enable `cacheComponents` or add `'use cache'` in a product change. That is an architecture change with a tenancy review (`facilityiq-security-review`).

Three sources disagree about `unstable_cache` on the installed pin (`next@16.4.5`):

- The installed API page opens with: This API has been replaced by `use cache` in Next.js 16. The next sentence recommends opting into Cache Components and replacing `unstable_cache` with the `use cache` directive. Path: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md`.
- The installed migration guide says existing `unstable_cache` caching keeps working, migrating it is optional, and it continues to work with Cache Components. Path: `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`.
- The previous-model guide still documents `unstable_cache` for non-`fetch` work: https://nextjs.org/docs/app/guides/caching (fetched 2026-11-11).

**Not verified:** that this disagreement is a `deprecated[]` rule. The watcher quotes all three and does not add one. `'use cache'` belongs to Cache Components, which this app has off. Do not add `unstable_cache` either. Coding Conventions §16 and `facilityiq-client-state-and-caching` forbid it until a reviewed read-model policy exists. Drizzle is not governed by `fetch` cache options.

`React.cache` deduplicates inside one render, not across requests. Source: the same caching guide ("Deduplicating requests"). Pass the org and filters as arguments. It is not an authorization cache.

## On-demand revalidation

Call these from a Server Action or a Route Handler after the service commits. Not from a Client Component, and not from `src/proxy.ts`. Sources: [revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag), [revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath), [version 16 upgrade](https://nextjs.org/docs/app/guides/upgrading/version-16).

| Function                                      | Behavior in the Next 16 docs                                                                            | FacilityIQ use                                                                                                                                                                |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `revalidateTag(tag, 'max')`                   | Second argument is required. `'max'` is stale-while-revalidate. The single-argument form is deprecated. | Only after a persistent tag exists. Do not invent tags for uncached Drizzle reads                                                                                             |
| `revalidateTag(tag, { expire: 0 })`           | Next request waits. Use when `updateTag` is unavailable                                                 | Route Handler or webhook, if a tag exists                                                                                                                                     |
| `updateTag(tag)`                              | Server Actions only. Expires the tag and the action's response re-renders with fresh data               | Same constraint: only for a real tag                                                                                                                                          |
| `revalidatePath(path)`                        | Invalidates that path. Literal paths omit the second argument                                           | Narrowest path that changed, for example `revalidatePath("/settings")`                                                                                                        |
| `revalidatePath(pattern, 'page' \| 'layout')` | Required when `path` contains a dynamic segment. `'layout'` also invalidates nested pages               | A single facility or tenant. Not the whole app                                                                                                                                |
| `refresh()` from `next/cache`                 | Refetches the current route's RSC payload from a Server Action without invalidating cached data         | Nothing in `src/` imports it. `router.refresh()` in `src/components/insights/insight-actions.tsx` is the client router helper and does not invalidate a persistent data cache |

`revalidatePath('/', 'layout')` purges the client cache and invalidates cached data for the whole tree. Source: [revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath). `src/server/actions/settings.ts` calls that today for an organization rename. Do not copy it for a new mutation. New code uses the narrowest path. A finance DTO must not be reused for a role without `finance:read` (`facilityiq-client-state-and-caching`).

Route Handlers are uncached by default. Only `GET` can opt in, for example with `export const dynamic = 'force-static'`. Other methods are not cached. Source: [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers). Authenticated tenant handlers stay `force-dynamic`, matching `facilityiq-api-routes`.

## Guard rules

No id in `.cursor/guardrails.json` checks cache keys, `revalidatePath`, or `cacheComponents`. `docs/guardrails.md` lists cache keys as advisory.

Related ids, explained in `nextjs-app-router-route`: `gssp` (do not reach for Pages Router data fetching to "turn off caching") and `sync-params`. `public-secret` still forbids `NEXT_PUBLIC_` secrets if a cache key is built from env.

`pnpm guard:drift` compares `verifiedAgainst.next` (`"16"`) to the installed major. A caching API change that breaks these signatures is an upgrade: `nextjs-upgrade-assistant`.

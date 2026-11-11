---
name: nextjs-app-router-route
description: Decide which App Router files a new FacilityIQ segment needs (page, layout, loading, error, route) and which guard rules those files must satisfy. Use when adding a URL, a route segment, or a route group. Does not replace facilityiq-nextjs-app-router or facilityiq-api-routes.
---

# App Router route files

Use this skill to pick files. Implement them with `facilityiq-nextjs-app-router` (pages and layouts) or `facilityiq-api-routes` (HTTP). Do not copy those skills' page or handler patterns into the new files from memory.

Installed Next.js is **16.4.5** (`package.json`). Facts below are from the stable nextjs.org pages linked here. Re-read `node_modules/next/dist/docs/` before relying on a signature; that tree matches the installed tarball. If it disagrees with nextjs.org, the installed tree wins and the disagreement is marked.

## Pick one public entry

A segment is public only when it has a `page` or `route` file. Other files in the folder are not routes. Parentheses in `(auth)` and `(dashboard)` are omitted from the URL. A folder prefixed with `_` is private. Source: [project structure](https://nextjs.org/docs/app/getting-started/project-structure).

| You are adding                     | File                                 | Then follow                                                                              |
| ---------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------- |
| A screen                           | `src/app/.../page.tsx`               | `facilityiq-nextjs-app-router`                                                           |
| Shared chrome for a subtree        | `layout.tsx` in that segment         | Same skill. A layout is not an authorization boundary and does not remount on navigation |
| An HTTP endpoint                   | `src/app/api/.../route.ts`           | `facilityiq-api-routes`                                                                  |
| A remount when the segment changes | `template.tsx` only if you need that | Same App Router skill. Search-param changes do not remount a template                    |

Do not put `page.tsx` and `route.ts` in the same segment. Next.js treats that as a conflict, and one `route` or `page` file owns every HTTP method for that URL. Source: [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers).

FacilityIQ HTTP lives under `src/app/api`. Do not add a `route.ts` next to a dashboard page to "also expose JSON".

## Loading, error, and not-found

Next.js lists `loading`, `error`, `not-found`, and `global-error` as optional file conventions, not as files the compiler requires. Source: [project structure](https://nextjs.org/docs/app/getting-started/project-structure). **Unverified:** any claim that a missing `loading.tsx` or `error.tsx` fails `next build`. There is no guard rule for those files.

FacilityIQ still wants the six data states in `facilityiq-ui-states-and-forms`. Use `loading.tsx` or a Suspense boundary for a slow segment, `not-found.tsx` after a scoped lookup, and `error.tsx` when that segment should recover from a render error.

`error.tsx` is a Client Component (`'use client'`). It wraps the segment's page, loading, and not-found UI. It does not wrap the `layout.tsx` in the same segment; root-layout failures use `global-error.tsx`, which must render its own `<html>` and `<body>`. The published convention's props are `error` and `retry` (`retry` stable since 16.3.0). `reset` remains for a re-render that does not re-fetch. Source: [error file convention](https://nextjs.org/docs/app/api-reference/file-conventions/error). **Unverified against this install:** that the generated types name the prop `retry` rather than only `reset`. Confirm in `node_modules/next/dist/docs/` or with `pnpm typecheck` before writing the component. Do not log `error.message` from a Server Component into the UI; production forwards a generic message plus `error.digest`.

## Params, metadata, and the client boundary

These are enforced. The how-to is in `facilityiq-nextjs-app-router`:

- `params` and `searchParams` are Promises. Await them. Read page search params in the page, not in a layout.
- Head metadata is `metadata` / `generateMetadata` or a metadata file. Not `next/head`.
- Server Components are the default. `'use client'` goes on the smallest interactive leaf.
- The page calls a service. It does not import Drizzle, `@/db`, or a repository, and it does not `fetch` this app's own Route Handler. Source: [backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend) (a server `fetch` to your own handler is an extra HTTP hop, and it fails at build time when the page is prerendered because no server is listening).

## Guard rules

Ids in `.cursor/guardrails.json`. `pnpm guard` fails new matches. Behavior is described in `docs/guardrails.md`.

| Id                         | What a new segment must not do                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `gssp`                     | `getServerSideProps`, `getStaticProps`, `getInitialProps`                                                  |
| `next-router`              | `next/router` (use `next/navigation`)                                                                      |
| `next-head`                | `next/head`                                                                                                |
| `sync-params`              | A `params` or `searchParams` prop typed as a plain object                                                  |
| `async-client`             | `export default async function` in a file that has `'use client'`                                          |
| `route-or-page-imports-db` | `drizzle-orm`, `@/db`, or `pg` from `page.tsx`, `layout.tsx`, or `route.ts`                                |
| `ui-imports-repository`    | `@/server/repositories/` from a page, layout, or component                                                 |
| `client-imports-server`    | A client file importing services, repositories, `@/db`, `drizzle-orm`, `pg`, `@aws-sdk/`, or `server-only` |

`legacy-image` (`next/legacy/image`) is the same file's rule for images. `facilityiq-ui-design-system` explains it. This skill does not.

No rule requires `loading.tsx` or `error.tsx`. Cache ownership is also unenforced; see `nextjs-caching-and-revalidation`.

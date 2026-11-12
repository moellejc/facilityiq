---
name: nextjs-server-action-vs-route-handler
description: Choose a FacilityIQ Route Handler or a Server Action for a mutation or read, then hand off to the skill that implements it. Use when adding a form submit, a button mutation, a webhook, or an HTTP endpoint. Does not replace facilityiq-api-routes or facilityiq-nextjs-app-router.
---

# Server Action or Route Handler

Pick the adapter here. Write it with `facilityiq-api-routes` (Route Handlers) or the Server Actions section of `facilityiq-nextjs-app-router`. Both stay thin: auth, Zod, one service call. Business rules stay in the service (`facilityiq-services-and-domain-logic`).

Installed Next.js is **16.4.5** (`package.json`). Facts below are from the stable nextjs.org pages linked here. Re-read `node_modules/next/dist/docs/` before relying on a signature; that tree matches the installed tarball. If it disagrees with nextjs.org, the installed tree wins and the disagreement is marked.

## Decision

FacilityIQ's primary mutation boundary is the authenticated Route Handler. A Server Action is an extra, optional adapter for a UI form, and only when progressive enhancement is a deliberate choice. It calls the **same service** as the route. It is not a second implementation and it is not a read API. Source: Coding Conventions §16, condensed in `facilityiq-ui-states-and-forms`.

Next.js, on top of that:

| Need                                                                                                                              | Adapter                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser or other client needs a stable HTTP contract (`GET`/`POST`/`PATCH`/`DELETE`), including the documented `/api/...` surface | Route Handler. `facilityiq-api-routes`                                                                                                                                                                                                                                                      |
| Webhook, third-party callback, or non-UI caller                                                                                   | Route Handler. Route Handlers are public HTTP endpoints. Source: [backend for frontend](https://nextjs.org/docs/app/guides/backend-for-frontend)                                                                                                                                            |
| Server Component needs data                                                                                                       | Call the service. Do not `fetch` your own Route Handler, and do not use a Server Action as the read. Source: same guide; [mutating data](https://nextjs.org/docs/app/getting-started/mutating-data)                                                                                         |
| UI-only form, progressive enhancement chosen, and a Route Handler already (or also) calls that service                            | Server Action in `src/server/actions`, `"use server"`, `requireRequestContext()`, same service, safe `{ error?, ok? }`                                                                                                                                                                      |
| Several parallel reads from the client                                                                                            | Not several Server Actions. The client dispatcher runs actions one at a time. Parallelize inside one action, or fetch from a Server Component, or use a Route Handler for a non-mutation request. Source: [Server Actions and mutations](https://nextjs.org/docs/app/guides/server-actions) |

Server Functions are invoked with `POST` and are reachable as a direct POST, not only from the UI. Authorize inside every action. Source: [mutating data](https://nextjs.org/docs/app/getting-started/mutating-data). Hidden and bound ids are untrusted input.

A client component calls an action or an authenticated API. It does not import a service. `'use client'` files may import `@/server/actions` (guard rule `client-imports-server`).

## What not to duplicate

- Method list, `withApi` / `withFacilityApi`, status codes, and the error envelope: `facilityiq-api-routes`.
- The `"use server"` skeleton and `revalidatePath`: `facilityiq-nextjs-app-router`. Which cache function to call: `nextjs-caching-and-revalidation`.
- Pending, field errors, and optimistic UI: `facilityiq-ui-states-and-forms`. Do not show computed money or a queued scenario as a verified result.
- Unsupported HTTP methods on a Route Handler return 405. If `OPTIONS` is omitted, Next.js implements it and sets `Allow`. Source: [route.js](https://nextjs.org/docs/app/api-reference/file-conventions/route).

Existing actions to mirror, not to fork: `src/server/actions/settings.ts` and the other files in that directory.

## Guard rules

Ids in `.cursor/guardrails.json`. Nothing in that file chooses an action over a route. These rules apply once you have chosen.

| Id                         | Applies to                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `route-or-page-imports-db` | No Drizzle, `@/db`, or `pg` in `route.ts`                                                              |
| `route-imports-repository` | No `@/server/repositories/` from `src/app/api/**/route.ts`                                             |
| `raw-error-to-client`      | No `error.message` or `error.stack` in a JSON body under `src/app/api`                                 |
| `sync-params`              | `params` on a route handler is a Promise                                                               |
| `client-imports-server`    | Client files reach the server through `@/server/actions` or HTTP, not through services or the database |
| `public-secret`            | No `NEXT_PUBLIC_` name that looks like a secret. Explained in `facilityiq-security-review`             |

Server Actions are not scanned by `route-imports-repository` or `raw-error-to-client` (those globs are `src/app/api/**`). Still do not import a repository or return a raw exception. Map `AppError` only, as `facilityiq-nextjs-app-router` describes.

Role checks and org filters are not guard failures. `docs/guardrails.md` lists them as advisory. The service still enforces both.

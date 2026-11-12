# Guardrails

Mechanical checks for the FacilityIQ standards in Notion (Coding Conventions, Unit Test Standards, CI Process, SDLC Best Practices, GitFlow) and the in-repo skills. `pnpm guard` fails on **new** violations in the diff. It does not replace format, lint, typecheck, or tests.

## Run

```bash
pnpm guard:test      # self-tests (node:test, no install)
pnpm guard           # this diff against origin/main
pnpm guard:baseline  # inventory existing src debt; always exits 0
pnpm guard:drift     # installed Next/React/Drizzle still match the rules
```

`GUARD_SCOPE` is `default` (product files), `finance-route` (the cost-by-category slice), or `infra` (workflows, guards, hooks). Leave it unset and an infra-only diff selects `infra`. A diff that also touches product code stays on `default`, so a product change cannot quietly edit CI.

`finance-route` allows the finance pages, `src/components/finance/**`, `src/components/dashboard/facility-analytics.tsx` (the view those pages render), and `src/components/layout/app-shell.tsx` (the breadcrumb label map, including a new finance slug). It does not allow `src/app/api/**`.

## What is enforced

| Check                                                                                                                                               | Standard                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Routes and pages do not import Drizzle or `@/db`                                                                                                    | Coding Conventions §3, §14; GitFlow §6                                           |
| Components do not import `@/db`, `drizzle-orm`, or `pg` (`component-imports-db`). No allowlist exception                                            | Coding Conventions §3, §15                                                       |
| API routes do not import repositories                                                                                                               | Coding Conventions §3, §14                                                       |
| Pages, layouts, and components do not import repositories                                                                                           | Coding Conventions §3, §15                                                       |
| Repositories do not import services or `src/app`                                                                                                    | Coding Conventions §3, §14                                                       |
| `'use client'` does not import services, repositories, db, or `server-only`. `@/server/actions` is allowed                                          | Coding Conventions §14–§16                                                       |
| No `getServerSideProps` / `getStaticProps` / `getInitialProps`, `next/router`, `next/head`, `next/legacy/image`                                     | Coding Conventions §15, §17                                                      |
| `params` and `searchParams` are Promises                                                                                                            | Coding Conventions §14, §16                                                      |
| No async Client Component render                                                                                                                    | Coding Conventions §15, §17                                                      |
| No `NEXT_PUBLIC_` secret names                                                                                                                      | Coding Conventions §8; GitFlow §6; CI Process §1                                 |
| API responses do not return raw `error.message` or stacks                                                                                           | Coding Conventions §5, §14; SDLC §4                                              |
| No new `.toFixed(` in `src/app` or `src/components`                                                                                                 | Coding Conventions §9, §11; Unit Test Standards §3; SDLC §4                      |
| Logic changes in services, repositories, `src/lib`, route handlers, server actions, and `worker/**` come with a test file; no `.only` / empty tests | Unit Test Standards §2, §5, §7; SDLC §2                                          |
| Protected paths (workflows, lockfile, secret env files, the guard itself)                                                                           | CI Process §1; Coding Conventions §8                                             |
| Dependency version changes need `GUARD_ALLOW_DEPS=1`                                                                                                | Coding Conventions §2                                                            |
| pnpm version comes only from `packageManager`                                                                                                       | CI Process §2 (the Enable pnpm step was failing when `version: 10` was also set) |

The shell hook denies force-push, `gh pr merge`, tags, and workflow dispatch (GitFlow §5.5 and §7). The read hook denies `.env` (Coding Conventions §8) and allows `.env.example`.

Existing debt is ratcheted by fingerprint (rule + source line), not by count. Each finding is fingerprinted by rule and source line, with whitespace collapsed. A line that already exists for that rule on the base branch is not reported again. A different line fails even when the count stays the same, including a hit that replaces an earlier one or is inserted above the baseline hits. On current main that includes 6 API routes that import repositories and 12 `.toFixed(` calls in UI (`src/app` and `src/components`). `pnpm guard:baseline` lists the full inventory, including pages and `facility-analytics.tsx` that import repositories, and exits 0.

`component-imports-db` forbids `@/db`, `drizzle-orm`, and `pg` under `src/components/**`, including Server Components. There is no allowlist exception. No file under `src/components` currently imports those modules, so nothing is baselined for this rule. Client files may import `@/server/actions` only (`client-imports-server`). Services, repositories, and `@/db` stay forbidden. A client file that imports the database fails both rules.

## What stays advisory

These are still review and test rules. The guard does not fail them:

- Tenancy and RLS (Coding Conventions §7, GitFlow §6, Unit Test Standards §2). A repository diff without an obvious isolation test is a **warning** only.
- Server-side RBAC, including `viewer` read-only and `finance:read` (Coding Conventions §6, Unit Test Standards §4, SDLC §4 and §8).
- Deterministic KPI, money, and scenario math, and working without `AI_API_KEY` (Coding Conventions §11–§12, GitFlow §6, SDLC §5).
- Linear Backlog-first intake (Linear workflow §1–§3 and §7). The delivery spec is `automations/slack-linear-agent-pr.md`.
- Whether an applied migration was rewritten, versus a new migration added (Coding Conventions §4).
- Cache keys, idempotency, and list contracts (Coding Conventions §14 and §16).
- Whether a worker test asserts org scoping, idempotent retry, and the failure path. `logic-without-tests` only requires that a `worker/**` change include some `tests/**/*.test.ts` file in the diff (`facilityiq-background-worker`).

## Demo the failure

`demo/bad-change.patch` is a fixture. Do not commit it applied.

On a clean `main` (no other diff), this is the whole demo:

```bash
git apply demo/bad-change.patch
pnpm guard
git apply -R demo/bad-change.patch
```

On a branch that also changes guardrail files, limit the file list so the report is only the bad page:

```bash
git apply demo/bad-change.patch
GUARD_FILES='src/app/(dashboard)/finance/cost-by-category/page.tsx,src/components/finance/cost-chart.tsx' pnpm guard
git apply -R demo/bad-change.patch
```

The patch is expected to fail on Pages Router APIs, sync `params`, `.toFixed(`, Drizzle imports, and a client component that imports a service.

`bash demo/run-guard-demo.sh` does that check on a throwaway worktree of `origin/main`, then applies `demo/fixed-change.patch` to the same files and expects `pnpm guard` to exit 0. It deletes the worktree before it exits. Do not commit the patched `src` files. The pass/fail transcript is in `demo/README.md`. `bash demo/with-vs-without.sh` compares one route-add prompt with and without skills, guards, and `AGENTS.md`. A key in the environment does not start the agent. `DEMO_RUN_AGENT=1` does, with `--sandbox enabled`, a scrubbed environment, and the fail-closed shell and read hooks restored first. The stop hook stays off the stripped checkout. The live agent is not part of CI.

## Drift watcher

The Cursor Automation spec is `automations/nextjs-drift-watcher.md`. Joe creates it in the Cursor UI. It only opens pull requests. It never merges and never pushes to `main`. Those pull requests target `main` until `develop` exists.

The weekly mechanical check is already the `drift` job in `.github/workflows/guardrails.yml` (cron `0 13 * * 1`, command `node scripts/guard/drift-check.mjs`). The automation does not add a second copy of that job.

`demo/drift-watcher/` is a **SIMULATED** deprecation fixture (`unstable_cache` discouraged in favor of `"use cache"`). That claim is **not verified** and is not a real Next.js deprecation. The dry run does not edit `.cursor/guardrails.json`.

```bash
node scripts/drift-watcher/run-demo.mjs
```

That writes `demo/drift-watcher/SIMULATED.diff`, `SIMULATED-deprecated-entry.json`, and `SAMPLE-PR.md`. Apply and revert are documented in `demo/drift-watcher/README.md`. Do not commit an applied checkout.

Three sources disagree, so this is not a `deprecated[]` rule. The guard-rule decision is **not verified**.

- Installed `next@16.4.5` API page: This API has been replaced by `use cache` in Next.js 16 (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md`).
- Installed migration guide: existing `unstable_cache` caching keeps working and migrating it is optional (`node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`).
- Previous-model guide, fetched 2026-11-11: still documents `unstable_cache` for non-`fetch` functions. https://nextjs.org/docs/app/guides/caching

## Not exercised in CI

- Cursor does not run `.cursor/hooks.json` inside GitHub Actions. The self-tests pipe sample JSON at the hook scripts. That is not a live Cursor session.
- The deploy-gate job in `.github/workflows/guardrails.yml` prints a mocked gate. It does not deploy. Production remains `workflow_dispatch` with `deploy_production=true` (GitFlow §5.5).
- Cursor Automations are specs under `automations/`. Joe creates them in the Cursor UI. Nothing in this repo proves one is live. Slack posting from an automation is not verified.
- The monolithic **FacilityIQ Standards** automation is split into five specs under `automations/facilityiq-standards*.md` (hub, Coding Conventions, Unit Test Standards, CI Process, SDLC). Index: [`automations/facilityiq-standards.md`](../automations/facilityiq-standards.md). They are not live until Joe creates them and disables the old combined automation.
- `scripts/cursor-api/launch-agent.mjs` is UNTESTED against a live `CURSOR_API_KEY`. Its local tests never call `api.cursor.com`.
- The shell hook denies `gh pr merge` and force-push. It does not pattern-match a plain `git push` of `main`. Agents still must not push to `main`. That push is a process rule, not a hook match.
- Cursor Automations are not created by this repository. `demo/with-vs-without.sh` can launch the local Cursor CLI only when `DEMO_RUN_AGENT=1` and a Cursor API key are both set. That live run is not part of CI. Otherwise the script labels it "not verified". It does not call the Cloud Agents API.
- The drift watcher spec is committed. The Cursor Automation itself is not created in this repository. Joe creates it in the Cursor UI. No Cloud Agents API launcher is added here.

## GitFlow deviation

GitFlow says feature PRs target `develop`. This repository has no `develop` branch. Do not create it. Guards and pull requests target `main` until a maintainer adds `develop`. Say that in the PR's GitFlow target section.

## First PR

Follow `.cursor/skills/facilityiq-first-contribution` or the `/first-pr` command. The PR body is `.github/pull_request_template.md` (GitFlow §9.2). The draft hero ticket is `docs/tickets/HERO-FAIQ-cost-by-category.md`. It was not filed in Linear.

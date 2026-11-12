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

## What is enforced

| Check                                                                                                           | Standard                                                                         |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Routes and pages do not import Drizzle or `@/db`                                                                | Coding Conventions §3, §14; GitFlow §6                                           |
| API routes do not import repositories                                                                           | Coding Conventions §3, §14                                                       |
| Pages, layouts, and components do not import repositories                                                       | Coding Conventions §3, §15                                                       |
| Repositories do not import services or `src/app`                                                                | Coding Conventions §3, §14                                                       |
| `'use client'` does not import services, repositories, db, or `server-only`. `@/server/actions` is allowed      | Coding Conventions §14–§16                                                       |
| No `getServerSideProps` / `getStaticProps` / `getInitialProps`, `next/router`, `next/head`, `next/legacy/image` | Coding Conventions §15, §17                                                      |
| `params` and `searchParams` are Promises                                                                        | Coding Conventions §14, §16                                                      |
| No async Client Component render                                                                                | Coding Conventions §15, §17                                                      |
| No `NEXT_PUBLIC_` secret names                                                                                  | Coding Conventions §8; GitFlow §6; CI Process §1                                 |
| API responses do not return raw `error.message` or stacks                                                       | Coding Conventions §5, §14; SDLC §4                                              |
| No new `.toFixed(` in `src/app` or `src/components`                                                             | Coding Conventions §9, §11; Unit Test Standards §3; SDLC §4                      |
| Logic changes come with a test; no `.only` / empty tests                                                        | Unit Test Standards §2, §5, §7; SDLC §2                                          |
| Protected paths (workflows, lockfile, secret env files, the guard itself)                                       | CI Process §1; Coding Conventions §8                                             |
| Dependency version changes need `GUARD_ALLOW_DEPS=1`                                                            | Coding Conventions §2                                                            |
| pnpm version comes only from `packageManager`                                                                   | CI Process §2 (the Enable pnpm step was failing when `version: 10` was also set) |

The shell hook denies force-push, `gh pr merge`, tags, and workflow dispatch (GitFlow §5.5 and §7). The read hook denies `.env` (Coding Conventions §8) and allows `.env.example`.

Existing debt is ratcheted. On current main that includes 6 API routes that import repositories and 12 `.toFixed(` calls in UI (`src/app` and `src/components`). Editing those files does not fail unless the count goes up. `pnpm guard:baseline` lists the full inventory, including pages and `facility-analytics.tsx` that import repositories, and exits 0.

## What stays advisory

These are still review and test rules. The guard does not fail them:

- Tenancy and RLS (Coding Conventions §7, GitFlow §6, Unit Test Standards §2). A repository diff without an obvious isolation test is a **warning** only.
- Server-side RBAC, including `viewer` read-only and `finance:read` (Coding Conventions §6, Unit Test Standards §4, SDLC §4 and §8).
- Deterministic KPI, money, and scenario math, and working without `AI_API_KEY` (Coding Conventions §11–§12, GitFlow §6, SDLC §5).
- Linear Backlog-first intake (Linear workflow §1–§3 and §7). The delivery spec is `automations/slack-linear-agent-pr.md`.
- Whether an applied migration was rewritten, versus a new migration added (Coding Conventions §4).
- Cache keys, idempotency, and list contracts (Coding Conventions §14 and §16).

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

`bash demo/run-guard-demo.sh` does that check on a throwaway worktree of `origin/main`, then applies `demo/fixed-change.patch` to the same files and expects `pnpm guard` to exit 0. It deletes the worktree before it exits. Do not commit the patched `src` files. The pass/fail transcript is in `demo/README.md`. `bash demo/with-vs-without.sh` compares one route-add prompt with and without skills, guards, and `AGENTS.md`. A key in the environment does not start the agent. `DEMO_RUN_AGENT=1` does, with `--sandbox enabled`, a scrubbed environment, and the fail-closed hooks restored first. The live agent is not part of CI.

## Not exercised in CI

- Cursor does not run `.cursor/hooks.json` inside GitHub Actions. The self-tests pipe sample JSON at the hook scripts. That is not a live Cursor session.
- The deploy-gate job in `.github/workflows/guardrails.yml` prints a mocked gate. It does not deploy. Production remains `workflow_dispatch` with `deploy_production=true` (GitFlow §5.5).
- Cursor Automations are specs under `automations/`. Joe creates them in the Cursor UI. Nothing in this repo proves one is live. Slack posting from an automation is not verified.
- `scripts/cursor-api/launch-agent.mjs` is UNTESTED against a live `CURSOR_API_KEY`. Its local tests never call `api.cursor.com`.
- The shell hook denies `gh pr merge` and force-push. It does not pattern-match a plain `git push` of `main`. Agents still must not push to `main`. That push is a process rule, not a hook match.
- Cursor Automations are not created by this repository. `demo/with-vs-without.sh` can launch the local Cursor CLI only when `DEMO_RUN_AGENT=1` and a Cursor API key are both set. That live run is not part of CI. Otherwise the script labels it "not verified". It does not call the Cloud Agents API.

## GitFlow deviation

GitFlow says feature PRs target `develop`. This repository has no `develop` branch. Do not create it. Guards and pull requests target `main` until a maintainer adds `develop`. Say that in the PR's GitFlow target section.

## First PR

Follow `.cursor/skills/facilityiq-first-contribution` or the `/first-pr` command. The PR body is `.github/pull_request_template.md` (GitFlow §9.2). The draft hero ticket is `docs/tickets/HERO-FAIQ-cost-by-category.md`. It was not filed in Linear.

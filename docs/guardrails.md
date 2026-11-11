# Guardrails

Mechanical checks for the FacilityIQ standards in Notion (Coding Conventions, Unit Test Standards, CI Process, SDLC Best Practices, GitFlow) and the in-repo skills. `pnpm guard` fails on **new** violations in the diff. It does not replace format, lint, typecheck, or tests.

## Run

```bash
pnpm guard:test      # self-tests (node:test, no install)
pnpm guard           # this diff against origin/main
pnpm guard:baseline  # inventory existing src debt; always exits 0
pnpm guard:drift     # installed Next/React/Drizzle still match the rules
```

`GUARD_SCOPE` is `default` (product files), `finance-route` (the cost-by-category slice), or `infra` (workflows, guards, hooks, and `automations/`). Leave it unset and an infra-only diff selects `infra`. A diff that also touches product code stays on `default`, so a product change cannot quietly edit CI. `automations/**` is on the infra allow list so the review spec is in scope. That entry does not change the ratchet.

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
- Linear Backlog-first intake (Linear workflow §1–§3 and §7).
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

## PR guardrail review

Spec: [`automations/pr-guardrail-review.md`](../automations/pr-guardrail-review.md).

Joe creates the automation in the Cursor UI (`cursor.com/automations` or `/automate`). **It is not live until he does.** This repository does not create or enable it. GitHub Actions does not post the comment.

On **Pull request opened** for `moellejc/facilityiq`, the agent runs the guard scripts from `origin/main` (`git archive origin/main scripts/guard`) and posts one comment. Pull request copies of those scripts are not executed. `scripts/guard/format-review-comment.mjs` turns that stdout into the comment: verdict, each finding with its rule id and skill doc, and a tests-actually-run table. A result this run did not produce is `not verified`. Staff Eng is the `*` owner in `origin/main:.github/CODEOWNERS` (`@moellejc`). The agent does not approve, merge, or close.

`Draft opened` is a different Cursor trigger and is not selected. Fork pull requests are not supported.

```bash
tmp=$(mktemp -d)
GUARD_BASE=origin/main node scripts/guard/pre-pr.mjs > "$tmp/report.md"
git show origin/main:.github/CODEOWNERS > "$tmp/CODEOWNERS"
node scripts/guard/format-review-comment.mjs --report "$tmp/report.md" --codeowners "$tmp/CODEOWNERS" --ref "$(git rev-parse HEAD)"
```

## Not exercised in CI

- Cursor does not run `.cursor/hooks.json` inside GitHub Actions. The self-tests pipe sample JSON at the hook scripts. That is not a live Cursor session.
- The deploy-gate job in `.github/workflows/guardrails.yml` prints a mocked gate. It does not deploy. Production remains `workflow_dispatch` with `deploy_production=true` (GitFlow §5.5).
- The pull-request comment automation is the spec in `automations/pr-guardrail-review.md`. Joe creates it in the Cursor UI. It is not live until he does, and this workflow does not run it. Cursor does not run that trigger on fork pull requests. `Draft opened` is a separate trigger and is not selected.

## GitFlow deviation

GitFlow says feature PRs target `develop`. This repository has no `develop` branch. Do not create it. Guards and pull requests target `main` until a maintainer adds `develop`. Say that in the PR's GitFlow target section.

## First PR

Follow `.cursor/skills/facilityiq-first-contribution` or the `/first-pr` command. The PR body is `.github/pull_request_template.md` (GitFlow §9.2). The draft hero ticket is `docs/tickets/HERO-FAIQ-cost-by-category.md`. It was not filed in Linear.

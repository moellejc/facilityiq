---
name: facilityiq-first-contribution
description: Guided path for a new FacilityIQ engineer's first PR. Use when someone says it is their first change, asks where to start, or is picking up a good-first-issue. Loads the domain skills, runs the guard, and writes the GitFlow section 9.2 PR body.
---

# First contribution (FacilityIQ)

Goal: one clean PR that follows the written standards without reading the whole codebase.

Source of truth: Notion FacilityIQ Engineering Standards, condensed in the other `facilityiq-*` skills and in `AGENTS.md`. If this skill and those disagree, stop and flag it. Do not edit `.cursor/guardrails.json` to make a check pass.

## 1. Orient

1. Read `AGENTS.md` (workflow table and ground rules). Do not read the whole repo.
2. Open the Linear ticket (FAIQ-n). Confirm the type (Feature, Bug, or Improvement) and the acceptance criteria. Backlog-first intake is the written rule (Linear workflow). It is not mechanically enforced.
3. Copy the shape of the closest existing page. For a finance page, start from `src/app/(dashboard)/finance/cost-per-order/page.tsx` and `src/components/dashboard/facility-analytics.tsx`.

## 2. Plan before code

Post this in the draft PR or on the ticket:

- Layers: page or route, then service, then repository, then schema. Name each file.
- Permission string (`finance:read`, and so on). `viewer` never mutates. The guard does not prove this.
- Tenancy: how `organizationId` reaches every query. The guard does not prove this.
- The test that fails without the change.
- Files you will not touch: workflows, hooks, `scripts/guard`, the lockfile, applied migrations. If you need one, stop and ask a human (`GUARD_SCOPE=infra`).

## 3. Branch and scope

GitFlow section 3 says: branch `feature/<ticket>-<slug>` (agents: `feature/cursor-<slug>`) from `develop`, and open the PR into `develop`.

This repository has no `develop` branch. Do not create it. Branch from `main` and open the PR into `main`, and say that in the GitFlow target section. Cloud agents in this environment also have to use the branch prefix that environment requires (`cursor/<slug>-<suffix>`). That prefix is a known deviation from GitFlow section 8.

For the cost-by-category ticket, export `GUARD_SCOPE=finance-route`. Otherwise leave the scope unset and let `pnpm guard` pick `default` or `auto`.

## 4. Build with the matching skills

Load `facilityiq-feature-development` and the domain skills the files touch (`AGENTS.md` table). For a finance page that includes `facilityiq-nextjs-app-router`, `facilityiq-analytics-kpis`, and `facilityiq-unit-testing`.

When the change adds a URL, pick files with `nextjs-app-router-route`, then follow `facilityiq-nextjs-app-router` or `facilityiq-api-routes`. When it mutates data, pick the adapter with `nextjs-server-action-vs-route-handler`. Cache policy stays in `facilityiq-client-state-and-caching`. Next.js function signatures are in `nextjs-caching-and-revalidation`. A Next.js version bump is not a first PR. It is `nextjs-upgrade-assistant`, and it does not merge.

## 5. Before saying done

1. `pnpm guard` is green. Fix findings. Do not weaken `.cursor/guardrails.json`.
2. Run the checks in `facilityiq-pr-readiness`. Tick a box only for a command that ran.
3. Write the PR body from `.github/pull_request_template.md` (GitFlow section 9.2).
4. Stop. A human reviews and merges. Do not merge, tag, or dispatch a deploy.
5. `automations/pr-guardrail-review.md` is the spec for a Cursor Automation that comments once and requests Staff Eng review (the `*` owner in `.github/CODEOWNERS`). It is not live until Joe creates it in the Cursor UI. It never approves, merges, or closes.

## Patterns the guard already rejects

`getServerSideProps` (`gssp`), `next/router` (`next-router`), `next/head` (`next-head`), `next/legacy/image` (`legacy-image`), sync `params` (`sync-params`), async Client Components (`async-client`), Drizzle, `@/db`, or `pg` in routes or pages (`route-or-page-imports-db`) and in `src/components` (`component-imports-db`), repository imports from routes or pages (`route-imports-repository`, `ui-imports-repository`), client components importing services (`client-imports-server`; Server Actions in `@/server/actions` are allowed), `toFixed` in UI (`adhoc-tofixed`), raw `error.message` to clients (`raw-error-to-client`). The ids are keys in `.cursor/guardrails.json`. `nextjs-app-router-route` explains the App Router ones.

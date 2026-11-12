# Demo fixtures

These files are demo fixtures. They are not product code. Do not apply `demo/bad-change.patch` or `demo/fixed-change.patch` to `main`, and do not commit the `src` files they create. `demo/run-guard-demo.sh` applies them only inside a throwaway worktree of `origin/main` and deletes that worktree before it exits.

This is not the FAIQ-36 cost-by-category feature. The patches use those paths only so the guard has a bad page and a client chart to reject. The fixed patch makes those same two files pass `pnpm guard`. It does not calculate a cost. The chart receives an em dash, which is how a missing value is displayed. There is no service, repository, or test in the fix, because the guard's test-strength check only runs when a logic file changes.

The guard scripts are not modified here. The transcript below is from `origin/main` at `2bc1dfa` (`Merge pull request #14 from moellejc/cursor/facilityiq-standards-split-315d`). On that commit, `scripts/guard/lib.mjs` fingerprints each finding by rule and source line, with whitespace collapsed.

Next.js links in the finding map were read from nextjs.org and match `node_modules/next/dist/docs` for `next@16.4.5`. Pages Router links document the APIs the bad patch uses. App Router links are the replacement. Codemod commands are the ones in the Next.js 16 upgrade guide shipped with that package.

## What is here

| File                 | Role                                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `bad-change.patch`   | Already on `main`. Deliberately wrong Next.js. `pnpm guard` exits 1.                                                       |
| `fixed-change.patch` | Delta on top of the bad patch. The same files then pass `pnpm guard`.                                                      |
| `run-guard-demo.sh`  | Apply-check, fail, fix, pass, revert.                                                                                      |
| `prompt.md`          | A small dock-status route request. Not the cost-by-category ticket.                                                        |
| `with-vs-without.sh` | Two checkouts, one with skills, guards, hooks, and `AGENTS.md`, one without. The live agent also needs `DEMO_RUN_AGENT=1`. |
| `doc-map.sh`         | Rule id to doc link. Sourced by the scripts.                                                                               |

`.cursor/rules` stays in both checkouts. `demo/` is removed from both so this bad patch is not sitting in the agent's checkout. The checkouts are separate clones, not linked worktrees. A key already in the shell does not start the agent. `DEMO_RUN_AGENT=1` does. That run uses `--sandbox enabled`, a temporary `HOME`, and only `CURSOR_API_KEY` from the parent environment. Fail-closed shell and read hooks are copied back onto the stripped checkout before the agent starts. The stop hook is not, so a checkout without the guard scripts does not get a fix-every-error follow-up. Skills, `AGENTS.md`, `guardrails.json`, and `scripts/guard` stay absent there. `bash demo/with-vs-without.test.sh` covers that gate with a fake `agent` binary. The real CLI was not executed.

## Run

```bash
bash demo/run-guard-demo.sh
bash demo/with-vs-without.sh
```

The second script runs the Cursor CLI only when `DEMO_RUN_AGENT=1`, a Cursor API key is set, and `agent` is on `PATH`. It never prints the key and never puts it on the command line. The Cloud Agents API is not called: it targets a remote ref and can open a pull request, so it cannot compare a locally stripped checkout.

## Guard transcript

Command: `bash demo/run-guard-demo.sh` on 2026-11-12, against `origin/main` `2bc1dfa7afb7369ad9d27e7af9fbc26b6c15116e`. The temp worktree path is created by `mktemp` and changes every run. Exit code of the script: 0. Exit code of `pnpm guard` on the bad patch: 1 (9 error rows). Exit code after `fixed-change.patch`: 0.

```text
FacilityIQ demo fixtures. Not product code. Not for main.
Guard under test: pnpm guard (package.json -> node scripts/guard/pre-pr.mjs)
Recorded against origin/main 2bc1dfa — Merge pull request #14 from moellejc/cursor/facilityiq-standards-split-315d
The guard scripts in that commit are not modified by this demo.

=== apply check ===
Preparing worktree (detached HEAD 2bc1dfa)
verified: bad-change.patch applies to origin/main, and fixed-change.patch applies on top
Preparing worktree (detached HEAD 0e212f8)
verified: bad-change.patch applies to HEAD, and fixed-change.patch applies on top

Preparing worktree (detached HEAD 2bc1dfa)
=== apply bad-change.patch on origin/main ===
worktree: /tmp/tmp.sPw5miJDkL
rev: 2bc1dfa7afb7369ad9d27e7af9fbc26b6c15116e

=== bad change: pnpm guard on origin/main ===

> facilityiq@0.1.0 guard /tmp/tmp.sPw5miJDkL
> node scripts/guard/pre-pr.mjs

## FacilityIQ pre-PR guard
New violations only. Each finding is fingerprinted by rule and source line, with whitespace collapsed. A line that already exists for that rule on the base branch is not reported again. A different line fails even when the count stays the same, including a hit that replaces an earlier one or is inserted above the baseline hits.
Checked 2 file(s). **9 error(s), 0 warning(s).**

### fail: Boundaries (scope: default)
| Level | Rule | Where | Why / fix |
|---|---|---|---|
| error | `route-or-page-imports-db` | `src/app/(dashboard)/finance/cost-by-category/page.tsx:3` | Routes and pages are thin. No Drizzle or SQL here. Call one service. (imports "@/db") (Coding Conventions §3 and §14; GitFlow §6) Skill: `facilityiq-api-routes`. |
| error | `route-or-page-imports-db` | `src/app/(dashboard)/finance/cost-by-category/page.tsx:4` | Routes and pages are thin. No Drizzle or SQL here. Call one service. (imports "@/db/schema") (Coding Conventions §3 and §14; GitFlow §6) Skill: `facilityiq-api-routes`. |
| error | `client-imports-server` | `src/components/finance/cost-chart.tsx:2` | A 'use client' file must not import services, repositories, the database, or server-only modules. Server Actions in @/server/actions are the allowed adapter. Pass serializable props from a Server Component. (imports "@/server/services/analytics-service") (Coding Conventions §14–§16; GitFlow §6) Skill: `facilityiq-nextjs-app-router`. |

### fail: Deprecated APIs and anti-patterns
| Level | Rule | Where | Why / fix |
|---|---|---|---|
| error | `gssp` | `src/app/(dashboard)/finance/cost-by-category/page.tsx:7` | Pages Router data fetching. Use an async Server Component that calls a service. (Coding Conventions §15 and §17) Skill: `facilityiq-nextjs-app-router`. |
| error | `next-router` | `src/app/(dashboard)/finance/cost-by-category/page.tsx:1` | next/router is Pages Router. Use next/navigation. (Coding Conventions §15 and §17) Skill: `facilityiq-nextjs-app-router`. |
| error | `next-head` | `src/app/(dashboard)/finance/cost-by-category/page.tsx:2` | next/head is Pages Router. Use the metadata API or generateMetadata. (Coding Conventions §15 and §17) Skill: `facilityiq-nextjs-app-router`. |
| error | `sync-params` | `src/app/(dashboard)/finance/cost-by-category/page.tsx:12` | In Next 16, params and searchParams are Promises. Type them as Promise<...> and await them. (Coding Conventions §14 and §16) Skill: `facilityiq-nextjs-app-router`. |
| error | `adhoc-tofixed` | `src/app/(dashboard)/finance/cost-by-category/page.tsx:17` | Format numbers with src/lib/format.ts or src/lib/analytics/display.ts. Missing values render as an em dash, never 0. (Coding Conventions §9 and §11; Unit Test Standards §3; SDLC Best Practices §4) Skill: `facilityiq-ui-design-system`. |
| error | `async-client` | `src/components/finance/cost-chart.tsx:4` | Async Client Component. Keep data fetching in a Server Component. Async event handlers are fine. (Coding Conventions §15 and §17) Skill: `facilityiq-nextjs-app-router`. |

### Test strength
No findings.

_Static checks only. This does not replace format, lint, typecheck, unit or integration tests, or human review. Tenancy, RBAC, deterministic KPI math, and Linear Backlog-first intake are advisory._
 ELIFECYCLE  Command failed with exit code 1.
exit: 1

=== bad change: finding -> rule -> doc ===
finding: src/app/(dashboard)/finance/cost-by-category/page.tsx:3
  level: error
  rule: route-or-page-imports-db
  doc: .cursor/skills/facilityiq-api-routes/SKILL.md
  doc: .cursor/skills/facilityiq-services-and-domain-logic/SKILL.md
  doc: docs/guardrails.md

finding: src/app/(dashboard)/finance/cost-by-category/page.tsx:4
  level: error
  rule: route-or-page-imports-db
  doc: .cursor/skills/facilityiq-api-routes/SKILL.md
  doc: .cursor/skills/facilityiq-services-and-domain-logic/SKILL.md
  doc: docs/guardrails.md

finding: src/components/finance/cost-chart.tsx:2
  level: error
  rule: client-imports-server
  doc: https://nextjs.org/docs/app/api-reference/directives/use-client
  doc: https://nextjs.org/docs/app/getting-started/server-and-client-components
  doc: .cursor/skills/facilityiq-nextjs-app-router/SKILL.md
  doc: docs/guardrails.md

finding: src/app/(dashboard)/finance/cost-by-category/page.tsx:7
  level: error
  rule: gssp
  doc: https://nextjs.org/docs/pages/building-your-application/data-fetching/get-server-side-props
  doc: https://nextjs.org/docs/app/getting-started/server-and-client-components
  doc: https://nextjs.org/docs/app/guides/upgrading/version-16
  doc: .cursor/skills/facilityiq-nextjs-app-router/SKILL.md
  doc: docs/guardrails.md
  codemod: pnpm dlx @next/codemod@canary upgrade latest

finding: src/app/(dashboard)/finance/cost-by-category/page.tsx:1
  level: error
  rule: next-router
  doc: https://nextjs.org/docs/app/api-reference/functions/use-router
  doc: https://nextjs.org/docs/app/guides/upgrading/version-16
  doc: .cursor/skills/facilityiq-nextjs-app-router/SKILL.md
  doc: docs/guardrails.md

finding: src/app/(dashboard)/finance/cost-by-category/page.tsx:2
  level: error
  rule: next-head
  doc: https://nextjs.org/docs/pages/api-reference/components/head
  doc: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
  doc: https://nextjs.org/docs/app/getting-started/metadata-and-og-images
  doc: .cursor/skills/facilityiq-nextjs-app-router/SKILL.md
  doc: docs/guardrails.md

finding: src/app/(dashboard)/finance/cost-by-category/page.tsx:12
  level: error
  rule: sync-params
  doc: https://nextjs.org/docs/app/guides/upgrading/version-16
  doc: https://nextjs.org/docs/app/api-reference/file-conventions/dynamic-routes
  doc: .cursor/skills/facilityiq-nextjs-app-router/SKILL.md
  doc: docs/guardrails.md
  codemod: npx @next/codemod@canary next-async-request-api .

finding: src/app/(dashboard)/finance/cost-by-category/page.tsx:17
  level: error
  rule: adhoc-tofixed
  doc: .cursor/skills/facilityiq-ui-design-system/SKILL.md
  doc: docs/guardrails.md

finding: src/components/finance/cost-chart.tsx:4
  level: error
  rule: async-client
  doc: https://nextjs.org/docs/app/api-reference/directives/use-client
  doc: https://nextjs.org/docs/app/getting-started/server-and-client-components
  doc: .cursor/skills/facilityiq-nextjs-app-router/SKILL.md
  doc: docs/guardrails.md


bad-change error rows: 9

=== apply fixed-change.patch (same files) ===

=== fixed change: pnpm guard on origin/main ===

> facilityiq@0.1.0 guard /tmp/tmp.sPw5miJDkL
> node scripts/guard/pre-pr.mjs

## FacilityIQ pre-PR guard
New violations only. Each finding is fingerprinted by rule and source line, with whitespace collapsed. A line that already exists for that rule on the base branch is not reported again. A different line fails even when the count stays the same, including a hit that replaces an earlier one or is inserted above the baseline hits.
Checked 2 file(s). **0 error(s), 0 warning(s).**

### Boundaries (scope: default)
No findings.

### Deprecated APIs and anti-patterns
No findings.

### Test strength
No findings.

_Static checks only. This does not replace format, lint, typecheck, unit or integration tests, or human review. Tenancy, RBAC, deterministic KPI math, and Linear Backlog-first intake are advisory._
exit: 0

=== fixed change: finding -> rule -> doc ===
(no error or warning rows)


=== revert ===
reverted: fixture paths are gone. origin/main was not left patched, and this checkout was not patched.
demo result: bad change exited non-zero, fixed change exited 0.
```

## Same prompt with vs without setup

Live agent: **not verified.** No `CURSOR_API_KEY` or `CURSOR_SERVICE_ACCOUNT_KEY` was set, and this script did not call the Cursor CLI or the Cloud Agents API. A later check with a fake `agent` binary and a synthetic key confirmed that the key alone does not start the agent; see `demo/with-vs-without.test.sh`. The real CLI was not executed. The checkout difference below was produced by the script itself.

Command: `bash demo/with-vs-without.sh` on 2026-11-11. Script exit code: 0.

```text
FacilityIQ demo: same prompt with vs without setup.
Not product code. The live agent is opt-in and is not part of CI.
Prompt file: demo/prompt.md

=== checkouts (verified by this script, before any live agent) ===
setup with-setup:
  present: AGENTS.md
  present: .cursor/skills
  present: .cursor/hooks
  present: .cursor/hooks.json
  present: .cursor/guardrails.json
  present: scripts/guard
  present: .cursor/rules (intentionally not stripped; both trees keep the rules)

setup without-setup:
  absent:  AGENTS.md
  absent:  .cursor/skills
  absent:  .cursor/hooks
  absent:  .cursor/hooks.json
  absent:  .cursor/guardrails.json
  absent:  scripts/guard
  present: .cursor/rules (intentionally not stripped; both trees keep the rules)

=== live agent ===
No CURSOR_API_KEY or CURSOR_SERVICE_ACCOUNT_KEY in the environment.
Live agent: not verified.
This script does not read a key from the repository, and a key already in
the environment is not permission to start the agent.

To run the same prompt in both checkouts:

  1. Install the Cursor CLI: curl https://cursor.com/install -fsS | bash
     Docs: https://cursor.com/docs/cli/headless
  2. Export CURSOR_API_KEY in your shell. Do not commit it. Do not pass it
     with --api-key (that puts the secret on the command line).
  3. Re-run: DEMO_RUN_AGENT=1 bash demo/with-vs-without.sh

DEMO_RUN_AGENT=1 is required in addition to the key. The agent is then
started with --sandbox enabled and a scrubbed environment (PATH, a temporary
HOME, TMPDIR, LANG, and CURSOR_API_KEY only). Fail-closed shell and read
hooks are restored on the stripped checkout before that command. The stop
hook is not, because that checkout has no guard scripts. Skills, AGENTS.md,
guardrails.json, and scripts/guard stay absent there.

The Cloud Agents API (POST https://api.cursor.com/v1/agents) launches against
a remote git ref and can open a pull request. It cannot see a locally stripped
checkout, so this comparison uses the local CLI only. This script does not
call that API.

Set DEMO_KEEP_WORKTREES=1 to inspect the two checkouts instead of deleting them.

Guard comparison of agent output: not verified (no live-agent edits to scan).
```

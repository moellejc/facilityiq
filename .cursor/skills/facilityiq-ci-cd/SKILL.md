---
name: facilityiq-ci-cd
description: FacilityIQ CI/CD standards — GitHub Actions ci.yml and deploy.yml, required PR check order, Postgres service, minimum permissions, main-branch Docker build, vulnerability scan, guarded GHCR publish, staging stub, and honest reporting of pipeline results. Use when editing .github/workflows, the Dockerfile, CI checks, or reporting CI/deploy status.
---

# CI/CD (FacilityIQ)

Source: Notion CI Process §1–3, §6–7.

## PR pipeline (`.github/workflows/ci.yml`)

Runs on `pull_request`, push to `main`, and `workflow_call`. Order:

1. `pnpm install --frozen-lockfile` (Node 22; pnpm version from `package.json` `packageManager`, currently pnpm 10). Do not also set `version` on `pnpm/action-setup`.
2. `pnpm format:check`
3. `pnpm lint`
4. `pnpm typecheck` (`next typegen && tsc --noEmit`)
5. `pnpm test:unit`
6. PostgreSQL 16 service container
7. `pnpm db:migrate`
8. `pnpm test:integration`
9. `pnpm build`
10. Playwright smoke — skipped if no `tests/e2e/**/*.spec.ts`

A PR isn't mergeable while any required check fails. Keep lint, typecheck, and build as **distinct** steps — a build doesn't run every lint rule, and none of them prove tenancy or authorization.

## Main pipeline (`deploy.yml`)

Runs on push to `main` and `workflow_dispatch`:

| Job          | What it does                                                                                                                                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checks`     | Reuses `ci.yml` via `workflow_call`                                                                                                                                                                                           |
| `image`      | `docker build --target runner` (multi-stage `Dockerfile`: deps → builder → runner); `pnpm audit --audit-level=high \|\| true`; Trivy image scan (`exit-code: "0"`); GHCR publish only if `vars.ENABLE_GHCR_PUBLISH == 'true'` |
| `staging`    | Only if `vars.STAGING_DEPLOY_ENABLED == 'true'`; echo stub, no hosting target                                                                                                                                                 |
| `production` | Only on manual dispatch with `deploy_production: true`; **refuses and exits 1** — no target configured                                                                                                                        |

Notes:

- Both vulnerability scans are currently **non-blocking** (they report, never fail). Making them blocking is a standards decision.
- `packages: write` is granted only on the `image` job. The workflow default is `contents: read`.
- The image scan uses `aquasecurity/trivy-action@v0.36.0`. `v0.28.0` depends on `aquasecurity/setup-trivy@v0.2.1`, and that tag no longer exists, so the `image` job fails while resolving actions. `v0.36.0` pins `setup-trivy` to commit `3fb12ec` (`v0.2.6`). Do not move the scan back to a release that references a missing `setup-trivy` tag.
- No automatic production deploy. Production needs an explicit target and approval configuration.

## Workflow rules

- Minimum permissions: `contents: read` by default; `packages: write` only on the publishing job.
- No secrets committed or echoed. CI env values in `ci.yml` are throwaway test values — never reuse them elsewhere.
- Pin action major versions; keep `concurrency` cancel-in-progress.
- Pin `aquasecurity/trivy-action` to a release whose `action.yaml` pins `aquasecurity/setup-trivy` by commit SHA. `v0.28.0` references the deleted tag `setup-trivy@v0.2.1` and fails in "Set up job" before the scan runs. Current pin: commit `ed142fd0673e97e23eac54620cfb913e5ce36c25` (`v0.36.0`), which uses `setup-trivy@3fb12ec12f41e471780db15c232d5dd185dcb514` (`v0.2.6`). Keep `exit-code: "0"` so the scan stays non-blocking.
- Take the pnpm version only from `package.json` `packageManager`. Do not also set `version` on `pnpm/action-setup`; that action fails when both are present.
- `.github/workflows/guardrails.yml` is an extra pull-request and weekly workflow (guard self-tests, `pnpm guard` equivalent, a mocked deploy gate, drift). It does not replace the check order above. Notion CI Process does not mention it yet. The weekly mechanical check is the `drift` job (`node scripts/guard/drift-check.mjs` on cron `0 13 * * 1`). The Cursor Automation spec at `automations/nextjs-drift-watcher.md` opens pull requests from release notes. It does not add a second copy of that job. Joe creates the automation in the Cursor UI.
- Keep CI env in sync with `.env.example` and `vitest.integration.config.ts` when adding variables.
- Changing step order or removing a check needs a standards decision — update Notion CI Process and this skill.

## Lint configuration

Run the repo's actual ESLint config (`eslint.config.mjs`, `eslint-config-next`). Don't silence warnings wholesale. Don't claim rules exist that you haven't verified in the installed config.

## Reporting

Report only what actually ran: job, step, result. Say explicitly when Playwright was skipped or GHCR publish was guarded off. **Never** report a passing pipeline, published image, or deployment you didn't observe, and never invent a deployment URL.

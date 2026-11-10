---
name: facilityiq-ci-cd
description: FacilityIQ CI/CD standards — GitHub Actions ci.yml and deploy.yml, required PR check order, Postgres service, minimum permissions, main-branch Docker build, vulnerability scan, guarded GHCR publish, staging stub, and honest reporting of pipeline results. Use when editing .github/workflows, the Dockerfile, CI checks, or reporting CI/deploy status.
---

# CI/CD (FacilityIQ)

Source: Notion CI Process §1–3, §6–7.

## PR pipeline (`.github/workflows/ci.yml`)

Runs on `pull_request`, push to `main`, and `workflow_call`. Order:

1. `pnpm install --frozen-lockfile` (pnpm 10, Node 22)
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
- `packages: write` is currently granted at **workflow level**, while the standard says only the publishing job should have it. Flag this when touching `deploy.yml`; moving it to the `image` job is the compliant fix.
- No automatic production deploy. Production needs an explicit target and approval configuration.

## Workflow rules

- Minimum permissions: `contents: read` by default; `packages: write` only on the publishing job.
- No secrets committed or echoed. CI env values in `ci.yml` are throwaway test values — never reuse them elsewhere.
- Pin action major versions; keep `concurrency` cancel-in-progress.
- Keep CI env in sync with `.env.example` and `vitest.integration.config.ts` when adding variables.
- Changing step order or removing a check needs a standards decision — update Notion CI Process and this skill.

## Lint configuration

Run the repo's actual ESLint config (`eslint.config.mjs`, `eslint-config-next`). Don't silence warnings wholesale. Don't claim rules exist that you haven't verified in the installed config.

## Reporting

Report only what actually ran: job, step, result. Say explicitly when Playwright was skipped or GHCR publish was guarded off. **Never** report a passing pipeline, published image, or deployment you didn't observe, and never invent a deployment URL.

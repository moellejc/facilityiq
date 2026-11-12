---
name: facilityiq-ci-process
description: FacilityIQ GitHub Actions CI and deploy workflow process — PR checks, main branch jobs, secrets, and what agents must run locally. Use when changing CI, Docker, or release-related files.
---

# FacilityIQ CI process

## Workflows

| Workflow | File                           | Trigger                                           | Purpose                                                                                                                 |
| -------- | ------------------------------ | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| CI       | `.github/workflows/ci.yml`     | `pull_request`, `push` to `main`, `workflow_call` | Format, lint, typecheck, unit tests, migrate, integration tests against Postgres 16 service                             |
| Deploy   | `.github/workflows/deploy.yml` | `push` to `main`, manual `workflow_dispatch`      | Reuses CI, builds production Docker image, optional GHCR publish, staging stub, **refuses** automatic production deploy |

Concurrency: CI cancels in-progress runs on the same ref; deploy does not cancel in-progress deploys.

Permissions stay minimal (`contents: read` by default). `deploy.yml` still grants `packages: write` at workflow level; the standard is to grant it only on the publishing job.

## Local parity (run before opening a PR)

```bash
pnpm format:check   # or pnpm format
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm db:migrate     # against test DB when needed
pnpm test:integration
```

CI installs with `pnpm install --frozen-lockfile` on Node 22. The pnpm version comes only from `packageManager` in `package.json` (pnpm 10). Do not also set `version` on `pnpm/action-setup`; that action fails when both are present. Lockfile drift fails the job — commit lockfile updates intentionally.

## Database in CI

- Service: `postgres:16` with user/db `facilityiq` / `facilityiq_test`.
- Env mirrors `.env.example` test names: `DATABASE_URL`, `DATABASE_MIGRATE_URL`, `DATABASE_URL_TEST`, plus Auth and S3 placeholders.
- Migrations run **before** integration tests. Never rewrite applied migration files to “fix” CI; add a forward migration.

## Deploy / release rules

- Production image build: `docker build --target runner`.
- GHCR publish is gated on `vars.ENABLE_GHCR_PUBLISH`.
- Staging hook gated on `vars.STAGING_DEPLOY_ENABLED` and does not imply production.
- Production job only on explicit `workflow_dispatch` with `deploy_production=true`, and currently **exits 1** until a real host is configured. Do not add silent auto-deploy to production.

## Secrets and tokens

- CI uses disposable `AUTH_SECRET` and local Postgres passwords — not production secrets.
- Never commit `.env`, cloud keys, or `AI_API_KEY` values.
- Pushing workflow file changes requires a GitHub token with the `workflow` scope.

## Agent expectations

- Prefer small PRs so CI stays fast and reviewable.
- If you change workflows, Dockerfiles, or migrate scripts, run the same checks CI runs and report results in the PR.
- Playwright smoke may be skipped-if-absent; do not mark the workflow as green for e2e that did not run.

---
name: facilityiq-local-env-config
description: FacilityIQ local development and configuration standards — docker compose stack (app, worker, postgres, minio), local Postgres setup, .env.example as the env var registry, database role URLs, secrets handling, Zod env validation, AI_API_KEY optional, and SEED_ON_BOOT. Use when setting up the project locally, adding or changing environment variables, editing compose.yaml, docker/, or .env.example.
---

# Local Environment and Config (FacilityIQ)

Source: Notion CI Process §4, Coding Conventions §8. Details from `compose.yaml`, `.env.example`, `README.md`.

## Running locally

```bash
docker compose up --build    # app :43123, worker, postgres :5432, minio :9000/:9001
```

The app entrypoint (`docker/dev-entrypoint.sh`) migrates and seeds (`SEED_ON_BOOT=true`). No cloud account required. Without Docker, follow `README.md` (local psql roles + `facilityiq_test` DB, `pnpm install`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`).

## Environment variables

`.env.example` is the registry — **every** variable is documented there with a comment. Copy to `.env`; never commit real values.

| Variable                  | Purpose                                                                                                                                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | App role `facilityiq_app` (RLS enforced) — the app must use this                                                                                                                                                |
| `DATABASE_MIGRATE_URL`    | Superuser for migrations/seed (bypasses RLS)                                                                                                                                                                    |
| `DATABASE_URL_WORKER`     | Worker role (BYPASSRLS)                                                                                                                                                                                         |
| `DATABASE_URL_TEST`       | Integration test DB                                                                                                                                                                                             |
| `AUTH_SECRET`, `AUTH_URL` | Auth.js                                                                                                                                                                                                         |
| `S3_*`                    | Object storage (MinIO locally)                                                                                                                                                                                  |
| `AI_API_KEY`              | Optional; app must work empty                                                                                                                                                                                   |
| `SEED_ON_BOOT`            | Compose seeds on start                                                                                                                                                                                          |
| `CURSOR_API_KEY`          | Optional operator credential. Commented out in `.env.example`. The app, worker, Compose, and CI do not read it. Only `scripts/cursor-api/launch-agent.mjs` does, and that helper is UNTESTED against a live key |

## Adding a variable

1. Add to `.env.example` with a comment (purpose, required/optional, safe local value).
2. Validate with Zod where it's read (server-only module); fail fast with a clear message.
3. Add to `compose.yaml` services that need it, `ci.yml` env, and `vitest.integration.config.ts` if tests need it.
4. Document in `README.md` if it affects setup.

`CURSOR_API_KEY` is not an application variable. Leave it commented in `.env.example`. Do not add it to `compose.yaml`, `ci.yml`, or the Zod app env. The Next.js app must not require it.

## Secrets

- Env vars only. **No `NEXT_PUBLIC_` secrets**; DB URLs and AI keys never reach client bundles.
- Local passwords in `.env.example` / `0001_rls.sql` are dev-only — rotate before any shared deployment.
- Never log secrets or full connection strings.

## Ports

App `43123`, Postgres `5432`, MinIO API `9000`, console `9001`.

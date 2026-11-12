# FacilityIQ

Multi-tenant facility operations and cost intelligence for Acme Manufacturing. Signed-in users can explore the seeded West Distribution Center as a procedural 3D model built from the stored layout and assets. KPI charts, insight rules, and scenario projections are calculated from stored metrics. The full scenario editor UI is deferred; scenario mutations are available over the API. Pages that are not ready say so. They do not invent performance numbers.

No GitHub repository was created by this setup. The workflows in `.github/workflows` are ready for a repository named `facilityiq`.

## What you need

- Node.js 22
- pnpm 10 (`corepack enable`)
- PostgreSQL 16

Docker is optional. `docker compose up --build` is the path that starts the app, worker, Postgres, and MinIO together.

## Demo accounts

Organization: **Acme Manufacturing**  
Facility: **West Distribution Center**  
Password for every account: `FacilityIQ-demo-2026`

| Email                   | Role                       |
| ----------------------- | -------------------------- |
| admin@acme.example      | Organization administrator |
| operations@acme.example | Operations manager         |
| finance@acme.example    | Finance manager            |
| viewer@acme.example     | Viewer                     |

The seed is deterministic. It deletes Acme Manufacturing and writes the same facility, 598 assets, 30 days of metrics (ending 2026-11-01 UTC), alerts, six insights, and three scenarios. Password hashes are salted, so they are not byte-identical across runs. The password is.

Settings is the signed-in person's profile. Organization administrators also see **Admin** after Settings in the sidebar. That page renames the organization, changes member roles, adds an existing account, removes access, and adds, updates, or removes facilities and integration records. Integration records do not store credentials and do not run a sync. The last organization administrator cannot be removed or demoted.

## Run with Docker

```bash
cp .env.example .env
docker compose up --build
```

The app listens on [http://localhost:43123](http://localhost:43123). The entrypoint migrates and seeds. MinIO is on ports 9000 (API) and 9001 (console), user `facilityiq`, password `facilityiq-dev-secret`.

`docker compose` uses the development image so the Next.js server reloads when source files change. The `runner` stage in the Dockerfile is the production image (`node server.js`).

## Run without Docker

Create the databases with a PostgreSQL superuser. The names match `.env.example`.

```bash
psql -d postgres -c "CREATE USER facilityiq WITH PASSWORD 'facilityiq_dev' SUPERUSER;"
psql -d postgres -c "CREATE DATABASE facilityiq OWNER facilityiq;"
psql -d postgres -c "CREATE DATABASE facilityiq_test OWNER facilityiq;"
```

If those roles or databases already exist, skip the statements that fail.

```bash
corepack enable
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [http://localhost:43123](http://localhost:43123) and sign in with a demo account. The dashboard calculates throughput, utilization, cost, and bottleneck counts from stored metrics. Change the From and To dates and choose Apply. Open Facilities → 3D Digital Twin and turn on Heatmap to color objects that have a sample for the selected range. Layout editing stays on Facilities → Layouts and does not change data.

Insights are under Insights. An administrator or operations manager regenerates them from the selected period. Finance managers and viewers can read the stored rows. With no `AI_API_KEY`, only the deterministic rules run. A rule that can calculate a maintenance excess labels it as an estimate. Open “Show in the 3D twin” on an insight, or use `/facilities/twin?select=asset:<asset-id>&from=2026-10-03&to=2026-11-01` (or `select=area:<area-id>`). The twin selects that object and lists related insights in the side panel. Selecting an object in the twin does the same.

Scenarios are listed under Scenarios (read-only summary). Create, run, compare, duplicate, and delete through the API. Sign in as `operations@acme.example`, then:

```bash
# List
curl -sS -b cookies.txt http://127.0.0.1:43123/api/scenarios

# Create (example: extend hours)
curl -sS -b cookies.txt -H 'content-type: application/json' \
  -d '{"name":"Add one hour","configuration":{"kind":"extend_operating_hours","parameters":{"additionalHoursPerDay":1}}}' \
  http://127.0.0.1:43123/api/scenarios

# Run, duplicate, compare to baseline, delete
curl -sS -b cookies.txt -X POST "http://127.0.0.1:43123/api/scenarios/<id>/run?from=2026-10-03&to=2026-11-01"
curl -sS -b cookies.txt -X POST "http://127.0.0.1:43123/api/scenarios/<id>?action=duplicate"
curl -sS -b cookies.txt "http://127.0.0.1:43123/api/scenarios/compare?left=<id>&from=2026-10-03&to=2026-11-01"
curl -sS -b cookies.txt -X DELETE "http://127.0.0.1:43123/api/scenarios/<id>"
```

Projection formulas are in `docs/SCENARIOS.md`. Projected dollars are modeled estimates.

`pnpm db:migrate` creates the restricted roles `facilityiq_app` and `facilityiq_worker` with the local passwords in `.env.example`. The Next.js app should use `DATABASE_URL` (the app role) so row-level security applies. Migrations and the seed use `DATABASE_MIGRATE_URL` (the superuser) because seeding an organization and bypassing RLS for the load requires it.

In another terminal:

```bash
pnpm worker
```

The worker dequeues `background_jobs`. A `noop` job is marked succeeded. Other job types are marked failed with “not implemented” so they do not spin. It also tries to create the MinIO bucket and continues if object storage is down.

## Tests

```bash
pnpm test:unit
pnpm test:integration
pnpm lint
pnpm typecheck
pnpm build
```

Integration tests use `DATABASE_URL_TEST` and apply migrations themselves. They need the `facilityiq` superuser from the commands above.

## Useful scripts

| Script                  | Purpose                         |
| ----------------------- | ------------------------------- |
| `pnpm dev`              | Next.js on port 43123           |
| `pnpm db:migrate`       | Apply Drizzle migrations        |
| `pnpm db:seed`          | Replace the Acme demo data      |
| `pnpm worker`           | Process background jobs         |
| `pnpm test:unit`        | Permissions, KPI formulas, Zod  |
| `pnpm test:integration` | Isolation, integrity, RLS, seed |
| `pnpm guard`            | New boundary and API violations |
| `pnpm guard:test`       | Guard self-tests                |

## Layout

Business rules live in `src/server/services`, `src/server/repositories`, and `src/lib`. Route handlers and React components call those modules. KPI definitions are in `docs/KPI_FORMULAS.md`. The architecture plan and the Phase 1 exceptions are in `docs/ARCHITECTURE.md`. Pre-PR guardrails are in `docs/guardrails.md`. The Slack → Linear → pull request flow is specified in `automations/slack-linear-agent-pr.md` and `bot/approval-flow.md`. FacilityIQ Standards PR auditors (split by Notion page) are specified in `automations/facilityiq-standards.md`. `node scripts/cursor-api/launch-agent.mjs --help` prints the Cloud Agents helper. That helper is UNTESTED against a live key.

## Local development passwords

The database roles created by the migration use passwords that are also in `.env.example`. They are for a laptop or Compose project. Change them before anyone else can reach the database.

# FacilityIQ

Multi-tenant facility operations and cost intelligence for Acme Manufacturing. Signed-in users can explore the seeded West Distribution Center as a procedural 3D model built from the stored layout and assets. KPI charts, insight rules, and the scenario engine are later phases. Pages that are not ready say so. They do not invent performance numbers.

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

## Layout

Business rules live in `src/server/services`, `src/server/repositories`, and `src/lib`. Route handlers and React components call those modules. KPI definitions are in `docs/KPI_FORMULAS.md`. The architecture plan and the Phase 1 exceptions are in `docs/ARCHITECTURE.md`.

## Local development passwords

The database roles created by the migration use passwords that are also in `.env.example`. They are for a laptop or Compose project. Change them before anyone else can reach the database.

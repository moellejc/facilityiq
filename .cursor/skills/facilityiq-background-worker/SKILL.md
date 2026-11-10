---
name: facilityiq-background-worker
description: FacilityIQ background job standards — the Node worker in worker/, background_jobs queue, job claiming with SKIP LOCKED, adding job handlers, org context and re-authorization, retries and idempotency, enqueueing from services, and 202 responses. Use when editing worker/, adding a job type, enqueueing background_jobs, or moving work out of the request path.
---

# Background Worker (FacilityIQ)

Source: Notion Coding Conventions §1, §14 (principles). Implementation detail is **derived from current code** (`worker/index.ts`) and not yet documented in Notion.

## Current shape

- Separate Node process: `pnpm worker` / `pnpm worker:dev` (`tsx worker/index.ts`). Runs as the `worker` service in `compose.yaml`.
- Connects with `DATABASE_URL_WORKER` (role `facilityiq_worker`, **BYPASSRLS** so it can dequeue across orgs), falling back to `DATABASE_MIGRATE_URL` / `DATABASE_URL`.
- Polls every 2s; claims one job with `UPDATE … WHERE id = (SELECT … FOR UPDATE SKIP LOCKED LIMIT 1)`, increments `attempts`, sets `locked_by`.
- `handle(job)` dispatches on `job_type`; unknown types fail with "Handler is not implemented yet."
- `finish()` sets `succeeded`/`failed`, `last_error`, `completed_at`.
- Graceful shutdown on SIGINT/SIGTERM.

## What belongs in the worker

Metric rollups, insight generation, large report/import work, later model processing. **Not**: anything a user waits on synchronously, or LLM financial computation (never allowed anywhere).

## Adding a job type

1. Define the payload with a Zod schema (shared with the enqueuing service — don't duplicate).
2. Enqueue from a **service**, inside the same transaction as the triggering write, with explicit `organization_id`. The route returns **202** with the job ID and an access-controlled status mechanism (document it when implemented — don't invent an endpoint).
3. Add a handler branch that: parses the payload with Zod; uses the job's `organization_id` as explicit org context; reuses app services/repositories/pure libs (never a parallel copy); re-checks authority where the action requires it.
4. Make it **idempotent**: a retry after partial failure must not duplicate rows (org-scoped keys + unique constraints, or upsert).
5. Record progress/failure; put a safe message in `last_error` (no secrets).
6. Document freshness/invalidation for any data the job produces that the UI caches.

## Rules

- Because the worker role bypasses RLS, **explicit `organizationId` filters are mandatory** in every query a handler runs.
- No fire-and-forget promises in request handlers as a substitute for jobs.
- Don't hold a transaction open across network/LLM calls.
- Long jobs should be resumable or chunked.

## Tests

Integration-test each handler: correct org scoping, idempotent retry (run twice → one result), failure path records `failed` + `last_error`.

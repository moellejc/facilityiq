import { config as loadEnv } from "dotenv";
import { Pool } from "pg";

import { ensureBucket } from "../src/lib/storage";

loadEnv();

type JobRow = {
  id: string;
  job_type: string;
  payload: unknown;
  organization_id: string | null;
  attempts: number;
};

const workerId = `worker-${process.pid}`;
const pollMs = 2000;

function connectionString() {
  return (
    process.env.DATABASE_URL_WORKER ?? process.env.DATABASE_MIGRATE_URL ?? process.env.DATABASE_URL
  );
}

async function claimJob(pool: Pool) {
  const result = await pool.query<JobRow>(
    `UPDATE background_jobs
     SET status = 'running',
         locked_at = now(),
         locked_by = $1,
         attempts = attempts + 1,
         updated_at = now()
     WHERE id = (
       SELECT id FROM background_jobs
       WHERE status = 'queued' AND run_after <= now()
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     RETURNING id, job_type, payload, organization_id, attempts`,
    [workerId],
  );
  return result.rows[0] ?? null;
}

async function finish(
  pool: Pool,
  id: string,
  status: "succeeded" | "failed",
  lastError: string | null,
) {
  await pool.query(
    `UPDATE background_jobs
     SET status = $2::job_status,
         last_error = $3,
         completed_at = now(),
         updated_at = now(),
         locked_at = NULL
     WHERE id = $1::uuid`,
    [id, status, lastError],
  );
}

function handle(job: JobRow) {
  if (job.job_type === "noop") {
    console.log(`[worker] completed noop job ${job.id}`);
    return { status: "succeeded" as const, error: null };
  }
  console.log(`[worker] no handler for ${job.job_type} (${job.id})`);
  return {
    status: "failed" as const,
    error: "Handler is not implemented yet.",
  };
}

async function tick(pool: Pool) {
  const job = await claimJob(pool);
  if (!job) return;
  try {
    const outcome = handle(job);
    await finish(pool, job.id, outcome.status, outcome.error);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Job failed.";
    await finish(pool, job.id, "failed", message);
  }
}

async function main() {
  const url = connectionString();
  if (!url)
    throw new Error("DATABASE_URL_WORKER, DATABASE_MIGRATE_URL, or DATABASE_URL is required.");
  const pool = new Pool({ connectionString: url, max: 2 });
  await pool.query("select 1");
  console.log(`[worker] connected as ${workerId}`);

  try {
    const bucket = await ensureBucket();
    console.log(`[worker] object storage bucket ready: ${bucket}`);
  } catch (error) {
    console.warn("[worker] object storage is not ready yet. Uploads stay unavailable.");
    console.warn(error instanceof Error ? error.message : error);
  }

  let stopped = false;
  const stop = () => {
    stopped = true;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  while (!stopped) {
    await tick(pool);
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  await pool.end();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

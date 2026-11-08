import { execSync } from "node:child_process";

const testUrl =
  process.env.DATABASE_URL_TEST ??
  "postgres://facilityiq:facilityiq_dev@localhost:5432/facilityiq_test";

export default function setup() {
  execSync("pnpm exec drizzle-kit migrate", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: testUrl,
      DATABASE_MIGRATE_URL: testUrl,
    },
  });
}

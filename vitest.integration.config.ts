import path from "node:path";

import { defineConfig } from "vitest/config";

const testUrl =
  process.env.DATABASE_URL_TEST ??
  "postgres://facilityiq:facilityiq_dev@localhost:5432/facilityiq_test";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    globalSetup: ["./tests/integration/global-setup.ts"],
    testTimeout: 120000,
    hookTimeout: 120000,
    env: {
      DATABASE_URL: testUrl,
      DATABASE_MIGRATE_URL: testUrl,
      DATABASE_URL_TEST: testUrl,
      AUTH_SECRET: "test-secret-not-for-production",
      AUTH_URL: "http://localhost:43123",
      S3_ENDPOINT: "http://127.0.0.1:9000",
      S3_REGION: "us-east-1",
      S3_BUCKET: "facilityiq-models",
      S3_ACCESS_KEY_ID: "facilityiq",
      S3_SECRET_ACCESS_KEY: "facilityiq-dev-secret",
      S3_FORCE_PATH_STYLE: "true",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

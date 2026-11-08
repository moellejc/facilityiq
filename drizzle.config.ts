import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: ".env" });

const url = process.env.DATABASE_MIGRATE_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error("DATABASE_MIGRATE_URL or DATABASE_URL is required for Drizzle Kit.");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
});

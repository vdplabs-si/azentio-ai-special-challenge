import { execSync } from "node:child_process";

/**
 * Prepares an isolated schema for end-to-end tests: migrations → reference data → dev seed.
 * Requires E2E_DATABASE_URL (recommended: the Voroa URL with `schema=e2e`), never the production schema.
 */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Set E2E_DATABASE_URL (e.g. your Voroa URL with &schema=e2e) to run e2e tests.");
  if (!/[?&]schema=(?!public\b)[a-z0-9_]+/i.test(url)) throw new Error("E2E_DATABASE_URL must target a non-public schema (add &schema=e2e).");
  const env = { ...process.env, DATABASE_URL: url, NODE_ENV: "test" as const, SEED_PASSWORD: process.env.E2E_SEED_PASSWORD ?? "E2e-password-2026" };
  for (const cmd of ["npx prisma migrate deploy", "npx tsx prisma/sync-catalogue.ts", "npx tsx prisma/seed.ts"]) {
    execSync(cmd, { stdio: "inherit", env: env as NodeJS.ProcessEnv });
  }
}

import { execSync } from "node:child_process";
import { Client } from "pg";

/**
 * Prepares an isolated schema for end-to-end tests: drop/recreate schema → migrations →
 * reference data → dev seed. Requires E2E_DATABASE_URL with a non-public `schema=` parameter,
 * so the suite can never touch the application's real tables.
 */
export default async function globalSetup() {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error("Set E2E_DATABASE_URL (e.g. your Voroa URL with &schema=e2e) to run e2e tests.");
  const parsed = new URL(url);
  const schema = parsed.searchParams.get("schema");
  if (!schema || schema === "public" || !/^[a-z0-9_]+$/i.test(schema)) {
    throw new Error("E2E_DATABASE_URL must target a dedicated, non-public schema (add &schema=e2e).");
  }

  const sslmode = parsed.searchParams.get("sslmode");
  for (const p of ["sslmode", "schema", "uselibpqcompat"]) parsed.searchParams.delete(p);
  const pg = new Client({ connectionString: parsed.toString(), ssl: sslmode && sslmode !== "disable" ? { rejectUnauthorized: false } : false });
  await pg.connect();
  await pg.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pg.query(`CREATE SCHEMA "${schema}"`);
  await pg.end();

  const env = { ...process.env, DATABASE_URL: url, NODE_ENV: "test", SEED_PASSWORD: process.env.E2E_SEED_PASSWORD ?? "E2e-password-2026" };
  for (const cmd of ["npx prisma migrate deploy", "npx tsx prisma/sync-catalogue.ts", "npx tsx prisma/seed.ts"]) {
    execSync(cmd, { stdio: "inherit", env: env as NodeJS.ProcessEnv });
  }
}

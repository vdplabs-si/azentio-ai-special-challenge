import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "@/lib/env";

/**
 * Builds pg pool options from DATABASE_URL.
 * Voroa Managed Postgres is TLS-only with a certificate that is not signed by a public CA,
 * and documents `sslmode=require` (encrypt, no CA pinning — libpq semantics). node-postgres
 * would otherwise treat `require` as verify-full, so we translate it explicitly. Supplying
 * DATABASE_CA_CERT upgrades the connection to full certificate verification.
 */
function poolConfig() {
  const { DATABASE_URL, DATABASE_CA_CERT } = env();
  const url = new URL(DATABASE_URL);
  const sslmode = url.searchParams.get("sslmode");
  const schema = url.searchParams.get("schema") ?? undefined;
  url.searchParams.delete("sslmode");
  url.searchParams.delete("schema");
  url.searchParams.delete("uselibpqcompat");

  let ssl: false | { rejectUnauthorized: boolean; ca?: string } = false;
  if (DATABASE_CA_CERT) ssl = { rejectUnauthorized: true, ca: DATABASE_CA_CERT.replace(/\\n/g, "\n") };
  else if (sslmode && sslmode !== "disable") ssl = { rejectUnauthorized: false };

  return { pool: { connectionString: url.toString(), ssl, max: 10, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 }, schema };
}

function createClient() {
  const { pool, schema } = poolConfig();
  const adapter = new PrismaPg(pool, schema ? { schema } : undefined);
  return new PrismaClient({ adapter, log: env().NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function client() {
  // One pool per process; reused across hot reloads in development.
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/**
 * Lazily-connected Prisma client: the pool (and env validation) is created on first use,
 * so `next build` can import route modules without database credentials.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});

export type { PrismaClient };

// Prisma client for Node scripts (seed / catalogue sync / e2e setup). Mirrors src/lib/db.ts
// TLS handling without the Next.js "server-only" guard.
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

export function createScriptClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const url = new URL(databaseUrl);
  const sslmode = url.searchParams.get("sslmode");
  const schema = url.searchParams.get("schema") ?? undefined;
  for (const p of ["sslmode", "schema", "uselibpqcompat"]) url.searchParams.delete(p);
  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const ssl = ca ? { rejectUnauthorized: true, ca } : sslmode && sslmode !== "disable" ? { rejectUnauthorized: false } : false;
  const adapter = new PrismaPg({ connectionString: url.toString(), ssl, max: 4 }, schema ? { schema } : undefined);
  return new PrismaClient({ adapter });
}

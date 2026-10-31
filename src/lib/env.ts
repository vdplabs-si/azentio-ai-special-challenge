import "server-only";
import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.url(),
  DATABASE_CA_CERT: z.string().optional(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_URL: z.url().default("http://localhost:3000"),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("azentio.ai <no-reply@azentio.ai>"),

  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("anthropic/claude-sonnet-5.5"),
  OPENROUTER_ZDR: z.enum(["0", "1"]).default("0"),

  EMPLOYEE_EMAIL_DOMAIN: z.string().default("azentio.com"),
  LEARNING_MIN_COHORT: z.coerce.number().int().min(2).default(3),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(20).default(5),
});

function load() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  const env = parsed.data;
  // Enforced when the server runs; `next build` evaluates modules without production secrets.
  if (isProd && process.env.NEXT_PHASE !== "phase-production-build") {
    const url = new URL(env.DATABASE_URL);
    const sslmode = url.searchParams.get("sslmode");
    if (!sslmode || !["require", "verify-ca", "verify-full"].includes(sslmode)) {
      throw new Error("DATABASE_URL must use TLS in production (add ?sslmode=require).");
    }
    // Secure cookies follow AUTH_URL (src/lib/auth/cookie-policy.ts); only loopback may be plain HTTP.
    const origin = new URL(env.AUTH_URL);
    if (origin.protocol !== "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)) {
      throw new Error("AUTH_URL must be an https:// URL in production.");
    }
  }
  return env;
}

let cached: z.infer<typeof schema> | undefined;

/** Validated server environment. Throws on first access if misconfigured. */
export function env() {
  cached ??= load();
  return cached;
}

export const oauthConfigured = {
  google: () => Boolean(env().GOOGLE_CLIENT_ID && env().GOOGLE_CLIENT_SECRET),
  github: () => Boolean(env().GITHUB_CLIENT_ID && env().GITHUB_CLIENT_SECRET),
};

export const emailProviderConfigured = () => Boolean(env().RESEND_API_KEY);
export const airaConfigured = () => Boolean(env().OPENROUTER_API_KEY);

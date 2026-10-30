import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/api/errors";
import { sha256 } from "@/lib/crypto";

/**
 * Fixed-window rate limiter persisted in PostgreSQL so limits hold across instances.
 * `key` should identify the action and subject, e.g. `login:${email}` or `contact:${ip}`.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const bucketKey = sha256(key);
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);

  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "windowStart", "count")
    VALUES (${bucketKey}, ${windowStart}, 1)
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimitBucket"."windowStart" = ${windowStart} THEN "RateLimitBucket"."count" + 1 ELSE 1 END,
      "windowStart" = ${windowStart}
    RETURNING "count"`;

  const count = rows[0]?.count ?? 1;
  if (count > limit) {
    throw new AppError("rate_limited", "Too many requests. Please wait a moment and try again.", {
      retryAfterSeconds: Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000),
    });
  }
}

/** Best-effort client IP from proxy headers (used only as a rate-limit key, hashed). */
export function clientIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}

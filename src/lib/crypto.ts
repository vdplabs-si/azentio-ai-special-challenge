import "server-only";
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

export const hmac = (value: string) => createHmac("sha256", env().AUTH_SECRET).update(value).digest("hex");

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Six-digit numeric one-time code. */
export const numericCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

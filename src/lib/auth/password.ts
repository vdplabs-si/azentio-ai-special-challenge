import "server-only";
import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

// @node-rs/argon2 defaults to Argon2id; parameters follow OWASP minimums.
const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 };

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(200)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Include letters and numbers.");

export const hashPassword = (password: string) => hash(password, OPTIONS);

export async function verifyPassword(stored: string, password: string) {
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

/** A real hash to compare against when the account doesn't exist (uniform timing). */
let dummy: string | undefined;
export async function dummyVerify(password: string) {
  dummy ??= await hash("not-a-real-password-0", OPTIONS);
  await verifyPassword(dummy, password);
}

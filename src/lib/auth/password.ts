import "server-only";
import { randomBytes } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";
import { z } from "zod";

// Argon2id (WebAssembly build — no native binary), OWASP minimum parameters: 19 MiB, t=2, p=1.
const PARAMS = { parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32 } as const;

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(200)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), "Include letters and numbers.");

/** Returns a PHC-encoded string ($argon2id$v=19$m=…,t=…,p=…$salt$hash). */
export const hashPassword = (password: string) =>
  argon2id({ password, salt: randomBytes(16), ...PARAMS, outputType: "encoded" });

export async function verifyPassword(stored: string, password: string) {
  try {
    return await argon2Verify({ password, hash: stored });
  } catch {
    return false;
  }
}

/** A real hash to compare against when the account doesn't exist (uniform timing). */
let dummy: string | undefined;
export async function dummyVerify(password: string) {
  dummy ??= await hashPassword("not-a-real-password-0");
  await verifyPassword(dummy, password);
}

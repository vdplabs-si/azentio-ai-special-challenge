import "server-only";
import type { EmailCodePurpose } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { hmac, numericCode, safeEqual } from "@/lib/crypto";
import { sendMail, type MailResult } from "@/lib/auth/mailer";
import { AppError } from "@/lib/api/errors";

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const digest = (email: string, purpose: EmailCodePurpose, code: string) => hmac(`${purpose}:${email}:${code}`);

const SUBJECT: Record<EmailCodePurpose, string> = {
  LOGIN: "Your azentio.ai sign-in code",
  VERIFY_EMAIL: "Verify your email for azentio.ai",
  RESET_PASSWORD: "Reset your azentio.ai password",
};

/** Issue a single-use code (previous unused codes for the same purpose are invalidated). */
export async function issueEmailCode(email: string, purpose: EmailCodePurpose): Promise<MailResult> {
  const code = numericCode();
  await db.$transaction([
    db.emailCode.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } }),
    db.emailCode.create({
      data: {
        email,
        purpose,
        codeHash: digest(email, purpose, code),
        expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
      },
    }),
  ]);
  return sendMail({
    to: email,
    subject: SUBJECT[purpose],
    text: `Your one-time code is ${code}\n\nIt expires in ${TTL_MINUTES} minutes and can be used once. If you didn't request it, you can ignore this email.`,
  });
}

/** Verify and consume a code. Throws a generic error on any failure. */
export async function consumeEmailCode(email: string, purpose: EmailCodePurpose, code: string) {
  const invalid = new AppError("bad_request", "That code is invalid or has expired. Request a new one.");
  const record = await db.emailCode.findFirst({
    where: { email, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!record || record.attempts >= MAX_ATTEMPTS) throw invalid;
  const ok = safeEqual(record.codeHash, digest(email, purpose, code));
  await db.emailCode.update({
    where: { id: record.id },
    data: ok ? { consumedAt: new Date() } : { attempts: { increment: 1 } },
  });
  if (!ok) throw invalid;
}

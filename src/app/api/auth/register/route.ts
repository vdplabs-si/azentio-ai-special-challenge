import { z } from "zod";
import { withApi, parseBody } from "@/lib/api/handler";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { conflict } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { hashPassword, passwordSchema } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { issueEmailCode } from "@/lib/auth/email-code";
import { normaliseEmail } from "@/lib/auth/accounts";
import { audit } from "@/lib/audit";

const body = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254).transform(normaliseEmail),
  password: passwordSchema,
});

/**
 * Creates an identity only. Registration never creates a trusted tenant membership:
 * clients join by invitation, employees after organiser approval (PDF §04).
 */
export const POST = withApi(
  async ({ req }) => {
    await rateLimit(`register:${clientIp(req.headers)}`, 10, 3600);
    const input = await parseBody(req, body);
    const exists = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (exists) throw conflict("An account with this email already exists. Sign in instead.");
    const user = await db.user.create({
      data: { name: input.name, email: input.email, passwordHash: await hashPassword(input.password) },
    });
    await audit({ actorId: user.id, action: "auth.register", entityType: "User", entityId: user.id });
    await createSession(user.id, { userAgent: req.headers.get("user-agent") });
    // The account exists either way; if email delivery is unavailable we say so rather than fail.
    const mail = await issueEmailCode(user.email, "VERIFY_EMAIL").catch(() => null);
    return { ok: true, verification: { sent: mail?.accepted ?? false, transport: mail?.transport ?? "unavailable" } };
  },
  { auth: false },
);

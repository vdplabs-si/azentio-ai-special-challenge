import { z } from "zod";
import { withApi, parseBody } from "@/lib/api/handler";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { consumeEmailCode } from "@/lib/auth/email-code";
import { normaliseEmail, requestEmployeeAccessIfEligible } from "@/lib/auth/accounts";
import { createSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { AppError, forbidden } from "@/lib/api/errors";

const body = z.object({
  email: z.email().max(254).transform(normaliseEmail),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
  purpose: z.enum(["LOGIN", "VERIFY_EMAIL"]).default("LOGIN"),
  name: z.string().trim().min(2).max(100).optional(),
});

export const POST = withApi(
  async ({ req, actor }) => {
    const input = await parseBody(req, body);
    await rateLimit(`email-verify:ip:${clientIp(req.headers)}`, 30, 900);

    if (input.purpose === "VERIFY_EMAIL") {
      if (!actor.user || actor.user.email !== input.email) throw forbidden("Sign in to verify your email.");
      await consumeEmailCode(input.email, "VERIFY_EMAIL", input.code);
      await db.user.update({ where: { id: actor.user.id }, data: { emailVerifiedAt: new Date() } });
      await audit({ actorId: actor.user.id, action: "auth.email_verified", entityType: "User", entityId: actor.user.id });
      await requestEmployeeAccessIfEligible(actor.user.id, input.email, true);
      return { ok: true };
    }

    // Passwordless sign-in: a valid code proves control of the address.
    await consumeEmailCode(input.email, "LOGIN", input.code);
    let user = await db.user.findUnique({ where: { email: input.email } });
    if (user && user.status !== "ACTIVE") throw new AppError("forbidden", "This account has been deactivated.");
    if (!user) {
      user = await db.user.create({
        data: { email: input.email, name: input.name ?? input.email.split("@")[0]!, emailVerifiedAt: new Date() },
      });
      await audit({ actorId: user.id, action: "auth.register", entityType: "User", entityId: user.id, metadata: { method: "email_code" } });
    } else if (!user.emailVerifiedAt) {
      user = await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    }
    await requestEmployeeAccessIfEligible(user.id, user.email, true);
    await createSession(user.id, { userAgent: req.headers.get("user-agent") });
    await audit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, metadata: { method: "email_code" } });
    return { ok: true };
  },
  { auth: false },
);

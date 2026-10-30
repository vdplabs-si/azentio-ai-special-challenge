import { z } from "zod";
import { withApi, parseBody } from "@/lib/api/handler";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { AppError } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { dummyVerify, verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { normaliseEmail } from "@/lib/auth/accounts";
import { audit } from "@/lib/audit";

const body = z.object({
  email: z.email().max(254).transform(normaliseEmail),
  password: z.string().min(1).max(200),
});

export const POST = withApi(
  async ({ req }) => {
    const input = await parseBody(req, body);
    await rateLimit(`login:ip:${clientIp(req.headers)}`, 30, 900);
    await rateLimit(`login:email:${input.email}`, 8, 900);
    const user = await db.user.findUnique({ where: { email: input.email } });
    const invalid = new AppError("unauthenticated", "Email or password is incorrect.");
    if (!user?.passwordHash) {
      await dummyVerify(input.password);
      throw invalid;
    }
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      await audit({ actorId: user.id, action: "auth.login_failed", entityType: "User", entityId: user.id });
      throw invalid;
    }
    if (user.status !== "ACTIVE") throw new AppError("forbidden", "This account has been deactivated.");
    await createSession(user.id, { userAgent: req.headers.get("user-agent") });
    await audit({ actorId: user.id, action: "auth.login", entityType: "User", entityId: user.id, metadata: { method: "password" } });
    return { ok: true };
  },
  { auth: false },
);

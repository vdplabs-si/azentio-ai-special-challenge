import { z } from "zod";
import { withApi, parseBody } from "@/lib/api/handler";
import { clientIp, rateLimit } from "@/lib/api/rate-limit";
import { issueEmailCode } from "@/lib/auth/email-code";
import { normaliseEmail } from "@/lib/auth/accounts";
import { forbidden } from "@/lib/api/errors";

const body = z.object({
  email: z.email().max(254).transform(normaliseEmail),
  purpose: z.enum(["LOGIN", "VERIFY_EMAIL"]).default("LOGIN"),
});

/**
 * Sends a one-time code. Response is identical whether or not an account exists.
 * `delivery.transport` is "resend" (provider accepted) or "dev-log" (development only —
 * printed to the server console, not delivered). We never claim an email was delivered.
 */
export const POST = withApi(
  async ({ req, actor }) => {
    const input = await parseBody(req, body);
    await rateLimit(`email-code:ip:${clientIp(req.headers)}`, 20, 900);
    await rateLimit(`email-code:email:${input.email}`, 5, 900);
    if (input.purpose === "VERIFY_EMAIL" && actor.user?.email !== input.email) {
      throw forbidden("You can only verify the email address of your own account.");
    }
    const mail = await issueEmailCode(input.email, input.purpose);
    return { ok: true, delivery: { transport: mail.transport, acceptedByProvider: mail.accepted } };
  },
  { auth: false },
);

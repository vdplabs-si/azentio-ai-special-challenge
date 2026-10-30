import { z } from "zod";
import { withApi, parseBody } from "@/lib/api/handler";
import { rateLimit } from "@/lib/api/rate-limit";
import { requireUser } from "@/lib/authz/actor";
import { acceptInvitation } from "@/server/services/invitations";

const body = z.object({ token: z.string().min(20).max(100) });

export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  await rateLimit(`invite-accept:${actor.user.id}`, 20, 600);
  const { token } = await parseBody(req, body);
  return acceptInvitation(actor, token);
});

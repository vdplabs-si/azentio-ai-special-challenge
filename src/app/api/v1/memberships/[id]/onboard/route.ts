import { z } from "zod";
import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { completeOnboarding } from "@/server/services/invitations";

const body = z.object({
  acceptTerms: z.literal(true, { error: "You must accept the workspace terms." }),
  acknowledgeLearningNotice: z.literal(true, { error: "Please confirm you've read how sharing works." }),
});

/** `id` is the organisation ID of the pending membership. */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  await parseBody(req, body);
  await completeOnboarding(actor, params.id);
  return { ok: true };
});

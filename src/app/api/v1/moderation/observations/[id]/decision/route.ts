import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { moderationDecisionSchema } from "@/server/learning/schemas";
import { decideObservation } from "@/server/services/moderation";

/** { action: RETURN_FOR_CLARIFICATION | PUBLISH | REJECT, publicReason, internalNote?, sharedCopy?, acknowledgedFlags? } */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, moderationDecisionSchema);
  return decideObservation(actor, params.id, input);
});

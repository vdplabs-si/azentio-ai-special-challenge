import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { reportDecisionSchema } from "@/server/learning/schemas";
import { decideReport } from "@/server/services/moderation";

/** { action: SUSPEND | REINSTATE | REMOVE | DISMISS, note, publicReason? } */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, reportDecisionSchema);
  return decideReport(actor, params.id, input);
});

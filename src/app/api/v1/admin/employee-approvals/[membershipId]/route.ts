import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { approvalDecisionSchema, decideEmployeeApproval } from "@/server/services/admin";

/** POST { decision: "approve" | "reject" } */
export const POST = withApi<{ membershipId: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return { membership: await decideEmployeeApproval(actor, params.membershipId, await parseBody(req, approvalDecisionSchema)) };
});

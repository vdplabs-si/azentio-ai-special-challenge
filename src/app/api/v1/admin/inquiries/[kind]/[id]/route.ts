import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { inquiryStatusSchema, updateInquiryStatus } from "@/server/services/admin";

/** PATCH { status: "NEW" | "IN_PROGRESS" | "CLOSED" } for kind demo or hackathon. */
export const PATCH = withApi<{ kind: string; id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return { inquiry: await updateInquiryStatus(actor, params.kind, params.id, await parseBody(req, inquiryStatusSchema)) };
});

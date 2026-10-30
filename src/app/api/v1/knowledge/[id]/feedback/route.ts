import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { contentFeedbackSchema, upsertContentFeedback } from "@/server/services/knowledge";

/** Helpful / not helpful (+ optional comment), one per user per published, visible item. */
export const PUT = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, contentFeedbackSchema);
  return { feedback: await upsertContentFeedback(actor, params.id, input) };
});

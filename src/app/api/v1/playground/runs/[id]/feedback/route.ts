import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { feedbackSchema, upsertFeedback } from "@/server/services/playground";

/** Create or update my structured feedback for a run (one per run per user). */
export const PUT = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, feedbackSchema);
  const feedback = await upsertFeedback(actor, params.id, input);
  return { feedback };
});

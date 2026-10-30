import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { feedbackSchema } from "@/server/learning/schemas";
import { setFeedback } from "@/server/services/shared-feed";

/** PUT { kind: "USEFUL" | "NEEDS_EVIDENCE" | null } — one quality signal per user; returns aggregate counts. */
export const PUT = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const { kind } = await parseBody(req, feedbackSchema);
  return setFeedback(actor, params.id, kind);
});

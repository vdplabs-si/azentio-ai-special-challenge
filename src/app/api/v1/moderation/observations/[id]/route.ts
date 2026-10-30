import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { getReview } from "@/server/services/moderation";

export const dynamic = "force-dynamic";

/** Moderator review workspace for a submitted contribution (never unsubmitted drafts). */
export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return getReview(actor, params.id);
});

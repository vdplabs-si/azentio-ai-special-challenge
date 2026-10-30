import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { moderationQueue } from "@/server/services/moderation";

export const dynamic = "force-dynamic";

/** SUBMITTED contributions, oldest first (LEARNING_MODERATOR only; 404 otherwise). */
export const GET = withApi(async () => {
  const actor = await requireUser();
  return moderationQueue(actor);
});

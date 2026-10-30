import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { ideaStatusSchema } from "@/server/learning/schemas";
import { changeIdeaStatus } from "@/server/services/ideas";

/** Records an IdeaStatusChange + audit; shared ideas notify contributors of linked evidence. */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, ideaStatusSchema);
  return changeIdeaStatus(actor, params.id, input);
});

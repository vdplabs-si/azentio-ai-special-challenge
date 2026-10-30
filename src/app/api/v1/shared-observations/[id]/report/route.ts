import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { reportSchema } from "@/server/learning/schemas";
import { reportShared } from "@/server/services/shared-feed";

/** Report a shared copy to moderators. The reporter's identity is never shown to the contributor. */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, reportSchema);
  return reportShared(actor, params.id, input);
});

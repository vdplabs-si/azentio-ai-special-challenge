import { withApi, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { activityQuery } from "@/components/portal/collab/schemas";
import { listProjectActivity } from "@/server/services/projects";

/** Audit-backed activity for the project and its tasks, discussions and documents (newest first). */
export const GET = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return listProjectActivity(actor, params.id, parseQuery(req, activityQuery));
});

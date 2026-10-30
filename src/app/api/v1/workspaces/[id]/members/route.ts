import { withApi, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { memberListQuery } from "@/components/portal/collab/schemas";
import { listMembers } from "@/server/services/workspaces";

/** Member directory: ACTIVE members for everyone in the workspace; every state for administrators. */
export const GET = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return listMembers(actor, params.id, parseQuery(req, memberListQuery));
});

import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { revokeWorkspaceInvitation } from "@/server/services/workspaces";

export const DELETE = withApi<{ id: string; invitationId: string }>(async ({ params }) => {
  const actor = await requireUser();
  await revokeWorkspaceInvitation(actor, params.id, params.invitationId);
  return { ok: true };
});

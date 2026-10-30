import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { memberUpdateSchema } from "@/components/portal/collab/schemas";
import { removeMember, updateMember } from "@/server/services/workspaces";

/** PATCH: change role and/or suspend / reactivate. Authority is checked against the target membership. */
export const PATCH = withApi<{ id: string; userId: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  await updateMember(actor, params.id, params.userId, await parseBody(req, memberUpdateSchema));
  return { ok: true };
});

/** DELETE: remove a member (status REVOKED), or leave the workspace when targeting yourself. */
export const DELETE = withApi<{ id: string; userId: string }>(async ({ params }) => {
  const actor = await requireUser();
  await removeMember(actor, params.id, params.userId);
  return { ok: true };
});

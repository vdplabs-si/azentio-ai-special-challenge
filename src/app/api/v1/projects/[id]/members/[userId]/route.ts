import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { projectMemberUpdateSchema } from "@/components/portal/collab/schemas";
import { removeProjectMember, updateProjectMember } from "@/server/services/projects";

export const PATCH = withApi<{ id: string; userId: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const { role } = await parseBody(req, projectMemberUpdateSchema);
  await updateProjectMember(actor, params.id, params.userId, role);
  return { ok: true };
});

/** DELETE: managers remove members; anyone may remove themselves. The owner cannot be removed. */
export const DELETE = withApi<{ id: string; userId: string }>(async ({ params }) => {
  const actor = await requireUser();
  await removeProjectMember(actor, params.id, params.userId);
  return { ok: true };
});

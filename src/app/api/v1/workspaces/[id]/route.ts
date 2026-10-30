import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { workspaceDeleteSchema, workspaceUpdateSchema } from "@/components/portal/collab/schemas";
import { deleteWorkspace, getWorkspace, updateWorkspace } from "@/server/services/workspaces";

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return getWorkspace(actor, params.id);
});

export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  await updateWorkspace(actor, params.id, await parseBody(req, workspaceUpdateSchema));
  return { ok: true };
});

/** DELETE requires a JSON body `{ confirmName }` matching the workspace name exactly. */
export const DELETE = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const { confirmName } = await parseBody(req, workspaceDeleteSchema);
  await deleteWorkspace(actor, params.id, confirmName);
  return { ok: true };
});

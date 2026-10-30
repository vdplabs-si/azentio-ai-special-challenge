import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { projectUpdateSchema } from "@/components/portal/collab/schemas";
import { deleteProject, getProjectDetail, updateProject } from "@/server/services/projects";

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return getProjectDetail(actor, params.id);
});

export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  await updateProject(actor, params.id, await parseBody(req, projectUpdateSchema));
  return { ok: true };
});

export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  await deleteProject(actor, params.id);
  return { ok: true };
});

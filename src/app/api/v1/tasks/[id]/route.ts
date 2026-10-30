import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { taskUpdateSchema } from "@/components/portal/collab/schemas";
import { deleteTask, getTask, updateTask } from "@/server/services/tasks";

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return getTask(actor, params.id);
});

export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  await updateTask(actor, params.id, await parseBody(req, taskUpdateSchema));
  return { ok: true };
});

export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  await deleteTask(actor, params.id);
  return { ok: true };
});

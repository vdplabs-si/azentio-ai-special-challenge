import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { taskCreateSchema, taskListQuery } from "@/components/portal/collab/schemas";
import { createTask, listProjectTasks } from "@/server/services/tasks";

/** GET: tasks in a project. Filters: status, priority, assignee (me|none|id), overdue, q, sort. */
export const GET = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return listProjectTasks(actor, params.id, parseQuery(req, taskListQuery));
});

export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, taskCreateSchema);
  return NextResponse.json({ task: await createTask(actor, params.id, input) }, { status: 201 });
});

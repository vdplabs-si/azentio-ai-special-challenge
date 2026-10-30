import { withApi, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { taskListQuery } from "@/components/portal/collab/schemas";
import { listMyTasks } from "@/server/services/tasks";

/** GET: tasks assigned to the signed-in user across visible projects (filters: status, priority, overdue, q, sort). */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listMyTasks(actor, parseQuery(req, taskListQuery));
});

import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { markRead } from "@/server/services/notifications";

/** PATCH marks a single notification as read. */
export const PATCH = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  await markRead(actor, params.id);
  return { ok: true };
});

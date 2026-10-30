import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { markAllRead } from "@/server/services/notifications";

export const POST = withApi(async () => {
  const actor = await requireUser();
  const res = await markAllRead(actor);
  return { ok: true, updated: res.count };
});

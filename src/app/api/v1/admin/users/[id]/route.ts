import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { setUserStatus, userStatusSchema } from "@/server/services/admin";

/** PATCH { status: "ACTIVE" | "DEACTIVATED" }. Deactivation revokes every session. */
export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return { user: await setUserStatus(actor, params.id, await parseBody(req, userStatusSchema)) };
});

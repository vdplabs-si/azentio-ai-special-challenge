import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { revokeGrant } from "@/server/services/admin";

/** DELETE: revokes a platform role grant (sets revokedAt; the row is kept for history). */
export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return revokeGrant(actor, params.id);
});

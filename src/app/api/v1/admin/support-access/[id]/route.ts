import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { revokeSupportAccess } from "@/server/services/admin";

export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return revokeSupportAccess(actor, params.id);
});

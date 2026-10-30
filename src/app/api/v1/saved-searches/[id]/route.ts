import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { deleteSavedSearch } from "@/server/services/shared-feed";

export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  await deleteSavedSearch(actor, params.id);
  return { ok: true };
});

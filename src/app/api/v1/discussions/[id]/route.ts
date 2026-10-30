import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { deleteDiscussion, getDiscussion } from "@/server/services/discussions";

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return getDiscussion(actor, params.id);
});

export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  await deleteDiscussion(actor, params.id);
  return { ok: true };
});

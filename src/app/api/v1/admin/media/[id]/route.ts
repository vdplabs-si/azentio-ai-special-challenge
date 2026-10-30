import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { deleteMedia, mediaPatchSchema, updateMedia } from "@/server/services/content-admin";

export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return updateMedia(actor, params.id, await parseBody(req, mediaPatchSchema));
});

export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return deleteMedia(actor, params.id);
});

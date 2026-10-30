import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { ideaSchema } from "@/server/learning/schemas";
import { getIdea, updateIdea } from "@/server/services/ideas";

export const dynamic = "force-dynamic";

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return getIdea(actor, params.id);
});

/** Edit idea fields (status changes go through POST /status so they are always recorded). */
export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, ideaSchema);
  return updateIdea(actor, params.id, input);
});

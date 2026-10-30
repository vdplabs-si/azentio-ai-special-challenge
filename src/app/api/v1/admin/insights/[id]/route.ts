import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { insightPatchSchema, updateInsight } from "@/server/services/content-admin";

/** PATCH: edit, publish or archive a public insight (INSIGHT items only). */
export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return updateInsight(actor, params.id, await parseBody(req, insightPatchSchema));
});

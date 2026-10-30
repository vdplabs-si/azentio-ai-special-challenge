import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { hackathonEventPatchSchema, updateHackathonEvent } from "@/server/services/admin";

/** PATCH: edit an event or open/close registration. */
export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return updateHackathonEvent(actor, params.id, await parseBody(req, hackathonEventPatchSchema));
});

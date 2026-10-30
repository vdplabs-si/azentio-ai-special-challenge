import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { visibilitySchema } from "@/server/learning/schemas";
import { assertParticipant } from "@/server/learning/guard";
import { setOrgVisibility } from "@/server/services/observations";

/** Toggle "visible within my organisation". Never affects community sharing. */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  assertParticipant(actor);
  const { orgVisible } = await parseBody(req, visibilitySchema);
  return setOrgVisibility(actor, params.id, orgVisible);
});

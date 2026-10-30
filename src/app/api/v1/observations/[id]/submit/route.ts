import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { submitSchema } from "@/server/learning/schemas";
import { assertParticipant } from "@/server/learning/guard";
import { submitObservation } from "@/server/services/observations";

/** Propose community sharing (DRAFT → SUBMITTED, or RETURNED → SUBMITTED). Records an append-only consent. */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  assertParticipant(actor);
  const { consent } = await parseBody(req, submitSchema);
  return submitObservation(actor, params.id, consent);
});

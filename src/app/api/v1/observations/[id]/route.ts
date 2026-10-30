import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { observationUpdateSchema } from "@/server/learning/schemas";
import { assertParticipant } from "@/server/learning/guard";
import { deleteObservation, getObservationDetail, updateObservation } from "@/server/services/observations";

export const dynamic = "force-dynamic";

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  assertParticipant(actor);
  return getObservationDetail(actor, params.id);
});

/** Full update. DRAFT/RETURNED edit in place; PUBLISHED requires `consent` and creates version n+1 for review. */
export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  assertParticipant(actor);
  const input = await parseBody(req, observationUpdateSchema);
  return updateObservation(actor, params.id, input);
});

/** Deletes a never-submitted private draft. */
export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  assertParticipant(actor);
  await deleteObservation(actor, params.id);
  return { ok: true };
});

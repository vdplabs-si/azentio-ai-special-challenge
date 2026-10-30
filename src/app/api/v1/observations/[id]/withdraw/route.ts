import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { assertParticipant } from "@/server/learning/guard";
import { withdrawObservation } from "@/server/services/observations";

/** One-click withdrawal; live shared copies stop appearing in every shared read immediately. */
export const POST = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  assertParticipant(actor);
  return withdrawObservation(actor, params.id);
});

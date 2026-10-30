import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { ticketUpdateSchema } from "@/components/portal/collab/schemas";
import { updateTicketStatus } from "@/server/services/support-tickets";

/** PATCH `{ status }` — workspace administrators and portal administrators (Azentio support). */
export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const { status } = await parseBody(req, ticketUpdateSchema);
  await updateTicketStatus(actor, params.id, status);
  return { ok: true };
});

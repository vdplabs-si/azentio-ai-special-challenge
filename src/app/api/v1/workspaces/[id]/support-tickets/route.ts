import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { ticketCreateSchema, ticketListQuery } from "@/components/portal/collab/schemas";
import { createTicket, listTickets } from "@/server/services/support-tickets";

export const GET = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return listTickets(actor, params.id, parseQuery(req, ticketListQuery));
});

export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, ticketCreateSchema);
  return NextResponse.json({ ticket: await createTicket(actor, params.id, input) }, { status: 201 });
});

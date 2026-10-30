import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { invitationCreateSchema, invitationListQuery } from "@/components/portal/collab/schemas";
import { inviteMember, listInvitations } from "@/server/services/workspaces";

export const GET = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return listInvitations(actor, params.id, parseQuery(req, invitationListQuery));
});

/**
 * POST: create an invitation. The response includes the invitation link and the real delivery
 * transport, so the UI never claims an email was delivered when no provider is configured.
 */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, invitationCreateSchema);
  return NextResponse.json(await inviteMember(actor, params.id, input), { status: 201 });
});

import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { workspaceCreateSchema, workspaceListQuery } from "@/components/portal/collab/schemas";
import { createWorkspace, listWorkspaces } from "@/server/services/workspaces";

/** GET: workspaces visible to the actor (members: their own; portal admins: all, metadata only). */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listWorkspaces(actor, parseQuery(req, workspaceListQuery));
});

/** POST: create a CLIENT workspace (portal administrators only), optionally inviting an owner. */
export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const input = await parseBody(req, workspaceCreateSchema);
  return NextResponse.json(await createWorkspace(actor, input), { status: 201 });
});

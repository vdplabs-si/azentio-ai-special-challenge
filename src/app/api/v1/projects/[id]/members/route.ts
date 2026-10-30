import { NextResponse } from "next/server";
import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { projectMemberAddSchema } from "@/components/portal/collab/schemas";
import { addProjectMember, listProjectMembers } from "@/server/services/projects";

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  const { members, ownerId } = await listProjectMembers(actor, params.id);
  return { items: members, ownerId };
});

/** POST `{ userId, role }` — the user must be an ACTIVE member of the project's workspace. */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  await addProjectMember(actor, params.id, await parseBody(req, projectMemberAddSchema));
  return NextResponse.json({ ok: true }, { status: 201 });
});

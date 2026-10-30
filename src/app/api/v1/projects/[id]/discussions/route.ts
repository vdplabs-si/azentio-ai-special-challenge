import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { paginationSchema } from "@/lib/api/pagination";
import { requireUser } from "@/lib/authz/actor";
import { discussionCreateSchema } from "@/components/portal/collab/schemas";
import { createDiscussion, listDiscussions } from "@/server/services/discussions";

export const GET = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return listDiscussions(actor, params.id, parseQuery(req, paginationSchema));
});

export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, discussionCreateSchema);
  return NextResponse.json({ discussion: await createDiscussion(actor, params.id, input) }, { status: 201 });
});

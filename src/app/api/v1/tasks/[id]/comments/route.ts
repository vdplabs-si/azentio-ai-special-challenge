import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { paginationSchema } from "@/lib/api/pagination";
import { requireUser } from "@/lib/authz/actor";
import { commentCreateSchema } from "@/components/portal/collab/schemas";
import { createComment, listComments } from "@/server/services/tasks";

const query = paginationSchema.extend({ limit: paginationSchema.shape.limit.default(50) });

export const GET = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return listComments(actor, params.id, parseQuery(req, query));
});

/** POST `{ body, parentId? }` — @mentions resolve only to people who can view the task's project. */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, commentCreateSchema);
  return NextResponse.json({ comment: await createComment(actor, params.id, input) }, { status: 201 });
});

import { NextResponse } from "next/server";
import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { replyCreateSchema } from "@/components/portal/collab/schemas";
import { createReply } from "@/server/services/discussions";

export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, replyCreateSchema);
  return NextResponse.json({ reply: await createReply(actor, params.id, input) }, { status: 201 });
});

import { withApi, parseBody } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/authz/actor";
import { sharedFeedWhere } from "@/lib/authz/visibility";
import { commentSchema } from "@/server/learning/schemas";
import { assertParticipant } from "@/server/learning/guard";
import { addComment, listComments } from "@/server/services/shared-feed";

export const dynamic = "force-dynamic";

/** Comments on a visible shared copy; authors are labelled "You" / "Azentio team" / "Community participant". */
export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  assertParticipant(actor);
  const visible = await db.sharedObservation.count({ where: { AND: [{ id: params.id }, sharedFeedWhere(actor)] } });
  if (!visible) throw notFound();
  return { items: await listComments(actor, params.id) };
});

export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const { body } = await parseBody(req, commentSchema);
  return addComment(actor, params.id, body);
});

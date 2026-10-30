import { withApi, parseBody } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { requireUser } from "@/lib/authz/actor";
import { cancelLiveSession, getLiveSession, liveSessionUpdateSchema, updateLiveSession } from "@/server/services/live";

/** A session the actor's audience allows; anything else is 404. */
export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  const session = await getLiveSession(actor, params.id);
  if (!session) throw notFound();
  return { session };
});

/** Edit details, URLs, status and audience — broadcast publishers only. */
export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, liveSessionUpdateSchema);
  return { session: await updateLiveSession(actor, params.id, input) };
});

/** Cancel (soft) — broadcast publishers only. */
export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return { session: await cancelLiveSession(actor, params.id) };
});

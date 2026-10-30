import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { createLiveSession, listLiveSessions, liveListQuery, liveSessionCreateSchema } from "@/server/services/live";

/** Sessions visible to the actor (audience-filtered). `?scope=live|upcoming|recordings|past|manage`. */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listLiveSessions(actor, parseQuery(req, liveListQuery));
});

/** Schedule a session — broadcast publishers only. */
export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const input = await parseBody(req, liveSessionCreateSchema);
  const session = await createLiveSession(actor, input);
  return NextResponse.json({ session }, { status: 201 });
});

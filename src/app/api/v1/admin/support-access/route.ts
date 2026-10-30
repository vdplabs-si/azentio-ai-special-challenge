import { NextResponse } from "next/server";
import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { listSupportAccess, requestSupportAccess, supportAccessSchema } from "@/server/services/admin";

/** GET: active grants and recent history. */
export const GET = withApi(async () => {
  const actor = await requireUser();
  return listSupportAccess(actor);
});

/** POST { organisationId, reason }: opens a 60-minute, audited support-access grant for yourself. */
export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const res = await requestSupportAccess(actor, await parseBody(req, supportAccessSchema));
  return NextResponse.json(res, { status: 201 });
});

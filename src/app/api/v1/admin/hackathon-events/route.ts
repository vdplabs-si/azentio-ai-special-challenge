import { NextResponse } from "next/server";
import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { createHackathonEvent, hackathonEventCreateSchema, listHackathonEvents } from "@/server/services/admin";

export const GET = withApi(async () => {
  const actor = await requireUser();
  return { items: await listHackathonEvents(actor) };
});

export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const res = await createHackathonEvent(actor, await parseBody(req, hackathonEventCreateSchema));
  return NextResponse.json(res, { status: 201 });
});

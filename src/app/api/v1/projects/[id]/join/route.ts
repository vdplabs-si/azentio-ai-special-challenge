import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { joinTeam, leaveTeam } from "@/server/services/projects";

/** Hackathon team spaces (employees only): POST joins as CONTRIBUTOR, DELETE leaves. */
export const POST = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  await joinTeam(actor, params.id);
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  await leaveTeam(actor, params.id);
  return { ok: true };
});

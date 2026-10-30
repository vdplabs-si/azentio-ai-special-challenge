import { NextResponse } from "next/server";
import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { grantRole, grantRoleSchema } from "@/server/services/admin";

/** POST { role, reason }: grants a platform role (canGrantRole; never to yourself). */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const res = await grantRole(actor, params.id, await parseBody(req, grantRoleSchema));
  return NextResponse.json(res, { status: 201 });
});

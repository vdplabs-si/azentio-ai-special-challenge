import { NextResponse } from "next/server";
import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { entitlementSchema, grantEntitlement } from "@/server/services/admin";

/** POST { offeringId, expiresAt? }: only portal admins enable products, clients never self-enable. */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const res = await grantEntitlement(actor, params.id, await parseBody(req, entitlementSchema));
  return NextResponse.json(res, { status: 201 });
});

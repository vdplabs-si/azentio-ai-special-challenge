import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { orgStatusSchema, setOrganisationStatus } from "@/server/services/admin";

/** PATCH { status: "ACTIVE" | "SUSPENDED" } for client organisations only. */
export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return { organisation: await setOrganisationStatus(actor, params.id, await parseBody(req, orgStatusSchema)) };
});

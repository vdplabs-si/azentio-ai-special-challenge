import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { observationInputSchema, observationListQuery } from "@/server/learning/schemas";
import { createObservation, listMyObservations, listOrgObservations } from "@/server/services/observations";

export const dynamic = "force-dynamic";

/** GET ?scope=mine|org — private sources in the active workspace (never cross-tenant). */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  const { scope, ...page } = parseQuery(req, observationListQuery);
  return scope === "org" ? listOrgObservations(actor, page) : listMyObservations(actor, page);
});

/** POST creates a PRIVATE DRAFT in the active workspace. Saving never shares. */
export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const input = await parseBody(req, observationInputSchema);
  return createObservation(actor, input);
});

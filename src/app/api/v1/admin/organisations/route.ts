import { withApi, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { listOrganisations, orgListQuery } from "@/server/services/admin";

/** GET /api/v1/admin/organisations?q=&type=&status=&cursor= (organisation metadata only). */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listOrganisations(actor, parseQuery(req, orgListQuery));
});

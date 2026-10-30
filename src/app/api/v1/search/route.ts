import { withApi, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { search, searchQuerySchema } from "@/server/services/search";

/** GET /api/v1/search?q= — grouped results across resources the actor is authorised to see. */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  const { q } = parseQuery(req, searchQuerySchema);
  return search(actor, q);
});

import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { savedSearchSchema } from "@/server/learning/schemas";
import { createSavedSearch, listSavedSearches } from "@/server/services/shared-feed";

export const dynamic = "force-dynamic";

/** Saved searches with a live result count (re-run under the same visibility rules). */
export const GET = withApi(async () => {
  const actor = await requireUser();
  return { items: await listSavedSearches(actor) };
});

export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const input = await parseBody(req, savedSearchSchema);
  return createSavedSearch(actor, input);
});

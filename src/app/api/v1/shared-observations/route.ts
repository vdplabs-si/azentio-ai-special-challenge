import { withApi, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { sharedListQuery } from "@/server/learning/schemas";
import { listSharedFeed } from "@/server/services/shared-feed";

// Live query on every request — withdrawal takes effect immediately (never cache shared learning reads).
export const dynamic = "force-dynamic";

/** Approved shared feed (PUBLISHED only) with filters, pagination and cohort-suppressed facets. */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  const query = parseQuery(req, sharedListQuery);
  return listSharedFeed(actor, query);
});

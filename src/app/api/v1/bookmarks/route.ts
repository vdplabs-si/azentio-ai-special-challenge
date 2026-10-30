import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { bookmarkSchema } from "@/server/learning/schemas";
import { createBookmark, listBookmarks } from "@/server/services/shared-feed";

export const dynamic = "force-dynamic";

/** Bookmarks whose targets are still visible (withdrawn shared copies drop out immediately). */
export const GET = withApi(async () => {
  const actor = await requireUser();
  return { items: await listBookmarks(actor) };
});

/** { sharedObservationId } or { contentItemId } — idempotent. */
export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const input = await parseBody(req, bookmarkSchema);
  return createBookmark(actor, input);
});

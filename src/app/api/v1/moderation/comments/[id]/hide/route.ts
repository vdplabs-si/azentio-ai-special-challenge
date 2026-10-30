import { withApi } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { requireUser } from "@/lib/authz/actor";
import { hideCommentSchema } from "@/server/learning/schemas";
import { setCommentHidden } from "@/server/services/moderation";

/** Hide a comment on a shared copy. An empty body hides; `{ "hidden": false }` restores it. */
export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const text = await req.text();
  let json: unknown = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new AppError("bad_request", "Request body must be valid JSON.");
    }
  }
  const { hidden } = hideCommentSchema.parse(json);
  return setCommentHidden(actor, params.id, hidden);
});

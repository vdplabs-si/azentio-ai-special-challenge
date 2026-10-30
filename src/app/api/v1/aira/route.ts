import { withApi, parseBody } from "@/lib/api/handler";
import { unavailable } from "@/lib/api/errors";
import { requireUser } from "@/lib/authz/actor";
import { NOT_CONFIGURED_MESSAGE, airaQuestionSchema, airaStatus, askAira } from "@/server/services/aira";

/** GET /api/v1/aira — assistant availability for the current participant. */
export const GET = withApi(async () => {
  const actor = await requireUser();
  const { configured, model } = airaStatus(actor);
  return { configured, model };
});

/** POST /api/v1/aira {question} — cited synthesis over approved contributions (503 when not configured). */
export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  // Permission (403) and configuration (503) are checked before the body is even parsed.
  if (!airaStatus(actor).configured) throw unavailable(NOT_CONFIGURED_MESSAGE);
  const input = await parseBody(req, airaQuestionSchema);
  return askAira(actor, input);
});

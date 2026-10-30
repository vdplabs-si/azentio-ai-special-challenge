import { withApi } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { requireUser } from "@/lib/authz/actor";
import { getRun } from "@/server/services/playground";

/** One of my runs (active workspace only). */
export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  const run = await getRun(actor, params.id);
  if (!run) throw notFound();
  return { run };
});

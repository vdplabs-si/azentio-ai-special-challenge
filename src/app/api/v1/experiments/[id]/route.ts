import { withApi, parseBody } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { requireUser } from "@/lib/authz/actor";
import { experimentUpdateSchema, getExperiment, updateExperiment } from "@/server/services/experiments";

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  const experiment = await getExperiment(actor, params.id);
  if (!experiment) throw notFound();
  return { experiment };
});

/** Author edits (while SUBMITTED) or reviewer status/feedback (PRODUCT_OWNER / PORTAL_ADMIN). */
export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, experimentUpdateSchema);
  return { experiment: await updateExperiment(actor, params.id, input) };
});

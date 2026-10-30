import { withApi, parseBody } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { requireUser } from "@/lib/authz/actor";
import { contentUpdateSchema, getContentById, updateContent } from "@/server/services/knowledge";

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  const item = await getContentById(actor, params.id);
  if (!item) throw notFound();
  return { item };
});

export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, contentUpdateSchema);
  return { item: await updateContent(actor, params.id, input) };
});

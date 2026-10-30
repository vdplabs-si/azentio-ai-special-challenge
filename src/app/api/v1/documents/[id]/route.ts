import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { deleteDocument, getDocument } from "@/server/services/documents";

/** GET: document metadata only. */
export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return getDocument(actor, params.id);
});

/** DELETE: uploader, project manager or workspace administrator. */
export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  await deleteDocument(actor, params.id);
  return { ok: true };
});

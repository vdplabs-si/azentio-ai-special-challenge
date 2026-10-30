import { withApi, parseQuery } from "@/lib/api/handler";
import { paginationSchema } from "@/lib/api/pagination";
import { requireUser } from "@/lib/authz/actor";
import { listProjectDocuments } from "@/server/services/documents";

/** Document metadata for a project (file content is only served by /documents/[id]/download). */
export const GET = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return listProjectDocuments(actor, params.id, parseQuery(req, paginationSchema));
});

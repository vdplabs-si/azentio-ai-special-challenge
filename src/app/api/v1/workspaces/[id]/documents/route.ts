import { withApi, parseQuery } from "@/lib/api/handler";
import { paginationSchema } from "@/lib/api/pagination";
import { requireUser } from "@/lib/authz/actor";
import { listWorkspaceDocuments } from "@/server/services/documents";

/** Workspace-level documents (metadata only; documents not attached to a project). */
export const GET = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return listWorkspaceDocuments(actor, params.id, parseQuery(req, paginationSchema));
});

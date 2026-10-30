import { withApi, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { auditQuery, listAuditEvents } from "@/server/services/admin";

/** GET /api/v1/admin/audit?action=&entityType=&actor=&from=&to=&cursor= (portal admins only). */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listAuditEvents(actor, parseQuery(req, auditQuery));
});

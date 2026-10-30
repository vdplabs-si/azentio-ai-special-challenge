import { withApi, parseQuery } from "@/lib/api/handler";
import { paginationSchema } from "@/lib/api/pagination";
import { requireUser } from "@/lib/authz/actor";
import { listEmployeeApprovals } from "@/server/services/admin";

/** GET: PENDING_APPROVAL memberships of the internal organisation. */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listEmployeeApprovals(actor, parseQuery(req, paginationSchema));
});

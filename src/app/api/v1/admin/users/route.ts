import { withApi, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { listUsers, userListQuery } from "@/server/services/admin";

/** GET /api/v1/admin/users?q=&status=&cursor=&limit= (portal admins only). */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listUsers(actor, parseQuery(req, userListQuery));
});

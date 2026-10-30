import { withApi, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { inquiryListQuery, listDemoRequests, listHackathonRegistrations } from "@/server/services/admin";

/** GET /api/v1/admin/inquiries?kind=demo|hackathon&status=&eventId=&q=&cursor= */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  const q = parseQuery(req, inquiryListQuery);
  const page = q.kind === "demo" ? await listDemoRequests(actor, q) : await listHackathonRegistrations(actor, q);
  return { kind: q.kind, ...page };
});

import { z } from "zod";
import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { isOrgMember } from "@/lib/authz/permissions";
import { notFound } from "@/lib/api/errors";
import { db } from "@/lib/db";

const body = z.object({ organisationId: z.string().min(1).max(64) });

/** Switch the explicit active workspace. Only ACTIVE memberships are accepted (IAM-01). */
export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const { organisationId } = await parseBody(req, body);
  if (!isOrgMember(actor, organisationId)) throw notFound("Workspace not found.");
  await db.session.update({ where: { id: actor.sessionId! }, data: { activeOrganisationId: organisationId } });
  return { ok: true };
});

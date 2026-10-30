import { z } from "zod";
import { withApi, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { listReports } from "@/server/services/moderation";

export const dynamic = "force-dynamic";

const query = z.object({ status: z.enum(["OPEN", "RESOLVED", "ALL"]).default("OPEN") });

/** Reports on shared copies (moderators only). Reporter identity is never included. */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  const { status } = parseQuery(req, query);
  return { items: await listReports(actor, status) };
});

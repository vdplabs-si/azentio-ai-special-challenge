import { z } from "zod";
import { IdeaStatus } from "@/generated/prisma/enums";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { ideaCreateSchema } from "@/server/learning/schemas";
import { createIdea, listIdeas } from "@/server/services/ideas";

export const dynamic = "force-dynamic";

const query = z.object({ status: z.enum(IdeaStatus).optional(), offering: z.string().trim().max(80).optional() });

/** Employees see internal fields; participants see only shared ideas with audience-appropriate fields. */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listIdeas(actor, parseQuery(req, query));
});

export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const input = await parseBody(req, ideaCreateSchema);
  return createIdea(actor, input);
});

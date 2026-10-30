import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { createExperiment, experimentCreateSchema, experimentListQuery, listExperiments } from "@/server/services/experiments";

/** Employee-only: non-employees receive 404. Filters: `mine=1`, `status`, `offeringId`, `q`. */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listExperiments(actor, parseQuery(req, experimentListQuery));
});

export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const input = await parseBody(req, experimentCreateSchema);
  const experiment = await createExperiment(actor, input);
  return NextResponse.json({ experiment }, { status: 201 });
});

import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { notFound } from "@/lib/api/errors";
import { paginationSchema } from "@/lib/api/pagination";
import { requireUser } from "@/lib/authz/actor";
import { createRun, listRuns, runRequestSchema } from "@/server/services/playground";

/** My runs of this scenario in the active workspace. */
export const GET = withApi<{ slug: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const page = parseQuery(req, paginationSchema);
  const result = await listRuns(actor, params.slug, page);
  if (!result) throw notFound();
  return result;
});

/** Run the scenario's engine on synthetic inputs and persist the run. */
export const POST = withApi<{ slug: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const body = await parseBody(req, runRequestSchema);
  const run = await createRun(actor, params.slug, body.inputs);
  return NextResponse.json({ run }, { status: 201 });
});

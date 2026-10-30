import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { contentListQuery, createInsight, insightCreateSchema, listInsights } from "@/server/services/content-admin";

/** Public INSIGHT articles (content publishers only). */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listInsights(actor, parseQuery(req, contentListQuery));
});

export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const res = await createInsight(actor, await parseBody(req, insightCreateSchema));
  return NextResponse.json(res, { status: 201 });
});

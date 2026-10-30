import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { contentCreateSchema, contentListQuery, createContent, listContent } from "@/server/services/knowledge";

/** Knowledge, release notes and briefings visible to the actor (plus items they manage). */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listContent(actor, parseQuery(req, contentListQuery));
});

/** Employees: internal KNOWLEDGE only. Content publishers: any library type and audience. */
export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const input = await parseBody(req, contentCreateSchema);
  const item = await createContent(actor, input);
  return NextResponse.json({ item }, { status: 201 });
});

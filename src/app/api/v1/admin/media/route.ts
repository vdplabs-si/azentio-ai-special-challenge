import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { contentListQuery, createMedia, listMedia, mediaCreateSchema } from "@/server/services/content-admin";

/** Media assets (content publishers only). */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listMedia(actor, parseQuery(req, contentListQuery));
});

export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const res = await createMedia(actor, await parseBody(req, mediaCreateSchema));
  return NextResponse.json(res, { status: 201 });
});

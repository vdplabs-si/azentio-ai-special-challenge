import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { bannerCreateSchema, contentListQuery, createBanner, listBanners } from "@/server/services/content-admin";

/** Homepage banners (content publishers only). */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listBanners(actor, parseQuery(req, contentListQuery));
});

export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const res = await createBanner(actor, await parseBody(req, bannerCreateSchema));
  return NextResponse.json(res, { status: 201 });
});

import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { paginationSchema } from "@/lib/api/pagination";
import { requireUser } from "@/lib/authz/actor";
import { announcementCreateSchema } from "@/components/portal/collab/schemas";
import { createAnnouncement, listAnnouncements } from "@/server/services/announcements";

export const GET = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return listAnnouncements(actor, params.id, parseQuery(req, paginationSchema));
});

export const POST = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, announcementCreateSchema);
  return NextResponse.json({ announcement: await createAnnouncement(actor, params.id, input) }, { status: 201 });
});

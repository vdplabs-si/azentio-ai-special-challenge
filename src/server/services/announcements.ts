import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { notFound } from "@/lib/api/errors";
import { pageArgs, toPage, type Pagination } from "@/lib/api/pagination";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert, isOrgAdmin, isOrgMember } from "@/lib/authz/permissions";
import { visibleAnnouncements } from "@/lib/authz/visibility";
import type { AnnouncementCreateInput } from "@/components/portal/collab/schemas";

const SELECT = {
  id: true,
  organisationId: true,
  title: true,
  body: true,
  pinned: true,
  createdAt: true,
  author: { select: { id: true, name: true, image: true } },
} as const;

/** Announcements are private to ACTIVE members of the workspace; pinned first, newest first. */
export async function listAnnouncements(actor: AuthedActor, organisationId: string, page: Pagination) {
  if (!isOrgMember(actor, organisationId)) throw notFound("Workspace not found.");
  const rows = await db.announcement.findMany({
    where: { AND: [visibleAnnouncements(actor), { organisationId }] },
    select: SELECT,
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(page),
  });
  return { ...toPage(rows, page), canManage: isOrgAdmin(actor, organisationId) };
}
export type AnnouncementRow = Awaited<ReturnType<typeof listAnnouncements>>["items"][number];

export async function createAnnouncement(actor: AuthedActor, organisationId: string, input: AnnouncementCreateInput) {
  if (!isOrgMember(actor, organisationId)) throw notFound("Workspace not found.");
  assert(isOrgAdmin(actor, organisationId), "Only workspace administrators can post announcements.");
  const recipients = await db.membership.findMany({
    where: { organisationId, status: "ACTIVE", userId: { not: actor.user.id }, user: { status: "ACTIVE" } },
    select: { userId: true },
    take: 1000,
  });
  const orgName = actor.memberships.find((m) => m.organisationId === organisationId)?.organisation.name ?? "your workspace";
  return db.$transaction(async (tx) => {
    const a = await tx.announcement.create({
      data: { organisationId, authorId: actor.user.id, title: input.title, body: input.body, pinned: input.pinned },
      select: SELECT,
    });
    await audit(
      { actorId: actor.user.id, action: "announcement.create", entityType: "Announcement", entityId: a.id, organisationId, metadata: { pinned: input.pinned } },
      tx,
    );
    for (const r of recipients) {
      await notify(
        {
          userId: r.userId,
          type: "announcement",
          title: `Announcement in ${orgName}`,
          body: input.title,
          link: `/portal/workspaces/${organisationId}`,
        },
        tx,
      );
    }
    return a;
  });
}

export async function deleteAnnouncement(actor: AuthedActor, announcementId: string) {
  const a = await db.announcement.findFirst({
    where: { AND: [{ id: announcementId }, visibleAnnouncements(actor)] },
    select: { id: true, organisationId: true },
  });
  if (!a) throw notFound("Announcement not found.");
  assert(isOrgAdmin(actor, a.organisationId), "Only workspace administrators can delete announcements.");
  await db.$transaction(async (tx) => {
    await tx.announcement.delete({ where: { id: a.id } });
    await audit({ actorId: actor.user.id, action: "announcement.delete", entityType: "Announcement", entityId: a.id, organisationId: a.organisationId }, tx);
  });
}

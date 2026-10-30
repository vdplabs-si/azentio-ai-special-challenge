import "server-only";
import type { InquiryStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { forbidden, notFound } from "@/lib/api/errors";
import { pageArgs, toPage, type Pagination } from "@/lib/api/pagination";
import { rateLimit } from "@/lib/api/rate-limit";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert, isOrgAdmin, isOrgMember, isPortalAdmin } from "@/lib/authz/permissions";
import type { TicketCreateInput } from "@/components/portal/collab/schemas";

const SELECT = {
  id: true,
  organisationId: true,
  subject: true,
  body: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, email: true } },
} as const;

/** Support tickets are visible to members of the (client) organisation and to portal admins (the support team). */
async function requireTicketOrg(actor: AuthedActor, organisationId: string) {
  const member = isOrgMember(actor, organisationId);
  if (!member && !isPortalAdmin(actor)) throw notFound("Workspace not found.");
  const org = await db.organisation.findUnique({ where: { id: organisationId }, select: { id: true, name: true, type: true } });
  if (!org) throw notFound("Workspace not found.");
  if (org.type !== "CLIENT") throw notFound("Support tickets are available in client workspaces.");
  return { org, member };
}

export async function listTickets(actor: AuthedActor, organisationId: string, page: Pagination & { status?: InquiryStatus }) {
  await requireTicketOrg(actor, organisationId);
  const rows = await db.supportTicket.findMany({
    where: { organisationId, ...(page.status ? { status: page.status } : {}) },
    select: SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(page),
  });
  return { ...toPage(rows, page), canUpdate: isPortalAdmin(actor) || isOrgAdmin(actor, organisationId) };
}
export type TicketRow = Awaited<ReturnType<typeof listTickets>>["items"][number];

export async function createTicket(actor: AuthedActor, organisationId: string, input: TicketCreateInput) {
  const { org, member } = await requireTicketOrg(actor, organisationId);
  if (!member) throw forbidden("Only members of this workspace can open tickets for it.");
  await rateLimit(`ticket:${actor.user.id}`, 10, 3600);
  const admins = await db.roleGrant.findMany({
    where: { role: { in: ["PORTAL_ADMIN", "SUPER_ADMIN"] }, revokedAt: null, userId: { not: actor.user.id } },
    select: { userId: true },
    distinct: ["userId"],
    take: 100,
  });
  return db.$transaction(async (tx) => {
    const t = await tx.supportTicket.create({
      data: { organisationId, authorId: actor.user.id, subject: input.subject, body: input.body },
      select: SELECT,
    });
    await audit({ actorId: actor.user.id, action: "support_ticket.create", entityType: "SupportTicket", entityId: t.id, organisationId }, tx);
    for (const a of admins) {
      await notify(
        {
          userId: a.userId,
          type: "support_ticket.created",
          title: `New support ticket from ${org.name}`,
          body: input.subject,
          link: `/portal/workspaces/${organisationId}?tab=support`,
        },
        tx,
      );
    }
    return t;
  });
}

export async function updateTicketStatus(actor: AuthedActor, ticketId: string, status: InquiryStatus) {
  const t = await db.supportTicket.findUnique({ where: { id: ticketId }, select: { id: true, organisationId: true, status: true, authorId: true, subject: true } });
  if (!t || !(isOrgMember(actor, t.organisationId) || isPortalAdmin(actor))) throw notFound("Ticket not found.");
  assert(isPortalAdmin(actor) || isOrgAdmin(actor, t.organisationId), "Only workspace administrators or Azentio support can update tickets.");
  if (t.status === status) return;
  await db.$transaction(async (tx) => {
    await tx.supportTicket.update({ where: { id: t.id }, data: { status } });
    await audit(
      { actorId: actor.user.id, action: "support_ticket.status", entityType: "SupportTicket", entityId: t.id, organisationId: t.organisationId, metadata: { from: t.status, to: status } },
      tx,
    );
    if (t.authorId !== actor.user.id) {
      await notify(
        {
          userId: t.authorId,
          type: "support_ticket.status",
          title: "Support ticket updated",
          body: `“${t.subject}” is now ${status.toLowerCase().replace("_", " ")}.`,
          link: `/portal/workspaces/${t.organisationId}?tab=support`,
        },
        tx,
      );
    }
  });
}

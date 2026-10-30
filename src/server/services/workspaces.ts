import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { MembershipStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { AppError, badRequest, conflict, forbidden, notFound } from "@/lib/api/errors";
import { pageArgs, toPage, type Pagination } from "@/lib/api/pagination";
import { rateLimit } from "@/lib/api/rate-limit";
import type { AuthedActor } from "@/lib/authz/actor";
import {
  assert,
  canAssignMembershipRole,
  canDeleteWorkspace,
  canEditWorkspace,
  canManageMembers,
  isOrgAdmin,
  isOrgMember,
  isPortalAdmin,
  orgRole,
} from "@/lib/authz/permissions";
import { visibleOrganisations, visibleProjects } from "@/lib/authz/visibility";
import { createInvitation, revokeInvitation } from "@/server/services/invitations";
import { isUniqueViolation } from "@/server/services/projects";
import { wouldRemoveLastOwner } from "@/components/portal/collab/metrics";
import type {
  InvitationCreateInput,
  MemberUpdateInput,
  WorkspaceCreateInput,
  WorkspaceUpdateInput,
} from "@/components/portal/collab/schemas";

const workspaceLink = (id: string) => `/portal/workspaces/${id}`;
const blankToNull = (v: string | undefined) => (v === undefined ? undefined : v.trim() === "" ? null : v.trim());

/** Permission flags for the UI (presentation only; every mutation re-checks server-side). */
export function workspacePermissions(actor: AuthedActor, org: { id: string; type: string }) {
  const member = isOrgMember(actor, org.id);
  const portalAdmin = isPortalAdmin(actor);
  return {
    isMember: member,
    myRole: orgRole(actor, org.id),
    isPortalAdmin: portalAdmin,
    isOrgAdmin: isOrgAdmin(actor, org.id),
    canViewMembers: member || portalAdmin,
    canManageMembers: canManageMembers(actor, org.id),
    canEdit: canEditWorkspace(actor, org.id),
    canDelete: canDeleteWorkspace(actor, org.id) && org.type !== "INTERNAL",
    canEditSlug: portalAdmin,
    canViewSupport: org.type === "CLIENT" && (member || portalAdmin),
    canCreateTicket: org.type === "CLIENT" && member,
    canUpdateTickets: org.type === "CLIENT" && (portalAdmin || isOrgAdmin(actor, org.id)),
  };
}
export type WorkspacePermissions = ReturnType<typeof workspacePermissions>;

// ── Workspaces ────────────────────────────────────────────────────────────────

export async function listWorkspaces(actor: AuthedActor, page: Pagination & { q?: string }) {
  const and: Prisma.OrganisationWhereInput[] = [visibleOrganisations(actor)];
  if (page.q) and.push({ OR: [{ name: { contains: page.q, mode: "insensitive" } }, { slug: { contains: page.q, mode: "insensitive" } }] });
  const rows = await db.organisation.findMany({
    where: { AND: and },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      status: true,
      industry: true,
      region: true,
      description: true,
      createdAt: true,
      _count: {
        select: {
          memberships: { where: { status: "ACTIVE" } },
          // Counts compose the same visibility as lists: non-members see 0 private projects.
          projects: { where: { AND: [visibleProjects(actor), { status: "ACTIVE" }] } },
        },
      },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }, { id: "asc" }],
    ...pageArgs(page),
  });
  const result = toPage(rows, page);
  return {
    ...result,
    items: result.items.map(({ _count, ...o }) => ({
      ...o,
      memberCount: _count.memberships,
      activeProjectCount: isOrgMember(actor, o.id) ? _count.projects : null,
      myRole: orgRole(actor, o.id),
    })),
  };
}
export type WorkspaceListItem = Awaited<ReturnType<typeof listWorkspaces>>["items"][number];

async function findVisibleOrg(actor: AuthedActor, organisationId: string) {
  const org = await db.organisation.findFirst({
    where: { AND: [{ id: organisationId }, visibleOrganisations(actor)] },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      status: true,
      industry: true,
      region: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!org) throw notFound("Workspace not found.");
  return org;
}

export async function getWorkspace(actor: AuthedActor, organisationId: string) {
  const org = await findVisibleOrg(actor, organisationId);
  const [memberCount, activeProjectCount] = await Promise.all([
    db.membership.count({ where: { organisationId, status: "ACTIVE" } }),
    isOrgMember(actor, organisationId)
      ? db.project.count({ where: { AND: [visibleProjects(actor), { organisationId, status: "ACTIVE" }] } })
      : Promise.resolve(null),
  ]);
  return { workspace: { ...org, memberCount, activeProjectCount }, permissions: workspacePermissions(actor, org) };
}
export type WorkspaceDetail = Awaited<ReturnType<typeof getWorkspace>>;

/** Portal admins create client tenants (clients cannot create tenants). */
export async function createWorkspace(actor: AuthedActor, input: WorkspaceCreateInput) {
  assert(isPortalAdmin(actor), "Only portal administrators can create workspaces.");
  const slugTaken = await db.organisation.findUnique({ where: { slug: input.slug }, select: { id: true } });
  if (slugTaken) throw new AppError("validation_failed", "That slug is already in use.", { slug: ["That slug is already in use."] });

  let org;
  try {
    org = await db.$transaction(async (tx) => {
      const o = await tx.organisation.create({
        data: {
          name: input.name,
          slug: input.slug,
          type: "CLIENT",
          industry: blankToNull(input.industry) ?? null,
          region: blankToNull(input.region) ?? null,
          description: blankToNull(input.description) ?? null,
        },
        select: { id: true, name: true, slug: true, type: true },
      });
      await audit(
        { actorId: actor.user.id, action: "workspace.create", entityType: "Organisation", entityId: o.id, organisationId: o.id, metadata: { type: "CLIENT", slug: o.slug } },
        tx,
      );
      return o;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("validation_failed", "That slug is already in use.", { slug: ["That slug is already in use."] });
    throw e;
  }

  let invitation: Awaited<ReturnType<typeof createInvitation>> | null = null;
  let invitationError: string | null = null;
  if (input.ownerEmail) {
    try {
      invitation = await createInvitation(actor, org.id, input.ownerEmail, "OWNER");
    } catch (e) {
      invitationError = e instanceof AppError ? e.message : "The owner invitation could not be created.";
    }
  }
  return { workspace: org, invitation, invitationError };
}

export async function updateWorkspace(actor: AuthedActor, organisationId: string, input: WorkspaceUpdateInput) {
  const org = await findVisibleOrg(actor, organisationId);
  assert(canEditWorkspace(actor, org.id), "Only workspace administrators can edit workspace settings.");
  const data: Prisma.OrganisationUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.industry !== undefined) data.industry = blankToNull(input.industry);
  if (input.region !== undefined) data.region = blankToNull(input.region);
  if (input.description !== undefined) data.description = blankToNull(input.description);
  if (input.slug !== undefined && input.slug !== org.slug) {
    assert(isPortalAdmin(actor), "Only portal administrators can change a workspace slug.");
    const taken = await db.organisation.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (taken) throw new AppError("validation_failed", "That slug is already in use.", { slug: ["That slug is already in use."] });
    data.slug = input.slug;
  }
  if (Object.keys(data).length === 0) return;
  try {
    await db.$transaction(async (tx) => {
      await tx.organisation.update({ where: { id: org.id }, data });
      await audit(
        { actorId: actor.user.id, action: "workspace.update", entityType: "Organisation", entityId: org.id, organisationId: org.id, metadata: { fields: Object.keys(data) } },
        tx,
      );
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new AppError("validation_failed", "That slug is already in use.", { slug: ["That slug is already in use."] });
    throw e;
  }
}

/** Owners / portal admins delete client workspaces after typing the exact name. Never the INTERNAL org. */
export async function deleteWorkspace(actor: AuthedActor, organisationId: string, confirmName: string) {
  const org = await findVisibleOrg(actor, organisationId);
  assert(canDeleteWorkspace(actor, org.id), "Only the workspace owner or a portal administrator can delete this workspace.");
  if (org.type === "INTERNAL") throw forbidden("The internal Azentio workspace cannot be deleted.");
  if (confirmName.trim() !== org.name.trim()) throw badRequest("The confirmation does not match the workspace name.");
  await db.$transaction(async (tx) => {
    await tx.organisation.delete({ where: { id: org.id } });
    // The organisation row is gone, so the event is recorded without the FK (details in metadata).
    await audit(
      { actorId: actor.user.id, action: "workspace.delete", entityType: "Organisation", entityId: org.id, organisationId: null, metadata: { organisationId: org.id, slug: org.slug, type: org.type } },
      tx,
    );
  });
}

/** Active people (ACTIVE membership and account) in a workspace the actor belongs to — for pickers. */
export async function activePeople(actor: AuthedActor, organisationId: string) {
  if (!isOrgMember(actor, organisationId)) throw notFound("Workspace not found.");
  const rows = await db.membership.findMany({
    where: { organisationId, status: "ACTIVE", user: { status: "ACTIVE" } },
    select: { role: true, user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { user: { name: "asc" } },
    take: 2000,
  });
  return rows.map((r) => ({ ...r.user, orgRole: r.role }));
}

// ── Members ───────────────────────────────────────────────────────────────────

const MEMBER_SELECT = {
  id: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  termsAcceptedAt: true,
  user: { select: { id: true, name: true, email: true, image: true, title: true } },
} satisfies Prisma.MembershipSelect;

export async function listMembers(actor: AuthedActor, organisationId: string, page: Pagination & { status?: MembershipStatus; q?: string }) {
  const org = await findVisibleOrg(actor, organisationId);
  const perms = workspacePermissions(actor, org);
  if (!perms.canViewMembers) throw notFound("Workspace not found.");
  const and: Prisma.MembershipWhereInput[] = [{ organisationId }];
  // Administrators see every state; other members see the active directory only.
  if (!perms.canManageMembers) and.push({ status: "ACTIVE" });
  else if (page.status) and.push({ status: page.status });
  if (page.q) and.push({ user: { OR: [{ name: { contains: page.q, mode: "insensitive" } }, { email: { contains: page.q, mode: "insensitive" } }] } });
  const rows = await db.membership.findMany({
    where: { AND: and },
    select: MEMBER_SELECT,
    orderBy: [{ role: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    ...pageArgs(page),
  });
  return toPage(rows, page);
}
export type MemberRow = Awaited<ReturnType<typeof listMembers>>["items"][number];

async function loadTargetMembership(actor: AuthedActor, organisationId: string, userId: string) {
  const m = await db.membership.findUnique({
    where: { userId_organisationId: { userId, organisationId } },
    select: { ...MEMBER_SELECT, organisationId: true, organisation: { select: { id: true, name: true, type: true } } },
  });
  // Authority is always evaluated against the target membership's own organisation.
  if (!m || !(isOrgMember(actor, m.organisationId) || isPortalAdmin(actor))) throw notFound("Member not found.");
  return m;
}

const activeOwnerCount = (organisationId: string, tx: Prisma.TransactionClient | typeof db = db) =>
  tx.membership.count({ where: { organisationId, role: "OWNER", status: "ACTIVE" } });

export async function updateMember(actor: AuthedActor, organisationId: string, userId: string, input: MemberUpdateInput) {
  const m = await loadTargetMembership(actor, organisationId, userId);
  const orgId = m.organisationId;
  assert(canManageMembers(actor, orgId), "Only workspace administrators can manage members.");
  if (userId === actor.user.id) throw forbidden("You cannot change your own role or status.");
  // You may only manage members whose current role you could grant (admins cannot touch owners).
  assert(canAssignMembershipRole(actor, orgId, m.role), "You cannot manage a member with this role.");
  if (input.role !== undefined) assert(canAssignMembershipRole(actor, orgId, input.role), "You cannot grant that role.");

  const roleChange = input.role !== undefined && input.role !== m.role;
  const statusChange = input.status !== undefined && input.status !== m.status;
  if (!roleChange && !statusChange) return;
  if (statusChange) {
    const allowed = (m.status === "ACTIVE" && input.status === "SUSPENDED") || (m.status === "SUSPENDED" && input.status === "ACTIVE");
    if (!allowed) throw conflict(`A ${m.status.toLowerCase().replace(/_/g, " ")} membership cannot be changed to ${input.status!.toLowerCase()}.`);
  }
  if (roleChange && (m.status === "REVOKED" || m.status === "PENDING_APPROVAL")) throw conflict("Re-invite this person instead of changing the role of an inactive membership.");

  await db.$transaction(async (tx) => {
    const owners = await activeOwnerCount(orgId, tx);
    if (wouldRemoveLastOwner(m, { role: input.role, status: input.status }, owners)) {
      throw conflict("A workspace must keep at least one active owner.");
    }
    await tx.membership.update({
      where: { id: m.id },
      data: { ...(roleChange ? { role: input.role } : {}), ...(statusChange ? { status: input.status } : {}) },
    });
    if (roleChange) {
      await audit(
        { actorId: actor.user.id, action: "membership.role_change", entityType: "Membership", entityId: m.id, organisationId: orgId, metadata: { userId, from: m.role, to: input.role! } },
        tx,
      );
      await notify(
        {
          userId,
          type: "membership.role_changed",
          title: "Your workspace role changed",
          body: `${actor.user.name} changed your role in ${m.organisation.name} to ${input.role!.toLowerCase()}.`,
          link: workspaceLink(orgId),
        },
        tx,
      );
    }
    if (statusChange) {
      const suspended = input.status === "SUSPENDED";
      await audit(
        {
          actorId: actor.user.id,
          action: suspended ? "membership.suspend" : "membership.reactivate",
          entityType: "Membership",
          entityId: m.id,
          organisationId: orgId,
          metadata: { userId, from: m.status, to: input.status! },
        },
        tx,
      );
      await notify(
        {
          userId,
          type: suspended ? "membership.suspended" : "membership.reactivated",
          title: suspended ? "Workspace access suspended" : "Workspace access restored",
          body: suspended
            ? `Your access to ${m.organisation.name} has been suspended by an administrator.`
            : `Your access to ${m.organisation.name} has been restored.`,
          link: suspended ? undefined : workspaceLink(orgId),
        },
        tx,
      );
    }
  });
}

/** Administrators remove members; members may leave a client workspace themselves. */
export async function removeMember(actor: AuthedActor, organisationId: string, userId: string) {
  const m = await loadTargetMembership(actor, organisationId, userId);
  const orgId = m.organisationId;
  const self = userId === actor.user.id;
  if (self) {
    if (m.organisation.type === "INTERNAL") throw forbidden("Employee access is managed by portal administrators.");
  } else {
    assert(canManageMembers(actor, orgId), "Only workspace administrators can remove members.");
    assert(canAssignMembershipRole(actor, orgId, m.role), "You cannot remove a member with this role.");
  }
  if (m.status === "REVOKED") throw conflict("This member has already been removed.");

  await db.$transaction(async (tx) => {
    const owners = await activeOwnerCount(orgId, tx);
    if (wouldRemoveLastOwner(m, { remove: true }, owners)) throw conflict("A workspace must keep at least one active owner.");
    await tx.membership.update({ where: { id: m.id }, data: { status: "REVOKED" } });
    // Drop explicit project memberships in this workspace (access already ends with the membership).
    await tx.projectMember.deleteMany({ where: { userId, project: { organisationId: orgId } } });
    await audit(
      { actorId: actor.user.id, action: self ? "membership.leave" : "membership.remove", entityType: "Membership", entityId: m.id, organisationId: orgId, metadata: { userId, role: m.role } },
      tx,
    );
    if (!self) {
      await notify(
        {
          userId,
          type: "membership.removed",
          title: "Removed from a workspace",
          body: `${actor.user.name} removed you from ${m.organisation.name}.`,
        },
        tx,
      );
    }
  });
}

// ── Invitations ───────────────────────────────────────────────────────────────

export async function listInvitations(actor: AuthedActor, organisationId: string, page: Pagination & { status?: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED" }) {
  const org = await findVisibleOrg(actor, organisationId);
  if (!canManageMembers(actor, org.id)) {
    if (isOrgMember(actor, org.id)) throw forbidden("Only workspace administrators can view invitations.");
    throw notFound("Workspace not found.");
  }
  // Keep stored state honest: pending invitations past their expiry are EXPIRED.
  await db.invitation.updateMany({ where: { organisationId, status: "PENDING", expiresAt: { lt: new Date() } }, data: { status: "EXPIRED" } });
  const rows = await db.invitation.findMany({
    where: { organisationId, ...(page.status ? { status: page.status } : {}) },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      acceptedAt: true,
      invitedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(page),
  });
  return toPage(rows, page);
}
export type InvitationRow = Awaited<ReturnType<typeof listInvitations>>["items"][number];

export async function inviteMember(actor: AuthedActor, organisationId: string, input: InvitationCreateInput) {
  await findVisibleOrg(actor, organisationId);
  await rateLimit(`invite:${actor.user.id}`, 30, 3600);
  // createInvitation enforces canManageMembers + canAssignMembershipRole and INTERNAL-org rules.
  return createInvitation(actor, organisationId, input.email, input.role);
}

export async function revokeWorkspaceInvitation(actor: AuthedActor, organisationId: string, invitationId: string) {
  const inv = await db.invitation.findUnique({ where: { id: invitationId }, select: { organisationId: true } });
  if (!inv || inv.organisationId !== organisationId || !canManageMembers(actor, inv.organisationId)) throw notFound("Invitation not found.");
  await revokeInvitation(actor, invitationId);
}

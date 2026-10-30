import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { InquiryStatus, PlatformRole } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert, can, canGrantRole, isSuperAdmin } from "@/lib/authz/permissions";
import { badRequest, conflict, forbidden, notFound } from "@/lib/api/errors";
import { pageArgs, paginationSchema, toPage } from "@/lib/api/pagination";
import { audit } from "@/lib/audit";
import { notify, notifyMany, type NotifyInput } from "@/lib/notify";
import { destroyAllSessions } from "@/lib/auth/session";

/**
 * Platform administration (PDF §03 / IAM-02). Every function enforces its own permission
 * (default deny) — pages and routes are thin. Privileged mutations are audited; affected
 * users are notified. Admin metadata access never implies access to private client content:
 * that needs an explicit, time-boxed SupportAccessGrant (see requestSupportAccess).
 */

type Tx = Prisma.TransactionClient;

export const ALL_PLATFORM_ROLES = Object.values(PlatformRole);
const ADMIN_ROLES: PlatformRole[] = ["SUPER_ADMIN", "PORTAL_ADMIN"];
export const SUPPORT_ACCESS_MINUTES = 60;

/** Empty query-string values ("" from GET forms) are treated as absent. */
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);
const optEnum = <T extends Record<string, string>>(e: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), z.enum(e).optional());
const optDate = z.preprocess((v) => (v === "" ? undefined : v), z.coerce.date().optional());

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";

const roleLabel = (r: string) => r.replace(/_/g, " ").toLowerCase();

async function orgAdminIds(organisationId: string, tx: Tx | typeof db = db) {
  const rows = await tx.membership.findMany({
    where: { organisationId, status: "ACTIVE", role: { in: ["OWNER", "ADMIN"] }, user: { status: "ACTIVE" } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

// ───────────────────────────── Overview ─────────────────────────────

export async function adminOverview(actor: AuthedActor) {
  assert(can.manageUsers(actor));
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [
    usersActive,
    usersDeactivated,
    orgsInternal,
    orgsClient,
    orgsSuspended,
    pendingApprovals,
    openDemoRequests,
    openHackathonRegistrations,
    moderationSubmitted,
    openReports,
    auditLast24h,
    activeSupportGrants,
    activeAdminGrants,
  ] = await Promise.all([
    db.user.count({ where: { status: "ACTIVE" } }),
    db.user.count({ where: { status: "DEACTIVATED" } }),
    db.organisation.count({ where: { type: "INTERNAL" } }),
    db.organisation.count({ where: { type: "CLIENT" } }),
    db.organisation.count({ where: { status: "SUSPENDED" } }),
    db.membership.count({ where: { status: "PENDING_APPROVAL", organisation: { type: "INTERNAL" } } }),
    db.demoRequest.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
    db.hackathonRegistration.count({ where: { status: { in: ["NEW", "IN_PROGRESS"] } } }),
    // Moderation backlog is exposed as a COUNT only — no observation content reaches admin views.
    db.observation.count({ where: { status: "SUBMITTED" } }),
    db.contributionReport.count({ where: { status: "OPEN" } }),
    db.auditEvent.count({ where: { createdAt: { gte: since } } }),
    db.supportAccessGrant.count({ where: { revokedAt: null, expiresAt: { gt: now } } }),
    db.roleGrant.count({ where: { revokedAt: null, role: { in: ADMIN_ROLES } } }),
  ]);
  return {
    users: { active: usersActive, deactivated: usersDeactivated },
    organisations: { internal: orgsInternal, client: orgsClient, suspended: orgsSuspended },
    pendingApprovals,
    openDemoRequests,
    openHackathonRegistrations,
    moderationBacklog: { submitted: moderationSubmitted, openReports },
    auditLast24h,
    activeSupportGrants,
    activeAdminGrants,
  };
}

/** Badge counts for the organisations page tabs. */
export async function organisationTabCounts(actor: AuthedActor) {
  assert(can.manageOrganisations(actor));
  const [pendingApprovals, activeSupport] = await Promise.all([
    db.membership.count({ where: { status: "PENDING_APPROVAL", organisation: { type: "INTERNAL" } } }),
    db.supportAccessGrant.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  return { pendingApprovals, activeSupport };
}

// ───────────────────────────── Users & platform grants ─────────────────────────────

export const userListQuery = paginationSchema.extend({
  q: optText(100),
  status: optEnum({ ACTIVE: "ACTIVE", DEACTIVATED: "DEACTIVATED" } as const),
});
export type UserListQuery = z.infer<typeof userListQuery>;

/** Roles the actor may still grant to `userId` (excluding roles already held). */
export function grantableRoles(actor: AuthedActor, userId: string, held: readonly PlatformRole[]) {
  return ALL_PLATFORM_ROLES.filter((r) => !held.includes(r) && canGrantRole(actor, r, userId));
}

/** Whether the actor may activate/deactivate a user (never self; admins only by a super admin). */
export function canChangeUserStatus(actor: AuthedActor, userId: string, held: readonly PlatformRole[]) {
  if (!can.manageUsers(actor) || userId === actor.user.id) return false;
  if (held.some((r) => ADMIN_ROLES.includes(r))) return isSuperAdmin(actor);
  return true;
}

export async function listUsers(actor: AuthedActor, query: UserListQuery) {
  assert(can.manageUsers(actor));
  const where: Prisma.UserWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const rows = await db.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      status: true,
      emailVerifiedAt: true,
      lastLoginAt: true,
      createdAt: true,
      memberships: {
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, status: true, organisation: { select: { id: true, name: true, type: true } } },
      },
      roleGrants: {
        where: { revokedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, role: true, reason: true, createdAt: true, grantedBy: { select: { name: true, email: true } } },
      },
    },
    ...pageArgs(query),
  });
  const page = toPage(rows, query);
  return {
    nextCursor: page.nextCursor,
    items: page.items.map((u) => {
      const held = u.roleGrants.map((g) => g.role);
      return {
        ...u,
        isSelf: u.id === actor.user.id,
        canChangeStatus: canChangeUserStatus(actor, u.id, held),
        grantableRoles: grantableRoles(actor, u.id, held),
        roleGrants: u.roleGrants.map((g) => ({ ...g, revocable: canGrantRole(actor, g.role, u.id) })),
      };
    }),
  };
}

export const userStatusSchema = z.object({ status: z.enum(["ACTIVE", "DEACTIVATED"]) });

export async function setUserStatus(actor: AuthedActor, userId: string, input: z.infer<typeof userStatusSchema>) {
  assert(can.manageUsers(actor));
  if (userId === actor.user.id) throw forbidden("You cannot change the status of your own account.");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, roleGrants: { where: { revokedAt: null }, select: { role: true } } },
  });
  if (!user) throw notFound();
  if (!canChangeUserStatus(actor, userId, user.roleGrants.map((g) => g.role))) {
    throw forbidden("Only a super administrator can change the status of an administrator account.");
  }
  if (user.status === input.status) return { id: user.id, status: user.status };

  const deactivating = input.status === "DEACTIVATED";
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: input.status } });
    await audit(
      {
        actorId: actor.user.id,
        action: deactivating ? "user.deactivate" : "user.activate",
        entityType: "User",
        entityId: userId,
        metadata: { from: user.status, to: input.status },
      },
      tx,
    );
    await notify(
      {
        userId,
        type: deactivating ? "account.deactivated" : "account.activated",
        title: deactivating ? "Your account was deactivated" : "Your account was reactivated",
        body: deactivating
          ? "A portal administrator deactivated your azentio.ai account. Contact your administrator if you believe this is a mistake."
          : "A portal administrator reactivated your azentio.ai account. You can sign in again.",
        link: "/portal",
        email: true,
      },
      tx,
    );
  });
  // Deactivation takes effect immediately: every existing session is revoked.
  if (deactivating) await destroyAllSessions(userId);
  return { id: userId, status: input.status };
}

export const grantRoleSchema = z.object({
  role: z.enum(PlatformRole),
  reason: z.string().trim().min(5, "Give a reason of at least 5 characters.").max(300),
});

export async function grantRole(actor: AuthedActor, userId: string, input: z.infer<typeof grantRoleSchema>) {
  assert(can.manageUsers(actor));
  if (userId === actor.user.id) throw forbidden("You cannot change your own platform roles.");
  if (!canGrantRole(actor, input.role, userId)) {
    throw forbidden(
      ADMIN_ROLES.includes(input.role)
        ? "Only a super administrator can grant administrator roles."
        : "You are not allowed to grant this role.",
    );
  }
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
  if (!user) throw notFound();
  if (user.status !== "ACTIVE") throw conflict("Reactivate the account before granting roles.");

  const grant = await db.$transaction(async (tx) => {
    const existing = await tx.roleGrant.findFirst({ where: { userId, role: input.role, revokedAt: null }, select: { id: true } });
    if (existing) throw conflict("This user already holds this role.");
    const created = await tx.roleGrant.create({
      data: { userId, role: input.role, reason: input.reason, grantedById: actor.user.id },
      select: { id: true, role: true, reason: true, createdAt: true },
    });
    await audit(
      {
        actorId: actor.user.id,
        action: "role.grant",
        entityType: "RoleGrant",
        entityId: created.id,
        metadata: { userId, role: input.role, reason: input.reason },
      },
      tx,
    );
    await notify(
      {
        userId,
        type: "role.granted",
        title: `You were granted the ${roleLabel(input.role)} role`,
        body: `Reason: ${input.reason}`,
        link: "/portal/profile",
      },
      tx,
    );
    return created;
  });
  return { grant };
}

export async function revokeGrant(actor: AuthedActor, grantId: string) {
  assert(can.manageUsers(actor));
  const grant = await db.roleGrant.findUnique({
    where: { id: grantId },
    select: { id: true, userId: true, role: true, revokedAt: true },
  });
  if (!grant || grant.revokedAt) throw notFound();
  if (grant.userId === actor.user.id) throw forbidden("You cannot change your own platform roles.");
  if (!canGrantRole(actor, grant.role, grant.userId)) {
    throw forbidden("Only a super administrator can revoke administrator roles.");
  }
  if (grant.role === "SUPER_ADMIN") {
    const others = await db.roleGrant.count({
      where: { role: "SUPER_ADMIN", revokedAt: null, id: { not: grant.id }, user: { status: "ACTIVE" } },
    });
    if (others === 0) throw conflict("The last active super administrator grant cannot be revoked.");
  }
  await db.$transaction(async (tx) => {
    await tx.roleGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
    await audit(
      {
        actorId: actor.user.id,
        action: "role.revoke",
        entityType: "RoleGrant",
        entityId: grant.id,
        metadata: { userId: grant.userId, role: grant.role },
      },
      tx,
    );
    await notify(
      {
        userId: grant.userId,
        type: "role.revoked",
        title: `Your ${roleLabel(grant.role)} role was revoked`,
        body: "A portal administrator revoked this platform role. Contact your administrator if you have questions.",
        link: "/portal/profile",
      },
      tx,
    );
  });
  return { ok: true };
}

// ───────────────────────────── Organisations & entitlements ─────────────────────────────

export const orgListQuery = paginationSchema.extend({
  q: optText(100),
  type: optEnum({ INTERNAL: "INTERNAL", CLIENT: "CLIENT" } as const),
  status: optEnum({ ACTIVE: "ACTIVE", SUSPENDED: "SUSPENDED" } as const),
});
export type OrgListQuery = z.infer<typeof orgListQuery>;

export async function listOrganisations(actor: AuthedActor, query: OrgListQuery) {
  assert(can.manageOrganisations(actor));
  const where: Prisma.OrganisationWhereInput = {
    ...(query.type ? { type: query.type } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? { OR: [{ name: { contains: query.q, mode: "insensitive" } }, { slug: { contains: query.q, mode: "insensitive" } }] }
      : {}),
  };
  const rows = await db.organisation.findMany({
    where,
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      status: true,
      industry: true,
      region: true,
      createdAt: true,
      _count: { select: { memberships: { where: { status: "ACTIVE" } } } },
      entitlements: {
        orderBy: { createdAt: "asc" },
        select: { id: true, expiresAt: true, createdAt: true, offering: { select: { id: true, name: true, slug: true } } },
      },
    },
    ...pageArgs(query),
  });
  const page = toPage(rows, query);
  return {
    nextCursor: page.nextCursor,
    items: page.items.map(({ _count, ...o }) => ({ ...o, activeMembers: _count.memberships })),
  };
}

/** Offerings available for entitlement grants (reference data). */
export async function listOfferingsForEntitlements(actor: AuthedActor) {
  assert(can.manageEntitlements(actor));
  return db.offering.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, sandbox: true, category: true },
  });
}

/** Client organisations for support-access requests (names only). */
export async function listClientOrganisationOptions(actor: AuthedActor) {
  assert(can.requestSupportAccess(actor));
  return db.organisation.findMany({
    where: { type: "CLIENT", status: "ACTIVE" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
    take: 500,
  });
}

export const orgStatusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

export async function setOrganisationStatus(actor: AuthedActor, organisationId: string, input: z.infer<typeof orgStatusSchema>) {
  assert(can.manageOrganisations(actor));
  const org = await db.organisation.findUnique({ where: { id: organisationId }, select: { id: true, name: true, type: true, status: true } });
  if (!org) throw notFound();
  if (org.type === "INTERNAL") throw forbidden("The internal Azentio organisation cannot be suspended.");
  if (org.status === input.status) return { id: org.id, status: org.status };
  const suspending = input.status === "SUSPENDED";
  await db.$transaction(async (tx) => {
    // Recipients are resolved before suspension so administrators still hear about it.
    const admins = await orgAdminIds(org.id, tx);
    await tx.organisation.update({ where: { id: org.id }, data: { status: input.status } });
    await audit(
      {
        actorId: actor.user.id,
        action: suspending ? "organisation.suspend" : "organisation.reactivate",
        entityType: "Organisation",
        entityId: org.id,
        organisationId: org.id,
        metadata: { from: org.status, to: input.status },
      },
      tx,
    );
    await notifyMany(
      admins.map<NotifyInput>((userId) => ({
        userId,
        type: suspending ? "organisation.suspended" : "organisation.reactivated",
        title: suspending ? `${org.name} workspace was suspended` : `${org.name} workspace was reactivated`,
        body: suspending
          ? "Members can no longer access this workspace until an Azentio administrator reactivates it."
          : "Members can access this workspace again.",
        link: "/portal",
        email: true,
      })),
      tx,
    );
  });
  return { id: org.id, status: input.status };
}

export const entitlementSchema = z.object({
  offeringId: z.string().trim().min(1).max(64),
  expiresAt: z.coerce.date().nullable().optional(),
});

export async function grantEntitlement(actor: AuthedActor, organisationId: string, input: z.infer<typeof entitlementSchema>) {
  assert(can.manageEntitlements(actor));
  const now = new Date();
  if (input.expiresAt && input.expiresAt <= now) {
    throw badRequest("The expiry must be in the future.", { expiresAt: ["The expiry must be in the future."] });
  }
  const [org, offering] = await Promise.all([
    db.organisation.findUnique({ where: { id: organisationId }, select: { id: true, name: true, type: true } }),
    db.offering.findUnique({ where: { id: input.offeringId }, select: { id: true, name: true, slug: true } }),
  ]);
  if (!org) throw notFound();
  if (org.type !== "CLIENT") throw badRequest("Entitlements apply to client organisations only.");
  if (!offering) throw badRequest("Unknown offering.", { offeringId: ["Choose an offering."] });

  const existing = await db.entitlement.findUnique({
    where: { organisationId_offeringId: { organisationId: org.id, offeringId: offering.id } },
    select: { id: true, expiresAt: true },
  });
  if (existing && (existing.expiresAt === null || existing.expiresAt > now)) {
    throw conflict(`${org.name} is already entitled to ${offering.name}.`);
  }

  const entitlement = await db.$transaction(async (tx) => {
    const row = existing
      ? await tx.entitlement.update({
          where: { id: existing.id },
          data: { expiresAt: input.expiresAt ?? null, grantedById: actor.user.id },
          select: { id: true, expiresAt: true },
        })
      : await tx.entitlement.create({
          data: { organisationId: org.id, offeringId: offering.id, expiresAt: input.expiresAt ?? null, grantedById: actor.user.id },
          select: { id: true, expiresAt: true },
        });
    await audit(
      {
        actorId: actor.user.id,
        action: existing ? "entitlement.renew" : "entitlement.grant",
        entityType: "Entitlement",
        entityId: row.id,
        organisationId: org.id,
        metadata: { offering: offering.slug, expiresAt: row.expiresAt?.toISOString() ?? null },
      },
      tx,
    );
    const admins = await orgAdminIds(org.id, tx);
    await notifyMany(
      admins.map<NotifyInput>((userId) => ({
        userId,
        type: "entitlement.granted",
        title: `${offering.name} is now enabled for ${org.name}`,
        body: row.expiresAt
          ? `Access is available until ${row.expiresAt.toISOString().slice(0, 10)}.`
          : "Access has been enabled by Azentio.",
        link: "/portal/playground",
      })),
      tx,
    );
    return row;
  });
  return { entitlement };
}

export async function revokeEntitlement(actor: AuthedActor, entitlementId: string) {
  assert(can.manageEntitlements(actor));
  const ent = await db.entitlement.findUnique({
    where: { id: entitlementId },
    select: { id: true, organisationId: true, offering: { select: { slug: true, name: true } }, organisation: { select: { name: true } } },
  });
  if (!ent) throw notFound();
  await db.$transaction(async (tx) => {
    await tx.entitlement.delete({ where: { id: ent.id } });
    await audit(
      {
        actorId: actor.user.id,
        action: "entitlement.revoke",
        entityType: "Entitlement",
        entityId: ent.id,
        organisationId: ent.organisationId,
        metadata: { offering: ent.offering.slug },
      },
      tx,
    );
    const admins = await orgAdminIds(ent.organisationId, tx);
    await notifyMany(
      admins.map<NotifyInput>((userId) => ({
        userId,
        type: "entitlement.revoked",
        title: `${ent.offering.name} is no longer enabled for ${ent.organisation.name}`,
        body: "Contact your Azentio account team if you need access restored.",
        link: "/portal",
      })),
      tx,
    );
  });
  return { ok: true };
}

// ───────────────────────────── Employee approvals ─────────────────────────────

function employeeEligibility(user: { email: string; emailVerifiedAt: Date | null }) {
  const domain = env().EMPLOYEE_EMAIL_DOMAIN.toLowerCase();
  const onDomain = user.email.toLowerCase().endsWith(`@${domain}`);
  const verified = Boolean(user.emailVerifiedAt);
  return {
    verified,
    onDomain,
    eligible: verified && onDomain,
    domain,
  };
}

export async function listEmployeeApprovals(actor: AuthedActor, page: z.infer<typeof paginationSchema>) {
  assert(can.approveEmployees(actor));
  const rows = await db.membership.findMany({
    where: { status: "PENDING_APPROVAL", organisation: { type: "INTERNAL" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      role: true,
      createdAt: true,
      organisation: { select: { id: true, name: true } },
      user: { select: { id: true, name: true, email: true, title: true, emailVerifiedAt: true, status: true, createdAt: true } },
    },
    ...pageArgs(page),
  });
  const res = toPage(rows, page);
  return {
    domain: env().EMPLOYEE_EMAIL_DOMAIN.toLowerCase(),
    nextCursor: res.nextCursor,
    items: res.items.map((m) => ({ ...m, eligibility: employeeEligibility(m.user), isSelf: m.user.id === actor.user.id })),
  };
}

export const approvalDecisionSchema = z.object({ decision: z.enum(["approve", "reject"]) });

export async function decideEmployeeApproval(
  actor: AuthedActor,
  membershipId: string,
  input: z.infer<typeof approvalDecisionSchema>,
) {
  assert(can.approveEmployees(actor));
  const m = await db.membership.findUnique({
    where: { id: membershipId },
    select: {
      id: true,
      status: true,
      role: true,
      userId: true,
      organisation: { select: { id: true, name: true, type: true } },
      user: { select: { email: true, emailVerifiedAt: true, status: true } },
    },
  });
  if (!m || m.organisation.type !== "INTERNAL") throw notFound();
  if (m.userId === actor.user.id) throw forbidden("You cannot decide your own access request.");
  if (m.status !== "PENDING_APPROVAL") throw conflict("This request has already been decided.");

  const approve = input.decision === "approve";
  // Employee approval confers employee status only — never workspace administration of the
  // internal organisation (that is a separate, explicit change by a workspace administrator).
  const approvedRole = m.role === "VIEWER" ? "VIEWER" : "MEMBER";
  if (approve) {
    const e = employeeEligibility(m.user);
    if (!e.eligible) {
      throw conflict(
        !e.verified
          ? "The user has not verified their email address yet."
          : `Only verified @${e.domain} identities can be approved as employees.`,
      );
    }
    if (m.user.status !== "ACTIVE") throw conflict("The account is deactivated.");
  }

  await db.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: m.id },
      data: approve ? { status: "ACTIVE", role: approvedRole, approvedById: actor.user.id } : { status: "REVOKED" },
    });
    await audit(
      {
        actorId: actor.user.id,
        action: approve ? "membership.approve" : "membership.reject",
        entityType: "Membership",
        entityId: m.id,
        organisationId: m.organisation.id,
        metadata: approve
          ? { userId: m.userId, role: approvedRole, ...(approvedRole !== m.role ? { requestedRole: m.role } : {}) }
          : { userId: m.userId },
      },
      tx,
    );
    await notify(
      {
        userId: m.userId,
        type: approve ? "membership.approved" : "membership.rejected",
        title: approve ? `Your access to ${m.organisation.name} was approved` : `Your access request to ${m.organisation.name} was declined`,
        body: approve
          ? "You can now use the employee areas of the azentio.ai portal."
          : "An administrator declined this request. Contact your manager or the portal team if you believe this is a mistake.",
        link: "/portal",
        email: true,
      },
      tx,
    );
  });
  return { id: m.id, status: approve ? "ACTIVE" : "REVOKED" };
}

// ───────────────────────────── Support access (time-boxed, audited) ─────────────────────────────

export const supportAccessSchema = z.object({
  organisationId: z.string().trim().min(1).max(64),
  reason: z.string().trim().min(10, "Explain why access is needed (at least 10 characters).").max(500),
});

export async function listSupportAccess(actor: AuthedActor) {
  assert(can.requestSupportAccess(actor));
  const now = new Date();
  const select = {
    id: true,
    reason: true,
    createdAt: true,
    expiresAt: true,
    revokedAt: true,
    organisation: { select: { id: true, name: true } },
    grantee: { select: { id: true, name: true, email: true } },
  } satisfies Prisma.SupportAccessGrantSelect;
  const [active, history] = await Promise.all([
    db.supportAccessGrant.findMany({
      where: { revokedAt: null, expiresAt: { gt: now } },
      orderBy: { expiresAt: "asc" },
      select,
    }),
    db.supportAccessGrant.findMany({
      where: { OR: [{ revokedAt: { not: null } }, { expiresAt: { lte: now } }] },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 25,
      select,
    }),
  ]);
  return {
    active: active.map((g) => ({ ...g, mine: g.grantee.id === actor.user.id })),
    history,
  };
}

export async function requestSupportAccess(actor: AuthedActor, input: z.infer<typeof supportAccessSchema>) {
  assert(can.requestSupportAccess(actor));
  const org = await db.organisation.findUnique({ where: { id: input.organisationId }, select: { id: true, name: true, type: true } });
  if (!org) throw badRequest("Unknown organisation.", { organisationId: ["Choose an organisation."] });
  if (org.type !== "CLIENT") throw badRequest("Support access applies to client organisations only.");
  const now = new Date();
  const existing = await db.supportAccessGrant.findFirst({
    where: { organisationId: org.id, granteeId: actor.user.id, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true },
  });
  if (existing) throw conflict(`You already hold active support access to ${org.name}.`);
  const expiresAt = new Date(now.getTime() + SUPPORT_ACCESS_MINUTES * 60 * 1000);

  const grant = await db.$transaction(async (tx) => {
    const created = await tx.supportAccessGrant.create({
      data: { organisationId: org.id, granteeId: actor.user.id, reason: input.reason, expiresAt },
      select: { id: true, expiresAt: true, organisationId: true },
    });
    // The reason is intentionally recorded in the audit log: it is the justification for access.
    await audit(
      {
        actorId: actor.user.id,
        action: "support_access.request",
        entityType: "SupportAccessGrant",
        entityId: created.id,
        organisationId: org.id,
        metadata: { reason: input.reason, expiresAt: expiresAt.toISOString(), minutes: SUPPORT_ACCESS_MINUTES },
      },
      tx,
    );
    // Transparency for the client: its administrators are told that support access was opened.
    const admins = await orgAdminIds(org.id, tx);
    await notifyMany(
      admins.map<NotifyInput>((userId) => ({
        userId,
        type: "support_access.opened",
        title: `Azentio support access opened for ${org.name}`,
        body: `A portal administrator opened time-boxed support access (${SUPPORT_ACCESS_MINUTES} minutes). The access and its justification are recorded in the audit log.`,
        link: "/portal",
      })),
      tx,
    );
    return created;
  });
  return { grant };
}

export async function revokeSupportAccess(actor: AuthedActor, grantId: string) {
  assert(can.requestSupportAccess(actor));
  const grant = await db.supportAccessGrant.findUnique({
    where: { id: grantId },
    select: { id: true, organisationId: true, granteeId: true, revokedAt: true, expiresAt: true },
  });
  if (!grant) throw notFound();
  if (grant.revokedAt || grant.expiresAt <= new Date()) throw conflict("This grant is no longer active.");
  await db.$transaction(async (tx) => {
    await tx.supportAccessGrant.update({ where: { id: grant.id }, data: { revokedAt: new Date() } });
    await audit(
      {
        actorId: actor.user.id,
        action: "support_access.revoke",
        entityType: "SupportAccessGrant",
        entityId: grant.id,
        organisationId: grant.organisationId,
        metadata: { granteeId: grant.granteeId },
      },
      tx,
    );
  });
  return { ok: true };
}

// ───────────────────────────── Inquiries & hackathon events ─────────────────────────────

export const INQUIRY_KINDS = ["demo", "hackathon"] as const;
export type InquiryKind = (typeof INQUIRY_KINDS)[number];

export const inquiryListQuery = paginationSchema.extend({
  kind: z.preprocess((v) => (v === "" ? undefined : v), z.enum(INQUIRY_KINDS).default("demo")),
  status: optEnum(InquiryStatus),
  eventId: optText(64),
  q: optText(100),
});
export type InquiryListQuery = z.infer<typeof inquiryListQuery>;

export async function listDemoRequests(actor: AuthedActor, query: InquiryListQuery) {
  assert(can.viewInquiries(actor));
  const where: Prisma.DemoRequestWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
            { company: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const rows = await db.demoRequest.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(query),
  });
  return toPage(rows, query);
}

export async function listHackathonRegistrations(actor: AuthedActor, query: InquiryListQuery) {
  assert(can.viewInquiries(actor));
  const where: Prisma.HackathonRegistrationWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.eventId ? { eventId: query.eventId } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
            { teamName: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const rows = await db.hackathonRegistration.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: { event: { select: { id: true, name: true, slug: true } } },
    ...pageArgs(query),
  });
  return toPage(rows, query);
}

export const inquiryStatusSchema = z.object({ status: z.enum(InquiryStatus) });

export async function updateInquiryStatus(
  actor: AuthedActor,
  kind: string,
  id: string,
  input: z.infer<typeof inquiryStatusSchema>,
) {
  assert(can.viewInquiries(actor));
  if (kind !== "demo" && kind !== "hackathon") throw notFound();
  const current =
    kind === "demo"
      ? await db.demoRequest.findUnique({ where: { id }, select: { id: true, status: true } })
      : await db.hackathonRegistration.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!current) throw notFound();
  if (current.status === input.status) return { id, status: current.status };
  await db.$transaction(async (tx) => {
    if (kind === "demo") await tx.demoRequest.update({ where: { id }, data: { status: input.status } });
    else await tx.hackathonRegistration.update({ where: { id }, data: { status: input.status } });
    await audit(
      {
        actorId: actor.user.id,
        action: "inquiry.status",
        entityType: kind === "demo" ? "DemoRequest" : "HackathonRegistration",
        entityId: id,
        metadata: { from: current.status, to: input.status },
      },
      tx,
    );
  });
  return { id, status: input.status };
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const hackathonEventBase = z.object({
  name: z.string().trim().min(3).max(120),
  slug: z.string().trim().toLowerCase().max(80).regex(SLUG, "Use lower-case letters, numbers and single hyphens."),
  description: z.string().trim().min(10).max(4000),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  registrationOpen: z.boolean(),
});
export const hackathonEventCreateSchema = hackathonEventBase.refine((v) => v.endsAt > v.startsAt, {
  message: "The end must be after the start.",
  path: ["endsAt"],
});
export const hackathonEventPatchSchema = hackathonEventBase.partial();

export async function listHackathonEvents(actor: AuthedActor) {
  assert(can.viewInquiries(actor));
  const rows = await db.hackathonEvent.findMany({
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      startsAt: true,
      endsAt: true,
      registrationOpen: true,
      createdAt: true,
      _count: { select: { registrations: true, teams: true } },
    },
  });
  return rows.map(({ _count, ...e }) => ({ ...e, registrations: _count.registrations, teams: _count.teams }));
}

async function assertEventSlugFree(slug: string, exceptId?: string) {
  const clash = await db.hackathonEvent.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== exceptId) throw conflict("Another event already uses this slug.");
}

export async function createHackathonEvent(actor: AuthedActor, input: z.infer<typeof hackathonEventCreateSchema>) {
  assert(can.viewInquiries(actor));
  await assertEventSlugFree(input.slug);
  try {
    const event = await db.$transaction(async (tx) => {
      const created = await tx.hackathonEvent.create({ data: input, select: { id: true, slug: true, name: true } });
      await audit(
        {
          actorId: actor.user.id,
          action: "hackathon_event.create",
          entityType: "HackathonEvent",
          entityId: created.id,
          metadata: { slug: created.slug, registrationOpen: input.registrationOpen },
        },
        tx,
      );
      return created;
    });
    return { event };
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("Another event already uses this slug.");
    throw e;
  }
}

export async function updateHackathonEvent(
  actor: AuthedActor,
  id: string,
  input: z.infer<typeof hackathonEventPatchSchema>,
) {
  assert(can.viewInquiries(actor));
  const current = await db.hackathonEvent.findUnique({
    where: { id },
    select: { id: true, slug: true, startsAt: true, endsAt: true, registrationOpen: true },
  });
  if (!current) throw notFound();
  const startsAt = input.startsAt ?? current.startsAt;
  const endsAt = input.endsAt ?? current.endsAt;
  if (endsAt <= startsAt) throw badRequest("The end must be after the start.", { endsAt: ["The end must be after the start."] });
  if (input.slug && input.slug !== current.slug) await assertEventSlugFree(input.slug, id);
  const fields = Object.keys(input);
  if (fields.length === 0) return { event: { id } };
  const action =
    input.registrationOpen === false && current.registrationOpen
      ? "hackathon_event.close_registration"
      : input.registrationOpen === true && !current.registrationOpen
        ? "hackathon_event.open_registration"
        : "hackathon_event.update";
  try {
    const event = await db.$transaction(async (tx) => {
      const updated = await tx.hackathonEvent.update({ where: { id }, data: input, select: { id: true, slug: true, name: true } });
      await audit(
        { actorId: actor.user.id, action, entityType: "HackathonEvent", entityId: id, metadata: { fields } },
        tx,
      );
      return updated;
    });
    return { event };
  } catch (e) {
    if (isUniqueViolation(e)) throw conflict("Another event already uses this slug.");
    throw e;
  }
}

// ───────────────────────────── Audit log ─────────────────────────────

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const auditQuery = paginationSchema.extend({
  action: optText(80),
  entityType: optText(60),
  actor: optText(200),
  from: optDate,
  /** Date-only values are inclusive of the whole day. */
  to: z.preprocess(
    (v) => (v === "" ? undefined : typeof v === "string" && DATE_ONLY.test(v) ? `${v}T23:59:59.999Z` : v),
    z.coerce.date().optional(),
  ),
});
export type AuditQuery = z.infer<typeof auditQuery>;

export async function listAuditEvents(actor: AuthedActor, query: AuditQuery) {
  assert(can.viewAuditLog(actor));
  const where: Prisma.AuditEventWhereInput = {
    ...(query.action ? { action: { startsWith: query.action } } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.actor ? { actor: { email: { contains: query.actor.toLowerCase(), mode: "insensitive" } } } : {}),
    ...(query.from || query.to
      ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } }
      : {}),
  };
  const rows = await db.auditEvent.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
      actor: { select: { id: true, name: true, email: true } },
      organisation: { select: { id: true, name: true } },
    },
    ...pageArgs(query),
  });
  return toPage(rows, query);
}

/** Distinct entity types for the audit filter (bounded). */
export async function auditEntityTypes(actor: AuthedActor) {
  assert(can.viewAuditLog(actor));
  const rows = await db.auditEvent.findMany({
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
    take: 100,
  });
  return rows.map((r) => r.entityType);
}

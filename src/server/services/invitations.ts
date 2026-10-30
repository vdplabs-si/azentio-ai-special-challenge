import "server-only";
import type { MembershipRole } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256 } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { sendMail } from "@/lib/auth/mailer";
import { normaliseEmail } from "@/lib/auth/accounts";
import { AppError, conflict, forbidden, notFound } from "@/lib/api/errors";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert, canAssignMembershipRole, canManageMembers } from "@/lib/authz/permissions";

const INVITE_DAYS = 7;

/**
 * Create a single-use, expiring invitation into `organisationId`.
 * Client admins can only invite into their own organisation with approved client roles.
 */
export async function createInvitation(actor: AuthedActor, organisationId: string, emailRaw: string, role: MembershipRole) {
  assert(canManageMembers(actor, organisationId), "Only workspace administrators can invite members.");
  assert(canAssignMembershipRole(actor, organisationId, role), "You cannot grant that role.");
  const email = normaliseEmail(emailRaw);
  const org = await db.organisation.findUnique({ where: { id: organisationId } });
  if (!org || org.status !== "ACTIVE") throw notFound();
  if (org.type === "INTERNAL" && !actor.roles.has("PORTAL_ADMIN") && !actor.roles.has("SUPER_ADMIN")) {
    throw forbidden("Employee access is provisioned by portal administrators.");
  }
  if (org.type === "INTERNAL" && !email.endsWith(`@${env().EMPLOYEE_EMAIL_DOMAIN}`)) {
    throw new AppError("validation_failed", `Employee invitations require an @${env().EMPLOYEE_EMAIL_DOMAIN} address.`);
  }
  const existingMember = await db.membership.findFirst({
    where: { organisationId, user: { email }, status: { in: ["ACTIVE", "INVITED_PENDING_TERMS"] } },
  });
  if (existingMember) throw conflict("This person is already a member of the workspace.");

  const token = randomToken(32);
  const invitation = await db.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: { organisationId, email, status: "PENDING" },
      data: { status: "REVOKED" },
    });
    const inv = await tx.invitation.create({
      data: {
        organisationId,
        email,
        role,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
        invitedById: actor.user.id,
      },
    });
    await audit({ actorId: actor.user.id, action: "invitation.create", entityType: "Invitation", entityId: inv.id, organisationId, metadata: { role } }, tx);
    return inv;
  });

  const link = `${env().AUTH_URL.replace(/\/$/, "")}/invite/${token}`;
  const mail = await sendMail({
    to: email,
    subject: `You're invited to ${org.name} on azentio.ai`,
    text: `${actor.user.name} invited you to join ${org.name} on azentio.ai as ${role.toLowerCase()}.\n\nAccept within ${INVITE_DAYS} days: ${link}\n\nYou'll need to sign in with this email address (${email}). Joining a workspace is not consent to share or train on your organisation's data.`,
  }).catch(() => ({ transport: "dev-log" as const, accepted: false }));

  // Existing users also get an in-app notification.
  const existingUser = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existingUser) {
    await notify({
      userId: existingUser.id,
      type: "invitation.received",
      title: `Invitation to ${org.name}`,
      body: `${actor.user.name} invited you to join ${org.name}.`,
      link: `/invite/${token}`,
    });
  }
  return {
    invitation: { id: invitation.id, email, role, status: invitation.status, expiresAt: invitation.expiresAt },
    delivery: { transport: mail.transport, acceptedByProvider: mail.accepted },
    // The link is returned to the inviting admin so it can be shared if email isn't configured.
    link,
  };
}

export async function revokeInvitation(actor: AuthedActor, invitationId: string) {
  const inv = await db.invitation.findUnique({ where: { id: invitationId } });
  if (!inv || !canManageMembers(actor, inv.organisationId)) throw notFound();
  if (inv.status !== "PENDING") throw conflict("Only pending invitations can be revoked.");
  await db.invitation.update({ where: { id: inv.id }, data: { status: "REVOKED" } });
  await audit({ actorId: actor.user.id, action: "invitation.revoke", entityType: "Invitation", entityId: inv.id, organisationId: inv.organisationId });
}

async function findValidInvitation(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(token) }, include: { organisation: true } });
  if (!inv) return null;
  if (inv.status === "PENDING" && inv.expiresAt < new Date()) {
    await db.invitation.update({ where: { id: inv.id }, data: { status: "EXPIRED" } });
    return { ...inv, status: "EXPIRED" as const };
  }
  return inv;
}

/** Public preview for the invitation landing page. Reveals only what the invitee needs. */
export async function previewInvitation(token: string) {
  const inv = await findValidInvitation(token);
  if (!inv) return null;
  const [local, domain] = inv.email.split("@");
  return {
    organisation: inv.organisation.name,
    organisationType: inv.organisation.type,
    role: inv.role,
    status: inv.status,
    expiresAt: inv.expiresAt,
    emailHint: `${local!.slice(0, 2)}•••@${domain}`,
  };
}

/** Accept only for the intended, verified account. Creates a membership pending terms. */
export async function acceptInvitation(actor: AuthedActor, token: string) {
  const inv = await findValidInvitation(token);
  if (!inv || inv.status !== "PENDING") throw new AppError("bad_request", "This invitation is no longer valid.");
  if (!actor.user.emailVerified) throw forbidden("Verify your email address before accepting an invitation.");
  if (normaliseEmail(actor.user.email) !== inv.email) {
    throw forbidden("This invitation was issued to a different email address. Sign in with the invited account.");
  }
  const membership = await db.$transaction(async (tx) => {
    const claimed = await tx.invitation.updateMany({
      where: { id: inv.id, status: "PENDING" },
      data: { status: "ACCEPTED", acceptedById: actor.user.id, acceptedAt: new Date() },
    });
    if (claimed.count !== 1) throw new AppError("conflict", "This invitation has already been used.");
    const m = await tx.membership.upsert({
      where: { userId_organisationId: { userId: actor.user.id, organisationId: inv.organisationId } },
      update: { role: inv.role, status: "INVITED_PENDING_TERMS", approvedById: inv.invitedById },
      create: {
        userId: actor.user.id,
        organisationId: inv.organisationId,
        role: inv.role,
        status: "INVITED_PENDING_TERMS",
        approvedById: inv.invitedById,
      },
    });
    await audit({ actorId: actor.user.id, action: "invitation.accept", entityType: "Invitation", entityId: inv.id, organisationId: inv.organisationId }, tx);
    return m;
  });
  return { membershipId: membership.id, organisationId: inv.organisationId };
}

/** Final onboarding step: terms + learning-sharing explanation acknowledged → ACTIVE. */
export async function completeOnboarding(actor: AuthedActor, organisationId: string) {
  const m = await db.membership.findUnique({
    where: { userId_organisationId: { userId: actor.user.id, organisationId } },
  });
  if (!m || m.status !== "INVITED_PENDING_TERMS") throw notFound();
  const now = new Date();
  await db.membership.update({
    where: { id: m.id },
    data: { status: "ACTIVE", termsAcceptedAt: now, learningNoticeAckAt: now },
  });
  await db.session.update({ where: { id: actor.sessionId! }, data: { activeOrganisationId: organisationId } });
  await audit({ actorId: actor.user.id, action: "membership.activate", entityType: "Membership", entityId: m.id, organisationId });
}

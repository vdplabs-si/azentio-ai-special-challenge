import "server-only";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notify";

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

export const isEmployeeDomain = (email: string) =>
  normaliseEmail(email).endsWith(`@${env().EMPLOYEE_EMAIL_DOMAIN.toLowerCase()}`);

/**
 * Organiser-approved employee provisioning (PDF §04): a verified employee-domain identity
 * only *requests* access — it creates a PENDING_APPROVAL membership of the internal
 * organisation that a portal administrator must approve. Never grants access by itself.
 */
export async function requestEmployeeAccessIfEligible(userId: string, email: string, verified: boolean) {
  if (!verified || !isEmployeeDomain(email)) return;
  const internal = await db.organisation.findFirst({ where: { type: "INTERNAL", status: "ACTIVE" }, select: { id: true } });
  if (!internal) return;
  const existing = await db.membership.findUnique({
    where: { userId_organisationId: { userId, organisationId: internal.id } },
  });
  if (existing) return;
  await db.membership.create({
    data: { userId, organisationId: internal.id, role: "MEMBER", status: "PENDING_APPROVAL" },
  });
  await audit({ actorId: userId, action: "employee.access_requested", entityType: "Membership", organisationId: internal.id });
  const admins = await db.roleGrant.findMany({
    where: { role: { in: ["PORTAL_ADMIN", "SUPER_ADMIN"] }, revokedAt: null },
    select: { userId: true },
    distinct: ["userId"],
  });
  await notifyMany(
    admins.map((a) => ({
      userId: a.userId,
      type: "employee.access_requested",
      title: "Employee access request",
      body: `${email} verified their work identity and is awaiting approval.`,
      link: "/portal/admin/organisations",
    })),
  );
}

/** Find-or-create a user for a verified OAuth identity and link the provider account. */
export async function upsertOAuthUser(input: {
  provider: "google" | "github";
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
}) {
  const email = normaliseEmail(input.email);
  const linked = await db.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: input.provider, providerAccountId: input.providerAccountId } },
    include: { user: true },
  });
  if (linked) return linked.user;

  // Only link to an existing account when the provider has verified the address.
  if (!input.emailVerified) {
    throw new Error("unverified_email");
  }
  const user =
    (await db.user.findUnique({ where: { email } })) ??
    (await db.user.create({ data: { email, name: input.name || email.split("@")[0]!, image: input.image ?? null, emailVerifiedAt: new Date() } }));
  if (!user.emailVerifiedAt) await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  await db.oAuthAccount.create({
    data: { userId: user.id, provider: input.provider, providerAccountId: input.providerAccountId, email },
  });
  await audit({ actorId: user.id, action: "auth.oauth_linked", entityType: "User", entityId: user.id, metadata: { provider: input.provider } });
  return user;
}

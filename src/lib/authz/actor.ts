import "server-only";
import { cache } from "react";
import type { MembershipRole, OrganisationType, PlatformRole } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { readSession } from "@/lib/auth/session";

export interface ActorMembership {
  organisationId: string;
  role: MembershipRole;
  organisation: { id: string; name: string; slug: string; type: OrganisationType };
}

export interface Actor {
  user: { id: string; email: string; name: string; title: string | null; image: string | null; emailVerified: boolean } | null;
  sessionId: string | null;
  roles: ReadonlySet<PlatformRole>;
  /** ACTIVE memberships only — the only memberships that confer authority. */
  memberships: readonly ActorMembership[];
  /** Memberships awaiting approval/terms (for onboarding UX only, no authority). */
  pendingMemberships: readonly (ActorMembership & { status: string })[];
  /** Validated active workspace (always one of `memberships`) or null. */
  activeOrganisation: ActorMembership | null;
  /** Verified employee-domain identity AND an ACTIVE membership of the internal organisation. */
  isEmployee: boolean;
  /** Organisation IDs where the actor holds an unexpired SupportAccessGrant. */
  supportOrganisationIds: readonly string[];
}

export const ANONYMOUS: Actor = {
  user: null,
  sessionId: null,
  roles: new Set(),
  memberships: [],
  pendingMemberships: [],
  activeOrganisation: null,
  isEmployee: false,
  supportOrganisationIds: [],
};

/** Resolve the request's actor once per request (React cache). All authority derives from DB state. */
export const getActor = cache(async (): Promise<Actor> => {
  const session = await readSession();
  if (!session) return ANONYMOUS;
  const now = new Date();

  const [memberships, grants, support] = await Promise.all([
    db.membership.findMany({
      where: { userId: session.userId, organisation: { status: "ACTIVE" } },
      select: {
        organisationId: true,
        role: true,
        status: true,
        organisation: { select: { id: true, name: true, slug: true, type: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.roleGrant.findMany({ where: { userId: session.userId, revokedAt: null }, select: { role: true } }),
    db.supportAccessGrant.findMany({
      where: { granteeId: session.userId, revokedAt: null, expiresAt: { gt: now } },
      select: { organisationId: true },
    }),
  ]);

  const active = memberships
    .filter((m) => m.status === "ACTIVE")
    .map((m) => ({ organisationId: m.organisationId, role: m.role, organisation: m.organisation }));
  const pending = memberships.filter((m) => m.status !== "ACTIVE" && m.status !== "REVOKED");
  const u = session.user;
  const emailVerified = Boolean(u.emailVerifiedAt);
  const domain = env().EMPLOYEE_EMAIL_DOMAIN.toLowerCase();
  const isEmployee =
    emailVerified && u.email.toLowerCase().endsWith(`@${domain}`) && active.some((m) => m.organisation.type === "INTERNAL");

  const activeOrganisation =
    active.find((m) => m.organisationId === session.activeOrganisationId) ?? active[0] ?? null;

  return {
    user: { id: u.id, email: u.email, name: u.name, title: u.title, image: u.image, emailVerified },
    sessionId: session.id,
    roles: new Set(grants.map((g) => g.role)),
    memberships: active,
    pendingMemberships: pending,
    activeOrganisation,
    isEmployee,
    supportOrganisationIds: support.map((s) => s.organisationId),
  };
});

/** Narrow to an authenticated actor or throw 401. */
export async function requireUser() {
  const actor = await getActor();
  if (!actor.user) {
    const { unauthenticated } = await import("@/lib/api/errors");
    throw unauthenticated();
  }
  return actor as Actor & { user: NonNullable<Actor["user"]> };
}

export type AuthedActor = Actor & { user: NonNullable<Actor["user"]> };

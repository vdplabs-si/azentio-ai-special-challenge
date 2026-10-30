import "server-only";
import { notFound as pageNotFound, redirect } from "next/navigation";
import { getActor, type AuthedActor } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import { AppError, notFound } from "@/lib/api/errors";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

/** Server-component guard: signed-in learning participant, otherwise 404 (pages never confirm existence). */
export async function learningPageActor(): Promise<AuthedActor> {
  const actor = await getActor();
  if (!actor.user) redirect("/login?next=/portal");
  if (!can.accessLearning(actor)) pageNotFound();
  return actor as AuthedActor;
}

/** Server-component guard for moderator-only pages (LEARNING_MODERATOR grant). */
export async function moderatorPageActor(): Promise<AuthedActor> {
  const actor = await learningPageActor();
  if (!can.moderateLearning(actor)) pageNotFound();
  return actor;
}

/** API guard: non-participants get 404 so learning resources are never confirmed to exist. */
export function assertParticipant(actor: AuthedActor) {
  if (!can.accessLearning(actor)) throw notFound();
}

export function assertModerator(actor: AuthedActor) {
  if (!can.moderateLearning(actor)) throw notFound();
}

/** Active users holding the LEARNING_MODERATOR grant (for notifications). */
export async function moderatorUserIds(excludeUserId?: string): Promise<string[]> {
  const grants = await db.roleGrant.findMany({
    where: { role: "LEARNING_MODERATOR", revokedAt: null, user: { status: "ACTIVE" } },
    select: { userId: true },
    distinct: ["userId"],
  });
  return grants.map((g) => g.userId).filter((id) => id !== excludeUserId);
}

/** Mirrors Actor.isEmployee for arbitrary users (used only for "Azentio team" display labels). */
export function isEmployeeRecord(u: { email: string; emailVerifiedAt: Date | null; memberships: unknown[] }) {
  const domain = env().EMPLOYEE_EMAIL_DOMAIN.toLowerCase();
  return Boolean(u.emailVerifiedAt) && u.email.toLowerCase().endsWith(`@${domain}`) && u.memberships.length > 0;
}

/** Prisma select fragment for isEmployeeRecord. */
export const employeeProbeSelect = {
  email: true,
  emailVerifiedAt: true,
  memberships: {
    where: { status: "ACTIVE", organisation: { type: "INTERNAL", status: "ACTIVE" } },
    select: { organisationId: true },
    take: 1,
  },
} as const;

export const learningMinCohort = () => env().LEARNING_MIN_COHORT;

/** For server components: map service not_found/forbidden errors to the 404 page (never confirm existence). */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (e) {
    if (e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) pageNotFound();
    throw e;
  }
}

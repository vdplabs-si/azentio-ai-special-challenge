import "server-only";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

const isProd = process.env.NODE_ENV === "production";
/** `__Host-` prefix pins the cookie to this host, path "/" and HTTPS in production. */
export const SESSION_COOKIE = isProd ? "__Host-az_session" : "az_session";
const SESSION_DAYS = 30;
const SLIDE_AFTER_MS = 24 * 60 * 60 * 1000;

export async function createSession(userId: string, opts: { activeOrganisationId?: string | null; userAgent?: string | null } = {}) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      activeOrganisationId: opts.activeOrganisationId ?? null,
      userAgent: opts.userAgent?.slice(0, 300) ?? null,
      expiresAt,
    },
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Resolve the current session (validated, unexpired, active user) or null. */
export async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date() || session.user.status !== "ACTIVE") {
    await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > SLIDE_AFTER_MS) {
    await db.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000) },
      })
      .catch(() => undefined);
  }
  return session;
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Revoke every session for a user (deactivation, password change). */
export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

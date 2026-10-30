import "server-only";
import { db } from "@/lib/db";
import { pageArgs, toPage, type Pagination } from "@/lib/api/pagination";
import { notFound } from "@/lib/api/errors";
import type { AuthedActor } from "@/lib/authz/actor";

export async function listNotifications(actor: AuthedActor, page: Pagination, unreadOnly = false) {
  const rows = await db.notification.findMany({
    where: { userId: actor.user.id, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      link: true,
      readAt: true,
      createdAt: true,
      outbox: { select: { channel: true, status: true } },
    },
    ...pageArgs(page),
  });
  return toPage(rows, page);
}

export const unreadCount = (actor: AuthedActor) =>
  db.notification.count({ where: { userId: actor.user.id, readAt: null } });

export async function markRead(actor: AuthedActor, id: string) {
  const res = await db.notification.updateMany({
    where: { id, userId: actor.user.id, readAt: null },
    data: { readAt: new Date() },
  });
  if (res.count === 0) {
    const exists = await db.notification.count({ where: { id, userId: actor.user.id } });
    if (!exists) throw notFound();
  }
}

export const markAllRead = (actor: AuthedActor) =>
  db.notification.updateMany({ where: { userId: actor.user.id, readAt: null }, data: { readAt: new Date() } });

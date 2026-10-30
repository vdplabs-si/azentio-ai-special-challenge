import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { emailProviderConfigured } from "@/lib/env";

type Tx = Prisma.TransactionClient | typeof db;

export interface NotifyInput {
  userId: string;
  type: string; // e.g. "observation.returned", "task.assigned", "mention"
  title: string;
  body: string;
  link?: string;
  /** Also queue an email in the outbox (idempotent). Delivery status is tracked, never assumed. */
  email?: boolean;
  /** Stable key so retries never duplicate an email, e.g. `obs:${id}:v${n}:returned`. */
  idempotencyKey?: string;
}

/** Persist an in-app notification (P0) and optionally an outbox record for email (P1). */
export async function notify(input: NotifyInput, tx: Tx = db) {
  const notification = await tx.notification.create({
    data: { userId: input.userId, type: input.type, title: input.title, body: input.body, link: input.link },
  });
  if (input.email) {
    await tx.notificationOutbox.upsert({
      where: { idempotencyKey: input.idempotencyKey ?? `notification:${notification.id}:email` },
      update: {},
      create: {
        notificationId: notification.id,
        channel: "email",
        idempotencyKey: input.idempotencyKey ?? `notification:${notification.id}:email`,
        status: emailProviderConfigured() ? "PENDING" : "SKIPPED_NO_PROVIDER",
      },
    });
  }
  return notification;
}

export async function notifyMany(inputs: NotifyInput[], tx: Tx = db) {
  for (const input of inputs) await notify(input, tx);
}

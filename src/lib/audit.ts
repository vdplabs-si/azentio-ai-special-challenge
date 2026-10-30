import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient | typeof db;

export interface AuditInput {
  actorId: string | null;
  action: string; // dotted verb, e.g. "observation.publish"
  entityType: string;
  entityId?: string | null;
  organisationId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

/** Append an audit event. Never include secrets or private content bodies in metadata. */
export async function audit(input: AuditInput, tx: Tx = db) {
  await tx.auditEvent.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      organisationId: input.organisationId ?? null,
      metadata: input.metadata,
    },
  });
}

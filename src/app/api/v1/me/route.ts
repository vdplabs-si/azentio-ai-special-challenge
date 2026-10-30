import { z } from "zod";
import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { serializeActor } from "@/lib/authz/serialize";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, passwordSchema, verifyPassword } from "@/lib/auth/password";
import { AppError } from "@/lib/api/errors";

export const GET = withApi(async () => {
  const actor = await requireUser();
  const profile = await db.user.findUniqueOrThrow({
    where: { id: actor.user.id },
    select: { id: true, name: true, email: true, title: true, image: true, createdAt: true, emailVerifiedAt: true, passwordHash: true, accounts: { select: { provider: true } } },
  });
  const { passwordHash, ...rest } = profile;
  return { profile: { ...rest, hasPassword: Boolean(passwordHash) }, session: serializeActor(actor) };
});

const patch = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  title: z.string().trim().max(120).nullable().optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: passwordSchema.optional(),
});

export const PATCH = withApi(async ({ req }) => {
  const actor = await requireUser();
  const input = await parseBody(req, patch);
  const data: { name?: string; title?: string | null; passwordHash?: string } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.title !== undefined) data.title = input.title || null;
  if (input.newPassword) {
    const user = await db.user.findUniqueOrThrow({ where: { id: actor.user.id }, select: { passwordHash: true } });
    if (user.passwordHash && !(input.currentPassword && (await verifyPassword(user.passwordHash, input.currentPassword)))) {
      throw new AppError("validation_failed", "Current password is incorrect.", { currentPassword: ["Current password is incorrect."] });
    }
    data.passwordHash = await hashPassword(input.newPassword);
  }
  await db.user.update({ where: { id: actor.user.id }, data });
  await audit({
    actorId: actor.user.id,
    action: "profile.update",
    entityType: "User",
    entityId: actor.user.id,
    metadata: { fields: Object.keys(data).map((k) => (k === "passwordHash" ? "password" : k)) },
  });
  return { ok: true };
});

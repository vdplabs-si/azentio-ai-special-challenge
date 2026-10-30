import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { extractMentionRefs, normaliseMentions } from "@/components/portal/collab/mention-tokens";
import { projectViewers, type ProjectAccessRecord } from "@/server/services/projects";

type Tx = Prisma.TransactionClient | typeof db;

export type MentionSource = "task_comment" | "discussion" | "discussion_reply";

/**
 * Resolve @mentions in `body` against people who can view the parent project.
 * Returns the normalised body (unpermitted mentions downgraded to plain text) and the
 * ids of mentioned users (excluding the author).
 */
export async function resolveMentions(project: ProjectAccessRecord, body: string, authorId: string) {
  const refs = extractMentionRefs(body);
  if (refs.ids.length === 0 && refs.emails.length === 0) return { body, userIds: [] as string[] };

  const candidates = await db.user.findMany({
    where: { status: "ACTIVE", OR: [{ id: { in: refs.ids } }, { email: { in: refs.emails } }] },
    select: { id: true },
    take: 50,
  });
  const permitted = await projectViewers(project, candidates.map((c) => c.id));
  const byId = new Map(permitted.map((u) => [u.id, { id: u.id, name: u.name }]));
  const byEmail = new Map(permitted.map((u) => [u.email.toLowerCase(), { id: u.id, name: u.name }]));
  const normalised = normaliseMentions(body, { byId, byEmail });
  const mentioned = new Set<string>();
  for (const id of refs.ids) if (byId.has(id)) mentioned.add(id);
  for (const email of refs.emails) {
    const u = byEmail.get(email);
    if (u) mentioned.add(u.id);
  }
  mentioned.delete(authorId);
  return { body: normalised, userIds: [...mentioned] };
}

/** Persist Mention rows and notify each mentioned user (in the caller's transaction). */
export async function recordMentions(
  input: { userIds: string[]; sourceType: MentionSource; sourceId: string; authorName: string; context: string; link: string },
  tx: Tx = db,
) {
  if (input.userIds.length === 0) return;
  await tx.mention.createMany({
    data: input.userIds.map((userId) => ({ userId, sourceType: input.sourceType, sourceId: input.sourceId })),
  });
  for (const userId of input.userIds) {
    await notify(
      {
        userId,
        type: "mention",
        title: `${input.authorName} mentioned you`,
        body: `You were mentioned in ${input.context}.`,
        link: input.link,
      },
      tx,
    );
  }
}

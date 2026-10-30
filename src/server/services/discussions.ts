import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { AppError, notFound } from "@/lib/api/errors";
import { pageArgs, toPage, type Pagination } from "@/lib/api/pagination";
import { rateLimit } from "@/lib/api/rate-limit";
import type { AuthedActor } from "@/lib/authz/actor";
import { assert } from "@/lib/authz/permissions";
import { visibleDiscussions } from "@/lib/authz/visibility";
import type { DiscussionCreateInput } from "@/components/portal/collab/schemas";
import { tokenizeMentions } from "@/components/portal/collab/mention-tokens";
import { accessFor, canStillView, loadProject, PROJECT_ACCESS_SELECT } from "@/server/services/projects";
import { recordMentions, resolveMentions } from "@/server/services/mentions";

export const discussionLink = (projectId: string, discussionId: string) =>
  `/portal/projects/${projectId}?tab=discussions&discussion=${discussionId}`;

const AUTHOR = { select: { id: true, name: true, image: true } } as const;

export async function listDiscussions(actor: AuthedActor, projectId: string, page: Pagination) {
  await loadProject(actor, projectId);
  const rows = await db.discussion.findMany({
    where: { AND: [visibleDiscussions(actor), { projectId }] },
    select: {
      id: true,
      title: true,
      body: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
      author: AUTHOR,
      _count: { select: { replies: true } },
      replies: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(page),
  });
  const result = toPage(rows, page);
  return {
    ...result,
    items: result.items.map(({ replies, body, ...d }) => {
      // Plain-text excerpt: mention tokens collapse to "@Name" so truncation never cuts a token.
      const plain = tokenizeMentions(body)
        .map((p) => (p.type === "text" ? p.value : p.type === "mention" ? `@${p.name}` : `@${p.email}`))
        .join("");
      return {
        ...d,
        excerpt: plain.length > 220 ? `${plain.slice(0, 220)}…` : plain,
        lastReplyAt: replies[0]?.createdAt ?? null,
      };
    }),
  };
}
export type DiscussionListItem = Awaited<ReturnType<typeof listDiscussions>>["items"][number];

async function loadDiscussion(actor: AuthedActor, discussionId: string) {
  const discussion = await db.discussion.findFirst({
    where: { AND: [{ id: discussionId }, visibleDiscussions(actor)] },
    select: { id: true, title: true, authorId: true, projectId: true, project: { select: PROJECT_ACCESS_SELECT } },
  });
  if (!discussion) throw notFound("Discussion not found.");
  const access = accessFor(actor, discussion.project);
  if (!access.view) throw notFound("Discussion not found.");
  return { discussion, access };
}

const REPLY_SELECT = { id: true, body: true, parentId: true, createdAt: true, author: AUTHOR } satisfies Prisma.DiscussionReplySelect;

export async function getDiscussion(actor: AuthedActor, discussionId: string) {
  const { discussion, access } = await loadDiscussion(actor, discussionId);
  const full = await db.discussion.findUniqueOrThrow({
    where: { id: discussionId },
    select: {
      id: true,
      projectId: true,
      title: true,
      body: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
      author: AUTHOR,
      replies: {
        where: { parentId: null },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 500,
        select: { ...REPLY_SELECT, replies: { select: REPLY_SELECT, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200 } },
      },
    },
  });
  return {
    discussion: full,
    canReply: access.contribute,
    canDelete: discussion.authorId === actor.user.id || access.manage,
  };
}
export type DiscussionDetail = Awaited<ReturnType<typeof getDiscussion>>;

export async function createDiscussion(actor: AuthedActor, projectId: string, input: DiscussionCreateInput) {
  const { project, access } = await loadProject(actor, projectId);
  assert(access.contribute, "You cannot start discussions in this project.");
  await rateLimit(`comment:${actor.user.id}`, 30, 60);
  const { body, userIds } = await resolveMentions(project, input.body, actor.user.id);
  return db.$transaction(async (tx) => {
    const d = await tx.discussion.create({
      data: { projectId, authorId: actor.user.id, title: input.title, body },
      select: { id: true, title: true },
    });
    await audit(
      { actorId: actor.user.id, action: "discussion.create", entityType: "Discussion", entityId: d.id, organisationId: project.organisationId, metadata: { projectId } },
      tx,
    );
    await recordMentions(
      { userIds, sourceType: "discussion", sourceId: d.id, authorName: actor.user.name, context: `the discussion “${d.title}”`, link: discussionLink(projectId, d.id) },
      tx,
    );
    return d;
  });
}

export async function deleteDiscussion(actor: AuthedActor, discussionId: string) {
  const { discussion, access } = await loadDiscussion(actor, discussionId);
  assert(discussion.authorId === actor.user.id || access.manage, "Only the author or a project manager can delete this discussion.");
  await db.$transaction(async (tx) => {
    await tx.discussion.delete({ where: { id: discussionId } });
    await audit(
      {
        actorId: actor.user.id,
        action: "discussion.delete",
        entityType: "Discussion",
        entityId: discussionId,
        organisationId: discussion.project.organisationId,
        metadata: { projectId: discussion.projectId },
      },
      tx,
    );
  });
}

export async function createReply(actor: AuthedActor, discussionId: string, input: { body: string; parentId?: string }) {
  const { discussion, access } = await loadDiscussion(actor, discussionId);
  assert(access.contribute, "You cannot reply in this project.");
  await rateLimit(`comment:${actor.user.id}`, 30, 60);
  let parentId: string | null = null;
  let parentAuthorId: string | null = null;
  if (input.parentId) {
    const parent = await db.discussionReply.findFirst({ where: { id: input.parentId, discussionId }, select: { id: true, parentId: true, authorId: true } });
    if (!parent) throw new AppError("validation_failed", "The reply you responded to no longer exists.", { parentId: ["Not found."] });
    parentId = parent.parentId ?? parent.id;
    parentAuthorId = parent.authorId;
  }
  const { body, userIds } = await resolveMentions(discussion.project, input.body, actor.user.id);
  const link = discussionLink(discussion.projectId, discussionId);
  const participants = new Set([discussion.authorId, parentAuthorId].filter((v): v is string => Boolean(v)));
  participants.delete(actor.user.id);
  for (const id of userIds) participants.delete(id);
  const notifyIds = await canStillView(discussion.project, [...participants]);
  return db.$transaction(async (tx) => {
    const reply = await tx.discussionReply.create({ data: { discussionId, authorId: actor.user.id, parentId, body }, select: REPLY_SELECT });
    await audit(
      {
        actorId: actor.user.id,
        action: "discussion.reply",
        entityType: "Discussion",
        entityId: discussionId,
        organisationId: discussion.project.organisationId,
        metadata: { projectId: discussion.projectId, replyId: reply.id },
      },
      tx,
    );
    await recordMentions(
      { userIds, sourceType: "discussion_reply", sourceId: reply.id, authorName: actor.user.name, context: `a reply in “${discussion.title}”`, link },
      tx,
    );
    for (const userId of notifyIds) {
      await notify(
        { userId, type: "discussion.reply", title: "New reply", body: `${actor.user.name} replied in “${discussion.title}”.`, link },
        tx,
      );
    }
    return reply;
  });
}

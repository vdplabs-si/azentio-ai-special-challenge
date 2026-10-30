/**
 * Prisma `where` builders that encode tenant isolation and audience rules.
 * Every list, search, count and export MUST compose these so that the same visibility
 * applies to records, counts, suggestions and exports (PDF §06).
 * They mirror the predicates in permissions.ts.
 */
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/lib/authz/actor";
import { can, isClientMember, isLearningParticipant, isPortalAdmin } from "@/lib/authz/permissions";

const NOTHING = { id: { in: [] as string[] } };

export const memberOrgIds = (a: Actor) => a.memberships.map((m) => m.organisationId);
const adminOrgIds = (a: Actor) => a.memberships.filter((m) => m.role === "OWNER" || m.role === "ADMIN").map((m) => m.organisationId);

export function visibleOrganisations(a: Actor): Prisma.OrganisationWhereInput {
  if (!a.user) return NOTHING;
  if (isPortalAdmin(a)) return {}; // organisation metadata only; private content still needs support grants
  return { id: { in: memberOrgIds(a) } };
}

export function visibleProjects(a: Actor): Prisma.ProjectWhereInput {
  if (!a.user) return NOTHING;
  const orgIds = memberOrgIds(a);
  return {
    organisationId: { in: orgIds },
    OR: [
      { visibility: "WORKSPACE" },
      { ownerId: a.user.id },
      { members: { some: { userId: a.user.id } } },
      { organisationId: { in: adminOrgIds(a) } },
    ],
  };
}

export const visibleTasks = (a: Actor): Prisma.TaskWhereInput => (a.user ? { project: visibleProjects(a) } : NOTHING);
export const visibleDiscussions = (a: Actor): Prisma.DiscussionWhereInput =>
  a.user ? { project: visibleProjects(a) } : NOTHING;

export function visibleDocuments(a: Actor): Prisma.DocumentWhereInput {
  if (!a.user) return NOTHING;
  return {
    organisationId: { in: memberOrgIds(a) },
    OR: [{ projectId: null }, { project: visibleProjects(a) }],
  };
}

export const visibleAnnouncements = (a: Actor): Prisma.AnnouncementWhereInput =>
  a.user ? { organisationId: { in: memberOrgIds(a) } } : NOTHING;

/** Private observation sources the actor may read (see observationAccess). */
export function visibleObservations(a: Actor): Prisma.ObservationWhereInput {
  if (!a.user) return NOTHING;
  const or: Prisma.ObservationWhereInput[] = [
    { authorId: a.user.id },
    { orgVisible: true, organisationId: { in: memberOrgIds(a) } },
  ];
  if (can.moderateLearning(a)) or.push({ submittedAt: { not: null } });
  if (isPortalAdmin(a) && a.supportOrganisationIds.length) or.push({ organisationId: { in: [...a.supportOrganisationIds] } });
  return { OR: or };
}

/** Approved shared copies — the only learning records that cross tenant boundaries. */
export function sharedFeedWhere(a: Actor): Prisma.SharedObservationWhereInput {
  if (!isLearningParticipant(a)) return NOTHING;
  return { status: "PUBLISHED" };
}

/** ContentItem audience filter (PUBLIC is explicit, never a fallback). */
export function contentAudienceWhere(a: Actor): Prisma.ContentItemWhereInput {
  const or: Prisma.ContentItemWhereInput[] = [{ audience: "PUBLIC" }];
  if (a.isEmployee) or.push({ audience: "EMPLOYEE" });
  if (a.isEmployee || isClientMember(a)) or.push({ audience: "CLIENT_ALL" });
  if (a.isEmployee && can.publishContent(a)) or.push({ audience: "CLIENT_ORGS" });
  else if (a.user) or.push({ audience: "CLIENT_ORGS", organisationId: { in: memberOrgIds(a) } });
  return { status: "PUBLISHED", OR: or };
}

export function mediaAudienceWhere(a: Actor): Prisma.MediaAssetWhereInput {
  const audiences: Prisma.MediaAssetWhereInput["audience"][] = ["PUBLIC"];
  if (a.isEmployee) audiences.push("EMPLOYEE");
  if (a.isEmployee || isClientMember(a)) audiences.push("CLIENT_ALL");
  return { published: true, audience: { in: audiences as ("PUBLIC" | "EMPLOYEE" | "CLIENT_ALL")[] } };
}

export function liveSessionWhere(a: Actor): Prisma.LiveSessionWhereInput {
  const or: Prisma.LiveSessionWhereInput[] = [{ audience: "PUBLIC" }];
  if (a.isEmployee) or.push({ audience: "EMPLOYEE" });
  if (a.isEmployee || isClientMember(a)) or.push({ audience: "CLIENT_ALL" });
  if (a.isEmployee && can.publishBroadcasts(a)) or.push({ audience: "CLIENT_ORGS" });
  else if (a.user)
    or.push({ audience: "CLIENT_ORGS", organisations: { some: { organisationId: { in: memberOrgIds(a) } } } });
  return { status: { not: "CANCELLED" }, OR: or };
}

/** Employees see all ideas; clients only ideas explicitly shared with participants. */
export function visibleIdeas(a: Actor): Prisma.ImprovementIdeaWhereInput {
  if (a.isEmployee) return {};
  if (isLearningParticipant(a)) return { visibility: "SHARED_WITH_PARTICIPANTS" };
  return NOTHING;
}

export function visibleThemes(a: Actor): Prisma.ThemeWhereInput {
  if (can.manageThemes(a) || a.isEmployee) return {};
  if (isLearningParticipant(a)) return { status: "PUBLISHED" };
  return NOTHING;
}

/** Offerings a client's active workspace is entitled to (employees: all sandbox offerings). */
export function entitledOfferings(a: Actor): Prisma.OfferingWhereInput {
  if (a.isEmployee) return {};
  const org = a.activeOrganisation;
  if (!org || org.organisation.type !== "CLIENT") return NOTHING;
  return {
    entitlements: {
      some: { organisationId: org.organisationId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    },
  };
}

/**
 * Centralised permission rules. Pure functions over an Actor — no I/O — so they are
 * unit-testable and reused by every service, route handler and page.
 * Least privilege: everything not explicitly allowed here is denied (IAM-02).
 */
import type { Audience, MembershipRole, PlatformRole, ProjectRole, ProjectVisibility } from "@/generated/prisma/enums";
import type { Actor } from "@/lib/authz/actor";
import { forbidden } from "@/lib/api/errors";

export const hasRole = (a: Actor, role: PlatformRole) => a.roles.has(role);
export const isSuperAdmin = (a: Actor) => hasRole(a, "SUPER_ADMIN");
export const isPortalAdmin = (a: Actor) => hasRole(a, "PORTAL_ADMIN") || isSuperAdmin(a);

/** The actor's ACTIVE role in an organisation, or null. */
export function orgRole(a: Actor, organisationId: string): MembershipRole | null {
  return a.memberships.find((m) => m.organisationId === organisationId)?.role ?? null;
}
export const isOrgMember = (a: Actor, organisationId: string) => orgRole(a, organisationId) !== null;
export const isOrgAdmin = (a: Actor, organisationId: string) => {
  const r = orgRole(a, organisationId);
  return r === "OWNER" || r === "ADMIN";
};
export const canContributeInOrg = (a: Actor, organisationId: string) => {
  const r = orgRole(a, organisationId);
  return r === "OWNER" || r === "ADMIN" || r === "MEMBER";
};
export const isClientMember = (a: Actor) => a.memberships.some((m) => m.organisation.type === "CLIENT");
/** "Authorised participant" of the collective-learning community. */
export const isLearningParticipant = (a: Actor) => Boolean(a.user) && (a.isEmployee || isClientMember(a));

// ── Platform administration ──────────────────────────────────────────────

/** Who may grant/revoke a platform role. Nobody can change their own grants. */
export function canGrantRole(a: Actor, role: PlatformRole, targetUserId: string) {
  if (!a.user || a.user.id === targetUserId) return false;
  if (role === "SUPER_ADMIN" || role === "PORTAL_ADMIN") return isSuperAdmin(a);
  return isPortalAdmin(a);
}

export const can = {
  manageUsers: isPortalAdmin,
  manageOrganisations: isPortalAdmin,
  manageEntitlements: isPortalAdmin,
  approveEmployees: isPortalAdmin,
  viewAuditLog: isPortalAdmin,
  viewInquiries: isPortalAdmin,
  requestSupportAccess: isPortalAdmin,
  moderateLearning: (a: Actor) => hasRole(a, "LEARNING_MODERATOR"),
  publishContent: (a: Actor) => hasRole(a, "CONTENT_PUBLISHER"),
  publishBroadcasts: (a: Actor) => hasRole(a, "BROADCAST_PUBLISHER"),
  manageIdeas: (a: Actor) => hasRole(a, "PRODUCT_OWNER"),
  manageThemes: (a: Actor) => hasRole(a, "PRODUCT_OWNER") || hasRole(a, "LEARNING_MODERATOR"),
  accessEmployeeArea: (a: Actor) => a.isEmployee,
  accessLearning: isLearningParticipant,
  useAira: isLearningParticipant,
};

// ── Workspace (organisation) membership ──────────────────────────────────

const CLIENT_ADMIN_GRANTABLE: MembershipRole[] = ["ADMIN", "MEMBER", "VIEWER"];

/**
 * Invite or change a member's role within an organisation.
 * Client administrators stay inside their own tenant and can never grant OWNER
 * (and membership roles never confer platform roles).
 */
export function canAssignMembershipRole(a: Actor, organisationId: string, role: MembershipRole) {
  if (isPortalAdmin(a)) return true;
  const mine = orgRole(a, organisationId);
  if (mine === "OWNER") return role !== "OWNER" ? true : false;
  if (mine === "ADMIN") return CLIENT_ADMIN_GRANTABLE.includes(role);
  return false;
}
export const canManageMembers = (a: Actor, organisationId: string) => isPortalAdmin(a) || isOrgAdmin(a, organisationId);
export const canEditWorkspace = (a: Actor, organisationId: string) => isPortalAdmin(a) || isOrgAdmin(a, organisationId);
export const canDeleteWorkspace = (a: Actor, organisationId: string) =>
  isPortalAdmin(a) || orgRole(a, organisationId) === "OWNER";

// ── Projects ─────────────────────────────────────────────────────────────

export interface ProjectAccessInput {
  organisationId: string;
  visibility: ProjectVisibility;
  ownerId: string;
  members: { userId: string; role: ProjectRole }[];
}

export function projectAccess(a: Actor, p: ProjectAccessInput) {
  const none = { view: false, contribute: false, manage: false };
  if (!a.user) return none;
  const org = orgRole(a, p.organisationId);
  if (!org) return none; // tenant isolation: no membership → no access, regardless of visibility
  const member = p.members.find((m) => m.userId === a.user!.id)?.role ?? null;
  const isOwner = p.ownerId === a.user.id;
  const orgAdmin = org === "OWNER" || org === "ADMIN";
  const view = isOwner || member !== null || orgAdmin || p.visibility === "WORKSPACE";
  const manage = isOwner || member === "MANAGER" || orgAdmin;
  const contribute =
    view && org !== "VIEWER" && member !== "VIEWER" && (manage || member === "CONTRIBUTOR" || p.visibility === "WORKSPACE");
  return { view, contribute, manage };
}

// ── Collective learning ──────────────────────────────────────────────────

export interface ObservationAccessInput {
  organisationId: string;
  authorId: string;
  orgVisible: boolean;
  submittedAt: Date | null;
}

/**
 * Private source records: the author; org members when explicitly shared within the org;
 * moderators only once submitted (never unsubmitted drafts); portal admins only with an
 * explicit, unexpired support-access grant for that organisation.
 */
export function observationAccess(a: Actor, o: ObservationAccessInput) {
  if (!a.user) return { view: false, edit: false };
  const isAuthor = o.authorId === a.user.id;
  const view =
    isAuthor ||
    (o.orgVisible && isOrgMember(a, o.organisationId)) ||
    (o.submittedAt !== null && can.moderateLearning(a)) ||
    (isPortalAdmin(a) && a.supportOrganisationIds.includes(o.organisationId));
  return { view, edit: isAuthor && isOrgMember(a, o.organisationId) };
}

// ── Audience-scoped content (content items, media, live sessions) ─────────

export function audienceAllows(a: Actor, audience: Audience, organisationIds: readonly string[] = []) {
  switch (audience) {
    case "PUBLIC":
      return true;
    case "EMPLOYEE":
      return a.isEmployee;
    case "CLIENT_ALL":
      return a.isEmployee || isClientMember(a);
    case "CLIENT_ORGS":
      return (
        organisationIds.some((id) => isOrgMember(a, id)) ||
        (a.isEmployee && (can.publishContent(a) || can.publishBroadcasts(a)))
      );
    default:
      return false; // missing/unknown audience metadata is never treated as public
  }
}

/** Throw 403 unless `allowed`. */
export function assert(allowed: boolean, message?: string): asserts allowed {
  if (!allowed) throw forbidden(message);
}

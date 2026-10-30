import { describe, expect, it } from "bun:test";
import type { Actor, ActorMembership } from "../../../src/lib/authz/actor";
import type { PlatformRole } from "../../../src/generated/prisma/enums";
import {
  audienceAllows,
  can,
  canAssignMembershipRole,
  canGrantRole,
  canManageMembers,
  observationAccess,
  projectAccess,
} from "../../../src/lib/authz/permissions";

const INTERNAL = "org_internal";
const CLIENT_A = "org_a";
const CLIENT_B = "org_b";

function m(organisationId: string, role: ActorMembership["role"]): ActorMembership {
  const type = organisationId === INTERNAL ? "INTERNAL" : "CLIENT";
  return { organisationId, role, organisation: { id: organisationId, name: organisationId, slug: organisationId, type } };
}

function actor(opts: { id?: string; roles?: PlatformRole[]; memberships?: ActorMembership[]; employee?: boolean; support?: string[] } = {}): Actor {
  const memberships = opts.memberships ?? [];
  return {
    user: { id: opts.id ?? "u1", email: "x@example.com", name: "X", title: null, image: null, emailVerified: true },
    sessionId: "s1",
    roles: new Set(opts.roles ?? []),
    memberships,
    pendingMemberships: [],
    activeOrganisation: memberships[0] ?? null,
    isEmployee: opts.employee ?? false,
    supportOrganisationIds: opts.support ?? [],
  };
}

const employee = actor({ id: "emp", memberships: [m(INTERNAL, "MEMBER")], employee: true });
const clientAdminA = actor({ id: "ca", memberships: [m(CLIENT_A, "ADMIN")] });
const clientMemberA = actor({ id: "cm", memberships: [m(CLIENT_A, "MEMBER")] });
const clientViewerA = actor({ id: "cv", memberships: [m(CLIENT_A, "VIEWER")] });
const clientMemberB = actor({ id: "cb", memberships: [m(CLIENT_B, "MEMBER")] });
const moderator = actor({ id: "mod", roles: ["LEARNING_MODERATOR"], memberships: [m(INTERNAL, "MEMBER")], employee: true });
const portalAdmin = actor({ id: "pa", roles: ["PORTAL_ADMIN"], memberships: [m(INTERNAL, "MEMBER")], employee: true });
const superAdmin = actor({ id: "sa", roles: ["SUPER_ADMIN"], memberships: [m(INTERNAL, "OWNER")], employee: true });

describe("least privilege (IAM-02)", () => {
  it("employee status does not imply administration, moderation or publishing", () => {
    expect(can.manageUsers(employee)).toBe(false);
    expect(can.moderateLearning(employee)).toBe(false);
    expect(can.publishContent(employee)).toBe(false);
    expect(can.publishBroadcasts(employee)).toBe(false);
    expect(can.accessEmployeeArea(employee)).toBe(true);
  });
  it("clients cannot reach employee-only areas", () => {
    expect(can.accessEmployeeArea(clientAdminA)).toBe(false);
  });
  it("grants are separate: a moderator is not a portal admin", () => {
    expect(can.moderateLearning(moderator)).toBe(true);
    expect(can.manageUsers(moderator)).toBe(false);
  });
});

describe("role grants", () => {
  it("only super admins grant SUPER_ADMIN / PORTAL_ADMIN", () => {
    expect(canGrantRole(portalAdmin, "PORTAL_ADMIN", "other")).toBe(false);
    expect(canGrantRole(superAdmin, "PORTAL_ADMIN", "other")).toBe(true);
    expect(canGrantRole(portalAdmin, "LEARNING_MODERATOR", "other")).toBe(true);
  });
  it("nobody can change their own grants", () => {
    expect(canGrantRole(superAdmin, "LEARNING_MODERATOR", "sa")).toBe(false);
  });
  it("client admins cannot grant platform roles", () => {
    expect(canGrantRole(clientAdminA, "LEARNING_MODERATOR", "other")).toBe(false);
  });
});

describe("tenant membership administration", () => {
  it("client admin manages only their own organisation", () => {
    expect(canManageMembers(clientAdminA, CLIENT_A)).toBe(true);
    expect(canManageMembers(clientAdminA, CLIENT_B)).toBe(false);
  });
  it("client admin cannot escalate to OWNER", () => {
    expect(canAssignMembershipRole(clientAdminA, CLIENT_A, "MEMBER")).toBe(true);
    expect(canAssignMembershipRole(clientAdminA, CLIENT_A, "ADMIN")).toBe(true);
    expect(canAssignMembershipRole(clientAdminA, CLIENT_A, "OWNER")).toBe(false);
  });
  it("members cannot invite", () => {
    expect(canAssignMembershipRole(clientMemberA, CLIENT_A, "VIEWER")).toBe(false);
  });
});

describe("project access", () => {
  const project = { organisationId: CLIENT_A, visibility: "PRIVATE" as const, ownerId: "ca", members: [{ userId: "cm", role: "CONTRIBUTOR" as const }] };
  it("other tenants never see a project, even WORKSPACE-visible", () => {
    expect(projectAccess(clientMemberB, { ...project, visibility: "WORKSPACE" }).view).toBe(false);
  });
  it("private projects are visible to members and org admins only", () => {
    expect(projectAccess(clientMemberA, project).view).toBe(true);
    expect(projectAccess(clientViewerA, project).view).toBe(false);
    expect(projectAccess(clientAdminA, project).manage).toBe(true);
  });
  it("viewers cannot modify", () => {
    expect(projectAccess(clientViewerA, { ...project, visibility: "WORKSPACE" }).contribute).toBe(false);
  });
  it("employees get no automatic access to client projects", () => {
    expect(projectAccess(employee, { ...project, visibility: "WORKSPACE" }).view).toBe(false);
  });
});

describe("observation (private source) access", () => {
  const draft = { organisationId: CLIENT_A, authorId: "cm", orgVisible: false, submittedAt: null };
  it("moderators cannot read unsubmitted drafts", () => {
    expect(observationAccess(moderator, draft).view).toBe(false);
    expect(observationAccess(moderator, { ...draft, submittedAt: new Date() }).view).toBe(true);
  });
  it("organisation-only notes are visible within the org, never to other tenants", () => {
    const orgNote = { ...draft, orgVisible: true };
    expect(observationAccess(clientAdminA, orgNote).view).toBe(true);
    expect(observationAccess(clientMemberB, orgNote).view).toBe(false);
  });
  it("portal admins need an explicit support grant", () => {
    expect(observationAccess(portalAdmin, draft).view).toBe(false);
    const withGrant = actor({ id: "pa", roles: ["PORTAL_ADMIN"], memberships: [m(INTERNAL, "MEMBER")], employee: true, support: [CLIENT_A] });
    expect(observationAccess(withGrant, draft).view).toBe(true);
  });
  it("only the author edits", () => {
    expect(observationAccess(clientMemberA, draft).edit).toBe(true);
    expect(observationAccess(clientAdminA, { ...draft, orgVisible: true }).edit).toBe(false);
  });
});

describe("audiences", () => {
  it("public content is explicit; unknown audience is denied", () => {
    expect(audienceAllows(clientMemberA, "PUBLIC")).toBe(true);
    expect(audienceAllows(clientMemberA, "EMPLOYEE")).toBe(false);
    expect(audienceAllows(employee, "EMPLOYEE")).toBe(true);
    // @ts-expect-error — missing metadata must never fall back to public
    expect(audienceAllows(clientMemberA, undefined)).toBe(false);
  });
  it("organisation-targeted content is limited to those organisations", () => {
    expect(audienceAllows(clientMemberA, "CLIENT_ORGS", [CLIENT_A])).toBe(true);
    expect(audienceAllows(clientMemberB, "CLIENT_ORGS", [CLIENT_A])).toBe(false);
  });
});

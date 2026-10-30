import type { Actor } from "@/lib/authz/actor";

/** Client-safe view of the actor for UI rendering (never used for authorisation). */
export function serializeActor(a: Actor) {
  return {
    user: a.user,
    roles: [...a.roles],
    isEmployee: a.isEmployee,
    activeOrganisation: a.activeOrganisation
      ? { id: a.activeOrganisation.organisationId, name: a.activeOrganisation.organisation.name, type: a.activeOrganisation.organisation.type, role: a.activeOrganisation.role }
      : null,
    memberships: a.memberships.map((m) => ({ id: m.organisationId, name: m.organisation.name, type: m.organisation.type, role: m.role })),
    pendingMemberships: a.pendingMemberships.map((m) => ({ id: m.organisationId, name: m.organisation.name, status: m.status })),
  };
}

export type SerializedActor = ReturnType<typeof serializeActor>;

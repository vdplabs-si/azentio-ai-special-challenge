/**
 * Community-sharing lifecycle for observations (PDF §08) as an explicit transition table.
 * EVERY status change in the services goes through `assertTransition` and writes an
 * `observation.<action>` audit event in the same transaction.
 *
 * Pure module — no I/O — so it is unit-tested directly.
 */
import type { ObservationStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";

/** Who is performing the transition. Authors act on their own sources; moderators hold LEARNING_MODERATOR. */
export type ActorKind = "author" | "moderator";

export type LifecycleAction =
  | "submit"
  | "resubmit"
  | "amend"
  | "return"
  | "publish"
  | "reject"
  | "decline_amendment"
  | "withdraw"
  | "suspend"
  | "reinstate"
  | "remove";

export interface Transition {
  from: ObservationStatus;
  to: ObservationStatus;
  actor: ActorKind;
  action: LifecycleAction;
  /** Whether this transition creates a new submitted version (ObservationVersion + consent). */
  newVersion?: boolean;
  /** A public reason for the contributor is mandatory. */
  requiresPublicReason?: boolean;
  description: string;
}

export const TRANSITIONS: readonly Transition[] = [
  { from: "DRAFT", to: "SUBMITTED", actor: "author", action: "submit", newVersion: true, description: "Author proposes sharing; requires consents (a) and (b)." },
  { from: "SUBMITTED", to: "RETURNED", actor: "moderator", action: "return", requiresPublicReason: true, description: "Moderator requests clarification." },
  { from: "SUBMITTED", to: "PUBLISHED", actor: "moderator", action: "publish", description: "Moderator publishes a reviewed shared copy." },
  { from: "SUBMITTED", to: "REJECTED", actor: "moderator", action: "reject", requiresPublicReason: true, description: "Moderator rejects (duplicate, unsafe, out of scope…)." },
  {
    from: "SUBMITTED",
    to: "PUBLISHED",
    actor: "moderator",
    action: "decline_amendment",
    requiresPublicReason: true,
    description: "Moderator declines an amendment; the previously published version remains the shared copy.",
  },
  { from: "SUBMITTED", to: "WITHDRAWN", actor: "author", action: "withdraw", description: "Author withdraws before a decision." },
  { from: "RETURNED", to: "SUBMITTED", actor: "author", action: "resubmit", newVersion: true, description: "Author amends and resubmits (new version)." },
  { from: "RETURNED", to: "WITHDRAWN", actor: "author", action: "withdraw", description: "Author withdraws instead of resubmitting." },
  { from: "PUBLISHED", to: "SUBMITTED", actor: "author", action: "amend", newVersion: true, description: "Material edit: version n+1 goes to review; the approved copy stays until the new one is published." },
  { from: "PUBLISHED", to: "SUSPENDED", actor: "moderator", action: "suspend", requiresPublicReason: true, description: "Temporarily unpublished while a report is investigated." },
  { from: "PUBLISHED", to: "WITHDRAWN", actor: "author", action: "withdraw", description: "Author withdraws the shared copy." },
  { from: "SUSPENDED", to: "PUBLISHED", actor: "moderator", action: "reinstate", requiresPublicReason: true, description: "Moderator reinstates after review." },
  { from: "SUSPENDED", to: "REJECTED", actor: "moderator", action: "remove", requiresPublicReason: true, description: "Moderator removes after review." },
  { from: "SUSPENDED", to: "WITHDRAWN", actor: "author", action: "withdraw", description: "Author withdraws while the copy is suspended (withdrawal is always available once shared)." },
];

/** Statuses the author may edit in place without creating a new version. */
export const FREELY_EDITABLE: readonly ObservationStatus[] = ["DRAFT", "RETURNED"];
/** Statuses where an edit is a material amendment (new version, new consent, re-review). */
export const AMENDABLE: readonly ObservationStatus[] = ["PUBLISHED"];
/** Statuses where a shared copy may be live or pending and the author can withdraw. */
export const WITHDRAWABLE: readonly ObservationStatus[] = TRANSITIONS.filter((t) => t.action === "withdraw").map((t) => t.from);

export const isFreelyEditable = (s: ObservationStatus) => FREELY_EDITABLE.includes(s);
export const isAmendable = (s: ObservationStatus) => AMENDABLE.includes(s);
export const canEditStatus = (s: ObservationStatus) => isFreelyEditable(s) || isAmendable(s);
/** Only never-submitted drafts may be deleted by their author. */
export const canDeleteStatus = (s: ObservationStatus) => s === "DRAFT";

export function findTransition(
  from: ObservationStatus,
  to: ObservationStatus,
  actor: ActorKind,
  action?: LifecycleAction,
): Transition | undefined {
  return TRANSITIONS.find((t) => t.from === from && t.to === to && t.actor === actor && (!action || t.action === action));
}

export const canTransition = (from: ObservationStatus, to: ObservationStatus, actor: ActorKind, action?: LifecycleAction) =>
  findTransition(from, to, actor, action) !== undefined;

export class LifecycleError extends AppError {
  constructor(
    readonly from: ObservationStatus,
    readonly to: ObservationStatus,
    readonly actorKind: ActorKind,
  ) {
    super("conflict", `This contribution cannot move from ${from.toLowerCase()} to ${to.toLowerCase()} as ${actorKind === "author" ? "its author" : "a moderator"}.`, {
      from,
      to,
      actor: actorKind,
    });
  }
}

/** Throws a 409 LifecycleError unless the transition is in the table. Returns the matched transition. */
export function assertTransition(
  from: ObservationStatus,
  to: ObservationStatus,
  actorKind: ActorKind,
  action?: LifecycleAction,
): Transition {
  const t = findTransition(from, to, actorKind, action);
  if (!t) throw new LifecycleError(from, to, actorKind);
  return t;
}

/** Transitions available from a status for an actor kind (drives UI actions). */
export const availableTransitions = (from: ObservationStatus, actor: ActorKind) =>
  TRANSITIONS.filter((t) => t.from === from && t.actor === actor);

/** Audit action name for a transition, e.g. "observation.publish". */
export const auditAction = (t: Pick<Transition, "action">) => `observation.${t.action}`;

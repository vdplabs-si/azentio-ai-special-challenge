import { describe, it, expect } from "bun:test";
import type { ObservationStatus } from "@/generated/prisma/enums";
import {
  assertTransition,
  auditAction,
  availableTransitions,
  canDeleteStatus,
  canTransition,
  isAmendable,
  isFreelyEditable,
  LifecycleError,
  TRANSITIONS,
  WITHDRAWABLE,
  type ActorKind,
} from "@/server/learning/lifecycle";

const ALL: ObservationStatus[] = ["DRAFT", "SUBMITTED", "RETURNED", "PUBLISHED", "REJECTED", "SUSPENDED", "WITHDRAWN"];

describe("lifecycle transition table", () => {
  const allowed: [ObservationStatus, ObservationStatus, ActorKind, string][] = [
    ["DRAFT", "SUBMITTED", "author", "submit"],
    ["SUBMITTED", "RETURNED", "moderator", "return"],
    ["SUBMITTED", "PUBLISHED", "moderator", "publish"],
    ["SUBMITTED", "REJECTED", "moderator", "reject"],
    ["SUBMITTED", "PUBLISHED", "moderator", "decline_amendment"],
    ["SUBMITTED", "WITHDRAWN", "author", "withdraw"],
    ["RETURNED", "SUBMITTED", "author", "resubmit"],
    ["RETURNED", "WITHDRAWN", "author", "withdraw"],
    ["PUBLISHED", "SUBMITTED", "author", "amend"],
    ["PUBLISHED", "SUSPENDED", "moderator", "suspend"],
    ["PUBLISHED", "WITHDRAWN", "author", "withdraw"],
    ["SUSPENDED", "PUBLISHED", "moderator", "reinstate"],
    ["SUSPENDED", "REJECTED", "moderator", "remove"],
    ["SUSPENDED", "WITHDRAWN", "author", "withdraw"],
  ];

  for (const [from, to, actor, action] of allowed) {
    it(`allows ${from} → ${to} by ${actor} (${action})`, () => {
      const t = assertTransition(from, to, actor);
      expect(t.from).toBe(from);
      expect(t.to).toBe(to);
      expect(canTransition(from, to, actor, action as never)).toBe(true);
      expect(auditAction(assertTransition(from, to, actor, action as never))).toBe(`observation.${action}`);
    });
  }

  it("contains exactly the documented transitions", () => {
    expect(TRANSITIONS.length).toBe(allowed.length);
  });

  it("only authors submit, resubmit, amend and withdraw", () => {
    for (const t of TRANSITIONS) {
      if (["submit", "resubmit", "amend", "withdraw"].includes(t.action)) expect(t.actor).toBe("author");
      else expect(t.actor).toBe("moderator");
    }
  });

  it("new versions are created by submit, resubmit and amend only", () => {
    const versioning = TRANSITIONS.filter((t) => t.newVersion).map((t) => t.action).sort();
    expect(versioning).toEqual(["amend", "resubmit", "submit"]);
  });

  it("requires a public reason for return, reject and report outcomes", () => {
    for (const a of ["return", "reject", "suspend", "reinstate", "remove", "decline_amendment"]) {
      expect(TRANSITIONS.find((t) => t.action === a)?.requiresPublicReason).toBe(true);
    }
  });
});

describe("illegal transitions", () => {
  const illegal: [ObservationStatus, ObservationStatus, ActorKind][] = [
    ["DRAFT", "PUBLISHED", "author"], // saving never shares
    ["DRAFT", "PUBLISHED", "moderator"], // moderators never touch unsubmitted drafts
    ["DRAFT", "SUBMITTED", "moderator"],
    ["DRAFT", "WITHDRAWN", "author"], // drafts are deleted, not withdrawn
    ["SUBMITTED", "PUBLISHED", "author"], // authors cannot self-publish
    ["SUBMITTED", "RETURNED", "author"],
    ["SUBMITTED", "WITHDRAWN", "moderator"],
    ["RETURNED", "PUBLISHED", "moderator"], // must be resubmitted first
    ["PUBLISHED", "REJECTED", "moderator"], // removal goes through suspension
    ["PUBLISHED", "SUSPENDED", "author"],
    ["SUSPENDED", "PUBLISHED", "author"],
    ["REJECTED", "SUBMITTED", "author"],
    ["REJECTED", "PUBLISHED", "moderator"],
    ["WITHDRAWN", "SUBMITTED", "author"],
    ["WITHDRAWN", "PUBLISHED", "moderator"],
  ];
  for (const [from, to, actor] of illegal) {
    it(`rejects ${from} → ${to} by ${actor}`, () => {
      expect(canTransition(from, to, actor)).toBe(false);
      expect(() => assertTransition(from, to, actor)).toThrow(LifecycleError);
    });
  }

  it("throws a 409 conflict AppError", () => {
    try {
      assertTransition("WITHDRAWN", "PUBLISHED", "moderator");
      throw new Error("expected to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(LifecycleError);
      expect((e as LifecycleError).status).toBe(409);
      expect((e as LifecycleError).code).toBe("conflict");
    }
  });

  it("rejects a mismatched explicit action", () => {
    expect(() => assertTransition("DRAFT", "SUBMITTED", "author", "resubmit")).toThrow(LifecycleError);
  });

  it("no self-transitions exist", () => {
    for (const s of ALL) for (const a of ["author", "moderator"] as const) expect(canTransition(s, s, a)).toBe(false);
  });

  it("REJECTED and WITHDRAWN are terminal", () => {
    for (const a of ["author", "moderator"] as const) {
      expect(availableTransitions("REJECTED", a)).toEqual([]);
      expect(availableTransitions("WITHDRAWN", a)).toEqual([]);
    }
  });
});

describe("editing rules", () => {
  it("authors edit DRAFT and RETURNED freely; PUBLISHED is an amendment", () => {
    expect(ALL.filter(isFreelyEditable)).toEqual(["DRAFT", "RETURNED"]);
    expect(ALL.filter(isAmendable)).toEqual(["PUBLISHED"]);
  });
  it("only drafts can be deleted", () => {
    expect(ALL.filter(canDeleteStatus)).toEqual(["DRAFT"]);
  });
  it("withdrawal is available whenever a copy is pending or shared", () => {
    expect([...WITHDRAWABLE].sort()).toEqual(["PUBLISHED", "RETURNED", "SUBMITTED", "SUSPENDED"]);
  });
});

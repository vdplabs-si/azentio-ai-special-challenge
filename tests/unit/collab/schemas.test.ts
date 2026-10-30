import { describe, expect, it } from "bun:test";
import {
  memberUpdateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  slugify,
  slugSchema,
  taskListQuery,
  taskUpdateSchema,
  workspaceCreateSchema,
} from "../../../src/components/portal/collab/schemas";
import { hrefWith, oneOf } from "../../../src/components/portal/collab/url";
import { describeActivity } from "../../../src/components/portal/collab/activity-text";

describe("workspace schemas", () => {
  it("validates kebab-case slugs", () => {
    expect(slugSchema.safeParse("acme-bank").success).toBe(true);
    for (const bad of ["Acme", "acme--bank", "-acme", "acme_bank", "a", "acme bank"]) {
      expect(slugSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("suggests slugs from names", () => {
    expect(slugify("  Café Bank & Trust (KSA) ")).toBe("cafe-bank-trust-ksa");
    expect(slugSchema.safeParse(slugify("Al Rajhi Takaful")).success).toBe(true);
  });

  it("accepts an empty or valid owner email", () => {
    const base = { name: "Acme", slug: "acme", industry: "", region: "", description: "" };
    expect(workspaceCreateSchema.safeParse({ ...base, ownerEmail: "" }).success).toBe(true);
    expect(workspaceCreateSchema.safeParse({ ...base, ownerEmail: "owner@acme.com" }).success).toBe(true);
    expect(workspaceCreateSchema.safeParse({ ...base, ownerEmail: "nope" }).success).toBe(false);
  });

  it("does not accept platform roles or unknown statuses for members", () => {
    expect(memberUpdateSchema.safeParse({ role: "PORTAL_ADMIN" }).success).toBe(false);
    expect(memberUpdateSchema.safeParse({ status: "REVOKED" }).success).toBe(false);
    expect(memberUpdateSchema.safeParse({}).success).toBe(false);
    expect(memberUpdateSchema.safeParse({ role: "ADMIN" }).success).toBe(true);
  });
});

describe("project and task schemas", () => {
  it("requires due date on/after start date", () => {
    expect(projectCreateSchema.safeParse({ name: "Pilot", startsAt: "2026-11-02T00:00:00.000Z", dueAt: "2026-11-01T00:00:00.000Z" }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ name: "Pilot", startsAt: "2026-11-01T00:00:00.000Z", dueAt: "2026-11-02T00:00:00.000Z" }).success).toBe(true);
    expect(projectUpdateSchema.safeParse({ dueAt: null }).success).toBe(true);
  });

  it("rejects malformed dates and unknown enum values", () => {
    expect(taskUpdateSchema.safeParse({ dueAt: "tomorrow" }).success).toBe(false);
    expect(taskUpdateSchema.safeParse({ status: "CLOSED" }).success).toBe(false);
    expect(taskUpdateSchema.safeParse({ priority: "URGENT", assigneeId: null }).success).toBe(true);
  });

  it("parses task list query strings", () => {
    const q = taskListQuery.parse({ status: "OPEN", overdue: "1", limit: "50" });
    expect(q).toMatchObject({ status: "OPEN", overdue: true, limit: 50 });
    expect(taskListQuery.parse({}).limit).toBe(100);
  });
});

describe("url helpers", () => {
  it("merges and removes params", () => {
    expect(hrefWith("/p", { tab: "tasks", cursor: "abc" }, { cursor: undefined, q: "x y" })).toBe("/p?tab=tasks&q=x+y");
    expect(hrefWith("/p", {}, {})).toBe("/p");
  });
  it("narrows values", () => {
    expect(oneOf("due", ["priority", "due"] as const)).toBe("due");
    expect(oneOf("drop table", ["priority", "due"] as const)).toBeUndefined();
  });
});

describe("activity sentences", () => {
  it("describes status moves with labels and falls back for deleted subjects", () => {
    const base = { id: "1", entityType: "Task", createdAt: new Date(), actor: null };
    expect(describeActivity({ ...base, action: "task.status_change", subject: "Fix login", details: { to: "DONE" } })).toBe("moved task “Fix login” to Done");
    expect(describeActivity({ ...base, action: "task.create", subject: null, details: {} })).toBe("created task (since deleted)");
  });
});

import { describe, expect, it } from "bun:test";
import {
  compareTasksByDue,
  compareTasksByPriority,
  dueBucket,
  groupBy,
  isProjectOverdue,
  isTaskOverdue,
  nextCompletedAt,
  progressOf,
  wouldRemoveLastOwner,
} from "../../../src/components/portal/collab/metrics";

const NOW = new Date("2026-10-30T12:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("progress and overdue", () => {
  it("computes progress from done/total", () => {
    expect(progressOf(0, 0)).toEqual({ total: 0, done: 0, percent: 0 });
    expect(progressOf(3, 1)).toEqual({ total: 3, done: 1, percent: 33 });
    expect(progressOf(4, 4).percent).toBe(100);
  });

  it("marks tasks overdue only when past due and not DONE", () => {
    expect(isTaskOverdue({ dueAt: day(-1), status: "TODO" }, NOW)).toBe(true);
    expect(isTaskOverdue({ dueAt: day(-1), status: "DONE" }, NOW)).toBe(false);
    expect(isTaskOverdue({ dueAt: day(1), status: "BLOCKED" }, NOW)).toBe(false);
    expect(isTaskOverdue({ dueAt: null, status: "TODO" }, NOW)).toBe(false);
    expect(isTaskOverdue({ dueAt: day(-1).toISOString(), status: "IN_PROGRESS" }, NOW)).toBe(true);
  });

  it("does not flag completed or archived projects as overdue", () => {
    expect(isProjectOverdue({ dueAt: day(-1), status: "ACTIVE" }, NOW)).toBe(true);
    expect(isProjectOverdue({ dueAt: day(-1), status: "COMPLETED" }, NOW)).toBe(false);
    expect(isProjectOverdue({ dueAt: day(-1), status: "ARCHIVED" }, NOW)).toBe(false);
  });
});

describe("task ordering and grouping", () => {
  const tasks = [
    { title: "b", priority: "LOW", dueAt: day(1) },
    { title: "a", priority: "URGENT", dueAt: null },
    { title: "c", priority: "URGENT", dueAt: day(2) },
    { title: "d", priority: "HIGH", dueAt: day(-3) },
  ];

  it("sorts by priority then due date (undated last)", () => {
    expect([...tasks].sort(compareTasksByPriority).map((t) => t.title)).toEqual(["c", "a", "d", "b"]);
  });

  it("sorts by due date then priority", () => {
    expect([...tasks].sort(compareTasksByDue).map((t) => t.title)).toEqual(["d", "b", "c", "a"]);
  });

  it("buckets by due date", () => {
    expect(dueBucket({ dueAt: day(-1), status: "TODO" }, NOW)).toBe("overdue");
    expect(dueBucket({ dueAt: day(-1), status: "DONE" }, NOW)).not.toBe("overdue");
    expect(dueBucket({ dueAt: day(3), status: "TODO" }, NOW)).toBe("week");
    expect(dueBucket({ dueAt: day(30), status: "TODO" }, NOW)).toBe("later");
    expect(dueBucket({ dueAt: null, status: "TODO" }, NOW)).toBe("none");
  });

  it("groups in key order and drops empty groups", () => {
    const groups = groupBy(tasks, (t) => t.priority as "URGENT" | "HIGH" | "MEDIUM" | "LOW", ["URGENT", "HIGH", "MEDIUM", "LOW"] as const);
    expect(groups.map((g) => [g.key, g.items.length])).toEqual([
      ["URGENT", 2],
      ["HIGH", 1],
      ["LOW", 1],
    ]);
  });
});

describe("completedAt follows status", () => {
  it("sets on DONE, keeps while DONE, clears otherwise", () => {
    expect(nextCompletedAt("DONE", null, NOW)).toEqual(NOW);
    const earlier = day(-2);
    expect(nextCompletedAt("DONE", earlier, NOW)).toEqual(earlier);
    expect(nextCompletedAt("IN_PROGRESS", earlier, NOW)).toBeNull();
  });
});

describe("last-owner guard", () => {
  const owner = { role: "OWNER", status: "ACTIVE" };
  it("blocks demoting, suspending or removing the last active owner", () => {
    expect(wouldRemoveLastOwner(owner, { role: "ADMIN" }, 1)).toBe(true);
    expect(wouldRemoveLastOwner(owner, { status: "SUSPENDED" }, 1)).toBe(true);
    expect(wouldRemoveLastOwner(owner, { remove: true }, 1)).toBe(true);
  });
  it("allows the change when another active owner exists or the target is not an active owner", () => {
    expect(wouldRemoveLastOwner(owner, { role: "ADMIN" }, 2)).toBe(false);
    expect(wouldRemoveLastOwner({ role: "ADMIN", status: "ACTIVE" }, { remove: true }, 1)).toBe(false);
    expect(wouldRemoveLastOwner({ role: "OWNER", status: "SUSPENDED" }, { remove: true }, 1)).toBe(false);
    expect(wouldRemoveLastOwner(owner, { role: "OWNER" }, 1)).toBe(false);
  });
});

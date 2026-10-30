/** Pure project/task metrics shared by services and UI. */

const PRIORITY_RANK: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function progressOf(total: number, done: number) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, percent };
}

type DateLike = Date | string | null | undefined;
const toTime = (d: DateLike) => (d ? new Date(d).getTime() : null);

/** A task is overdue when its due date has passed and it is not DONE. */
export function isTaskOverdue(task: { dueAt: DateLike; status: string }, now: Date = new Date()) {
  const due = toTime(task.dueAt);
  return due !== null && due < now.getTime() && task.status !== "DONE";
}

/** A project is overdue when its due date has passed and it is neither completed nor archived. */
export function isProjectOverdue(project: { dueAt: DateLike; status: string }, now: Date = new Date()) {
  const due = toTime(project.dueAt);
  return due !== null && due < now.getTime() && project.status !== "COMPLETED" && project.status !== "ARCHIVED";
}

/** Sort comparator: URGENT → LOW, then earliest due date (undated last), then title. */
export function compareTasksByPriority(
  a: { priority: string; dueAt: DateLike; title: string },
  b: { priority: string; dueAt: DateLike; title: string },
) {
  return (
    (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) ||
    compareDue(a.dueAt, b.dueAt) ||
    a.title.localeCompare(b.title)
  );
}

/** Sort comparator: earliest due date first (undated last), then priority. */
export function compareTasksByDue(
  a: { priority: string; dueAt: DateLike; title: string },
  b: { priority: string; dueAt: DateLike; title: string },
) {
  return compareDue(a.dueAt, b.dueAt) || (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || a.title.localeCompare(b.title);
}

function compareDue(a: DateLike, b: DateLike) {
  const ta = toTime(a);
  const tb = toTime(b);
  if (ta === tb) return 0;
  if (ta === null) return 1;
  if (tb === null) return -1;
  return ta - tb;
}

export type DueBucket = "overdue" | "today" | "week" | "later" | "none";
export const DUE_BUCKET_LABEL: Record<DueBucket, string> = {
  overdue: "Overdue",
  today: "Due today",
  week: "Due in the next 7 days",
  later: "Later",
  none: "No due date",
};

/** Bucket a task by due date relative to `now` (local day boundaries). */
export function dueBucket(task: { dueAt: DateLike; status: string }, now: Date = new Date()): DueBucket {
  const due = toTime(task.dueAt);
  if (due === null) return "none";
  if (isTaskOverdue(task, now)) return "overdue";
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (due <= endOfToday.getTime()) return "today";
  if (due <= endOfToday.getTime() + 7 * 86_400_000) return "week";
  return "later";
}

/** Group items preserving the order of `keys`; empty groups are dropped. */
export function groupBy<T, K extends string>(items: T[], keyOf: (item: T) => K, keys: readonly K[]) {
  const map = new Map<K, T[]>(keys.map((k) => [k, []]));
  for (const item of items) map.get(keyOf(item))?.push(item);
  return keys.map((key) => ({ key, items: map.get(key) ?? [] })).filter((g) => g.items.length > 0);
}

/**
 * Last-OWNER guard: would this change leave the organisation without an ACTIVE owner?
 * `activeOwnerCount` counts ACTIVE owners including the target.
 */
export function wouldRemoveLastOwner(
  target: { role: string; status: string },
  change: { role?: string; status?: string; remove?: boolean },
  activeOwnerCount: number,
) {
  if (target.role !== "OWNER" || target.status !== "ACTIVE") return false;
  const losesOwnership =
    change.remove === true || (change.role !== undefined && change.role !== "OWNER") || (change.status !== undefined && change.status !== "ACTIVE");
  return losesOwnership && activeOwnerCount <= 1;
}

/** completedAt follows status: set when entering DONE, kept while DONE, cleared otherwise. */
export function nextCompletedAt(status: string, previous: Date | null, now: Date = new Date()) {
  if (status !== "DONE") return null;
  return previous ?? now;
}

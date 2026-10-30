/**
 * Shared zod schemas for the collaboration module. Imported by route handlers (server-side
 * validation is authoritative) and by client forms (same rules, earlier feedback).
 * Deliberately free of "server-only" and Prisma runtime imports.
 */
import { z } from "zod";
import { paginationSchema } from "@/lib/api/pagination";

// ── Enum value lists (mirror prisma/schema.prisma) ─────────────────────────

export const ORG_TYPES = ["INTERNAL", "CLIENT"] as const;
export const MEMBERSHIP_ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export const MEMBERSHIP_STATUSES = ["PENDING_APPROVAL", "INVITED_PENDING_TERMS", "ACTIVE", "SUSPENDED", "REVOKED"] as const;
export const INVITATION_STATUSES = ["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"] as const;
export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const;
export const PROJECT_VISIBILITIES = ["WORKSPACE", "PRIVATE"] as const;
export const PROJECT_KINDS = ["STANDARD", "HACKATHON_TEAM"] as const;
export const PROJECT_ROLES = ["MANAGER", "CONTRIBUTOR", "VIEWER"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const TICKET_STATUSES = ["NEW", "IN_PROGRESS", "CLOSED"] as const;

// ── Field helpers ───────────────────────────────────────────────────────────

const id = z.string().trim().min(1).max(64);
const optionalText = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
const requiredText = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label} is required.` : `${label} must be at least ${min} characters.`)
    .max(max, `${label} must be at most ${max} characters.`);
/** ISO-8601 timestamp (with offset or Z). `null` clears the value on PATCH. */
const isoDateTime = z.iso.datetime({ offset: true, message: "Enter a valid date." });
const nullableDate = isoDateTime.nullable().optional();

/** Kebab-case, URL-safe workspace slug. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug must be at least 2 characters.")
  .max(48, "Slug must be at most 48 characters.")
  .regex(SLUG_PATTERN, "Use lowercase letters, numbers and single hyphens (e.g. acme-bank).");

/** Suggest a slug from a workspace name (pure, used by the create dialog). */
export function slugify(name: string) {
  return name
    .normalize("NFKD")
    .split("")
    .filter((c) => c.charCodeAt(0) < 0x300 || c.charCodeAt(0) > 0x36f) // strip combining accents
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

const booleanQuery = z.enum(["1", "0", "true", "false"]).transform((v) => v === "1" || v === "true");

// ── Workspaces ──────────────────────────────────────────────────────────────

export const workspaceCreateSchema = z.object({
  name: requiredText(2, 100, "Name"),
  slug: slugSchema,
  industry: optionalText(80),
  region: optionalText(80),
  description: optionalText(1000),
  /** Optional: invite this person as the workspace OWNER. */
  ownerEmail: z.union([z.literal(""), z.email("Enter a valid email address.")]),
});
export type WorkspaceCreateInput = z.infer<typeof workspaceCreateSchema>;

export const workspaceUpdateSchema = z
  .object({
    name: requiredText(2, 100, "Name"),
    slug: slugSchema,
    industry: optionalText(80),
    region: optionalText(80),
    description: optionalText(1000),
  })
  .partial();
export type WorkspaceUpdateInput = z.infer<typeof workspaceUpdateSchema>;

export const workspaceDeleteSchema = z.object({ confirmName: z.string().trim().min(1, "Type the workspace name to confirm.") });

export const workspaceListQuery = paginationSchema.extend({ q: optionalText(100).optional() });

export const memberListQuery = paginationSchema.extend({
  status: z.enum(MEMBERSHIP_STATUSES).optional(),
  q: optionalText(100).optional(),
});

export const memberUpdateSchema = z
  .object({
    role: z.enum(MEMBERSHIP_ROLES).optional(),
    /** Only suspend / reactivate are possible here; removal is DELETE. */
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  })
  .refine((v) => v.role !== undefined || v.status !== undefined, { message: "Nothing to update." });
export type MemberUpdateInput = z.infer<typeof memberUpdateSchema>;

export const invitationCreateSchema = z.object({
  email: z.email("Enter a valid email address."),
  role: z.enum(MEMBERSHIP_ROLES),
});
export type InvitationCreateInput = z.infer<typeof invitationCreateSchema>;

export const invitationListQuery = paginationSchema.extend({ status: z.enum(INVITATION_STATUSES).optional() });

// ── Announcements & support ─────────────────────────────────────────────────

export const announcementCreateSchema = z.object({
  title: requiredText(2, 160, "Title"),
  body: requiredText(1, 5000, "Message"),
  pinned: z.boolean(),
});
export type AnnouncementCreateInput = z.infer<typeof announcementCreateSchema>;

export const ticketCreateSchema = z.object({
  subject: requiredText(3, 160, "Subject"),
  body: requiredText(10, 5000, "Description"),
});
export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;

export const ticketUpdateSchema = z.object({ status: z.enum(TICKET_STATUSES) });
export const ticketListQuery = paginationSchema.extend({ status: z.enum(TICKET_STATUSES).optional() });

// ── Projects ────────────────────────────────────────────────────────────────

const projectFields = {
  name: requiredText(2, 120, "Name"),
  description: optionalText(5000),
  status: z.enum(PROJECT_STATUSES),
  visibility: z.enum(PROJECT_VISIBILITIES),
  ownerId: id,
  startsAt: nullableDate,
  dueAt: nullableDate,
};

const datesInOrder = (v: { startsAt?: string | null; dueAt?: string | null }) =>
  !v.startsAt || !v.dueAt || new Date(v.startsAt).getTime() <= new Date(v.dueAt).getTime();
const datesMessage = { message: "The due date must be on or after the start date.", path: ["dueAt"] };

export const projectCreateSchema = z
  .object({
    /** Workspace to create the project in (verified server-side); defaults to the active workspace. */
    workspaceId: id.optional(),
    name: projectFields.name,
    description: projectFields.description.optional(),
    status: projectFields.status.optional(),
    visibility: projectFields.visibility.optional(),
    ownerId: projectFields.ownerId.optional(),
    startsAt: projectFields.startsAt,
    dueAt: projectFields.dueAt,
    kind: z.enum(PROJECT_KINDS).optional(),
    hackathonEventId: id.optional(),
  })
  .refine(datesInOrder, datesMessage);
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;

export const projectUpdateSchema = z
  .object({
    name: projectFields.name,
    description: projectFields.description,
    status: projectFields.status,
    visibility: projectFields.visibility,
    ownerId: projectFields.ownerId,
    startsAt: projectFields.startsAt,
    dueAt: projectFields.dueAt,
  })
  .partial()
  .refine(datesInOrder, datesMessage);
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

export const projectListQuery = paginationSchema.extend({
  workspaceId: id.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  kind: z.enum(PROJECT_KINDS).optional(),
  q: optionalText(100).optional(),
});
export type ProjectListFilters = z.infer<typeof projectListQuery>;

export const projectMemberAddSchema = z.object({ userId: id, role: z.enum(PROJECT_ROLES) });
export const projectMemberUpdateSchema = z.object({ role: z.enum(PROJECT_ROLES) });

// ── Tasks & comments ────────────────────────────────────────────────────────

const taskFields = {
  title: requiredText(2, 200, "Title"),
  description: optionalText(10000),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  assigneeId: id.nullable(),
  dueAt: nullableDate,
};

export const taskCreateSchema = z.object({
  title: taskFields.title,
  description: taskFields.description.optional(),
  status: taskFields.status.optional(),
  priority: taskFields.priority.optional(),
  assigneeId: taskFields.assigneeId.optional(),
  dueAt: taskFields.dueAt,
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const taskUpdateSchema = z.object(taskFields).partial();
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

export const TASK_SORTS = ["priority", "due", "updated", "created"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

export const taskListQuery = paginationSchema.extend({
  /** A task status, or "OPEN" for everything not DONE. */
  status: z.enum([...TASK_STATUSES, "OPEN"]).optional(),
  priority: z.enum(PRIORITIES).optional(),
  /** "me", "none" (unassigned) or a user id. */
  assignee: id.optional(),
  overdue: booleanQuery.optional(),
  q: optionalText(100).optional(),
  sort: z.enum(TASK_SORTS).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type TaskListFilters = z.infer<typeof taskListQuery>;

export const commentCreateSchema = z.object({
  body: requiredText(1, 5000, "Comment"),
  parentId: id.optional(),
});
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;

// ── Discussions ─────────────────────────────────────────────────────────────

export const discussionCreateSchema = z.object({
  title: requiredText(3, 200, "Title"),
  body: requiredText(1, 10000, "Message"),
});
export type DiscussionCreateInput = z.infer<typeof discussionCreateSchema>;

export const replyCreateSchema = z.object({
  body: requiredText(1, 5000, "Reply"),
  parentId: id.optional(),
});

// ── Documents & activity ────────────────────────────────────────────────────

export const documentUploadFields = z.object({
  workspaceId: id,
  projectId: z.union([z.literal(""), id]).optional(),
});

export const activityQuery = paginationSchema.extend({ limit: z.coerce.number().int().min(1).max(100).default(30) });

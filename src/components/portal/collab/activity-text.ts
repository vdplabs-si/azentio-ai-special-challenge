/** Human sentences for audit-backed project activity (pure). */
import { PROJECT_ROLE_LABEL, PROJECT_STATUS_LABEL, TASK_STATUS_LABEL } from "@/components/portal/collab/labels";

export interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  createdAt: Date | string;
  actor: { id: string; name: string } | null;
  subject: string | null;
  details: Record<string, string>;
}

const q = (s: string | null, fallback: string) => (s ? `“${s}”` : fallback);

export function describeActivity(e: ActivityEntry): string {
  const d = e.details;
  switch (e.action) {
    case "project.create":
      return "created the project";
    case "hackathon.team.create":
      return "created the team space";
    case "project.update": {
      if (d.status) return `updated the project (status: ${PROJECT_STATUS_LABEL[d.status] ?? d.status})`;
      return d.fields ? `updated project settings (${d.fields})` : "updated project settings";
    }
    case "project.delete":
      return "deleted the project";
    case "project.member.add":
    case "hackathon.team.join":
      return `added ${q(e.subject, "a member")}${d.role ? ` as ${(PROJECT_ROLE_LABEL[d.role] ?? d.role).toLowerCase()}` : ""}`;
    case "project.member.update":
      return `changed the role of ${q(e.subject, "a member")}${d.to ? ` to ${(PROJECT_ROLE_LABEL[d.to] ?? d.to).toLowerCase()}` : ""}`;
    case "project.member.remove":
      return `removed ${q(e.subject, "a member")} from the project`;
    case "project.member.leave":
      return "left the project";
    case "task.create":
      return `created task ${q(e.subject, "(since deleted)")}`;
    case "task.status_change":
      return `moved task ${q(e.subject, "(since deleted)")}${d.to ? ` to ${TASK_STATUS_LABEL[d.to] ?? d.to}` : ""}`;
    case "task.update": {
      const status = d.to ? `, status ${TASK_STATUS_LABEL[d.to] ?? d.to}` : "";
      return `updated task ${q(e.subject, "(since deleted)")}${d.fields ? ` (${d.fields}${status})` : ""}`;
    }
    case "task.delete":
      return "deleted a task";
    case "task.comment.create":
      return `commented on ${q(e.subject, "a task")}`;
    case "discussion.create":
      return `started the discussion ${q(e.subject, "(since deleted)")}`;
    case "discussion.reply":
      return `replied in ${q(e.subject, "a discussion")}`;
    case "discussion.delete":
      return "deleted a discussion";
    case "document.upload":
      return `uploaded ${q(e.subject, "a document (since deleted)")}`;
    case "document.delete":
      return "deleted a document";
    default:
      return e.action.replace(/[._]/g, " ");
  }
}

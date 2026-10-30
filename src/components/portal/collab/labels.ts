/** Human labels and badge tones for collaboration enums (pure; safe in client and server code). */

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

export const PRIORITY_LABEL: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High", URGENT: "Urgent" };

export const VISIBILITY_LABEL: Record<string, string> = { WORKSPACE: "Workspace", PRIVATE: "Private" };
export const VISIBILITY_HINT: Record<string, string> = {
  WORKSPACE: "Every active member of the workspace can view it.",
  PRIVATE: "Only project members, the owner and workspace admins can view it.",
};

export const KIND_LABEL: Record<string, string> = { STANDARD: "Project", HACKATHON_TEAM: "Hackathon team" };

export const MEMBERSHIP_ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
};
export const MEMBERSHIP_ROLE_HINT: Record<string, string> = {
  OWNER: "Full control, including deleting the workspace.",
  ADMIN: "Client administrator: manages members, settings and announcements.",
  MEMBER: "Creates and contributes to projects.",
  VIEWER: "Read-only access to workspace projects.",
};

export const MEMBERSHIP_STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: "Pending approval",
  INVITED_PENDING_TERMS: "Awaiting terms",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  REVOKED: "Removed",
};

export const INVITATION_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REVOKED: "Revoked",
  EXPIRED: "Expired",
};

export const PROJECT_ROLE_LABEL: Record<string, string> = { MANAGER: "Manager", CONTRIBUTOR: "Contributor", VIEWER: "Viewer" };

export const TICKET_STATUS_LABEL: Record<string, string> = { NEW: "New", IN_PROGRESS: "In progress", CLOSED: "Closed" };

export const ORG_TYPE_LABEL: Record<string, string> = { INTERNAL: "Internal (Azentio)", CLIENT: "Client" };

/** Tailwind classes for soft status badges (used with <Badge variant="outline">). */
export const TONE = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-brand-navy/20 bg-brand-navy/5 text-brand-navy",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  brand: "border-brand-green/40 bg-brand-green/15 text-brand-ink",
} as const;
export type Tone = keyof typeof TONE;

export const PROJECT_STATUS_TONE: Record<string, Tone> = {
  PLANNING: "info",
  ACTIVE: "brand",
  ON_HOLD: "warning",
  COMPLETED: "success",
  ARCHIVED: "neutral",
};
export const TASK_STATUS_TONE: Record<string, Tone> = { TODO: "neutral", IN_PROGRESS: "info", BLOCKED: "danger", DONE: "success" };
export const PRIORITY_TONE: Record<string, Tone> = { LOW: "neutral", MEDIUM: "info", HIGH: "warning", URGENT: "danger" };
export const MEMBERSHIP_STATUS_TONE: Record<string, Tone> = {
  PENDING_APPROVAL: "warning",
  INVITED_PENDING_TERMS: "info",
  ACTIVE: "success",
  SUSPENDED: "warning",
  REVOKED: "neutral",
};
export const INVITATION_STATUS_TONE: Record<string, Tone> = { PENDING: "info", ACCEPTED: "success", REVOKED: "neutral", EXPIRED: "warning" };
export const TICKET_STATUS_TONE: Record<string, Tone> = { NEW: "info", IN_PROGRESS: "warning", CLOSED: "success" };

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

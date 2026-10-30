/**
 * Human-readable labels and option lists for the collective-learning module.
 * Pure (no server-only imports) so client components can import it.
 */
import type {
  Confidence,
  EvidenceType,
  IdeaStatus,
  IdeaVisibility,
  ObservationStatus,
  ObservationType,
  Priority,
  ReportReason,
  ReportStatus,
  SharedStatus,
  ThemeStatus,
} from "@/generated/prisma/enums";
import { INDUSTRIES, REGIONS } from "@/content/catalogue";

export const OBSERVATION_TYPE_LABELS: Record<ObservationType, string> = {
  MARKET_OBSERVATION: "Market observation",
  EMERGING_TREND: "Emerging trend",
  PRODUCT_GAP: "Product gap",
  OPERATIONAL_CHALLENGE: "Operational challenge",
  SUCCESSFUL_PRACTICE: "Successful practice",
  IMPROVEMENT_SUGGESTION: "Improvement suggestion",
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  ANECDOTAL: "Anecdotal",
  CLIENT_FEEDBACK: "Client feedback",
  INTERNAL_ANALYSIS: "Internal analysis",
  MARKET_RESEARCH: "Market research",
  REGULATORY_CHANGE: "Regulatory change",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  LOW: "Low confidence",
  MEDIUM: "Medium confidence",
  HIGH: "High confidence",
};

export const OBSERVATION_STATUS_LABELS: Record<ObservationStatus, string> = {
  DRAFT: "Private draft",
  SUBMITTED: "Submitted for review",
  RETURNED: "Clarification requested",
  PUBLISHED: "Published (shared copy)",
  REJECTED: "Not published",
  SUSPENDED: "Temporarily unpublished",
  WITHDRAWN: "Withdrawn",
};

export const OBSERVATION_STATUS_TONE: Record<ObservationStatus, "neutral" | "info" | "warning" | "success" | "danger"> = {
  DRAFT: "neutral",
  SUBMITTED: "info",
  RETURNED: "warning",
  PUBLISHED: "success",
  REJECTED: "danger",
  SUSPENDED: "warning",
  WITHDRAWN: "neutral",
};

export const SHARED_STATUS_LABELS: Record<SharedStatus, string> = {
  PUBLISHED: "Published",
  SUSPENDED: "Suspended during review",
  WITHDRAWN: "Withdrawn by contributor",
  SUPERSEDED: "Superseded by a newer version",
  REMOVED: "Removed by moderator",
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  MISLEADING: "Misleading or inaccurate",
  CONFIDENTIAL: "Contains confidential or identifying information",
  INAPPROPRIATE: "Inappropriate",
  OTHER: "Other",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  OPEN: "Open",
  RESOLVED_KEPT: "Resolved — kept",
  RESOLVED_REMOVED: "Resolved — removed",
};

export const THEME_STATUS_LABELS: Record<ThemeStatus, string> = {
  DRAFT: "Draft (internal)",
  PUBLISHED: "Published to participants",
  ARCHIVED: "Archived",
};

/** Plain-language idea status labels for participants. Never imply a delivery commitment. */
export const IDEA_STATUS_LABELS: Record<IdeaStatus, string> = {
  PROPOSED: "Proposed",
  UNDER_REVIEW: "Under review",
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  RELEASED: "Released",
  NOT_PROCEEDING: "Not proceeding",
};

export const IDEA_STATUS_EXPLANATIONS: Record<IdeaStatus, string> = {
  PROPOSED: "Captured for consideration. No decision has been made.",
  UNDER_REVIEW: "Being assessed by the product team. This is not a delivery commitment.",
  PLANNED: "Planned for future work. Plans can change and dates are not guaranteed.",
  IN_PROGRESS: "Work has started. Scope and timing may still change.",
  RELEASED: "Available in a release.",
  NOT_PROCEEDING: "The product team decided not to proceed at this time.",
};

export const IDEA_VISIBILITY_LABELS: Record<IdeaVisibility, string> = {
  INTERNAL: "Internal only",
  SHARED_WITH_PARTICIPANTS: "Shared with participants",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

/** Industry options for contributions: catalogue industries plus "cross-industry". */
export const INDUSTRY_OPTIONS = [
  ...INDUSTRIES.map((i) => ({ value: i.slug, label: i.name })),
  { value: "cross-industry", label: "Cross-industry" },
] as const;
export const INDUSTRY_VALUES = INDUSTRY_OPTIONS.map((o) => o.value) as [string, ...string[]];
export const industryLabel = (slug: string) => INDUSTRY_OPTIONS.find((o) => o.value === slug)?.label ?? slug;

export const REGION_OPTIONS = REGIONS;

export const SENSITIVE_DISCLAIMER = "An automated scan is not a privacy guarantee.";

export const PRIVACY_PROMPT =
  "Do not include customer identities, account numbers, transaction-level data, credentials, confidential contractual terms or any other restricted information.";

export const EXPERIMENT_STATUSES = ["SUBMITTED", "IN_REVIEW", "ACCEPTED", "ARCHIVED"] as const;
export type ExperimentStatusValue = (typeof EXPERIMENT_STATUSES)[number];

export const EXPERIMENT_STATUS_LABEL: Record<ExperimentStatusValue, string> = {
  SUBMITTED: "Submitted",
  IN_REVIEW: "In review",
  ACCEPTED: "Accepted",
  ARCHIVED: "Archived",
};

export const EXPERIMENT_STATUS_HINT: Record<ExperimentStatusValue, string> = {
  SUBMITTED: "Awaiting a reviewer. The author can still edit it.",
  IN_REVIEW: "A reviewer is assessing the experiment.",
  ACCEPTED: "Accepted for follow-up.",
  ARCHIVED: "Closed without further action.",
};

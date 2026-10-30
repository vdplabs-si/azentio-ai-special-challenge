export type AudienceValue = "PUBLIC" | "EMPLOYEE" | "CLIENT_ALL" | "CLIENT_ORGS";
export type LiveStatusValue = "SCHEDULED" | "LIVE" | "ENDED" | "CANCELLED";

export const AUDIENCE_LABEL: Record<AudienceValue, string> = {
  PUBLIC: "Public",
  EMPLOYEE: "Employees only",
  CLIENT_ALL: "All clients",
  CLIENT_ORGS: "Invitation only",
};

export const AUDIENCE_HINT: Record<AudienceValue, string> = {
  PUBLIC: "Anyone, including visitors who are not signed in.",
  EMPLOYEE: "Verified Azentio employees only.",
  CLIENT_ALL: "Every active client member, plus employees.",
  CLIENT_ORGS: "Only the client organisations you select (invitation-only webinar).",
};

export const LIVE_STATUS_LABEL: Record<LiveStatusValue, string> = {
  SCHEDULED: "Scheduled",
  LIVE: "Live now",
  ENDED: "Ended",
  CANCELLED: "Cancelled",
};

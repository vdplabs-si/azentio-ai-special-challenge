export type ContentTypeValue = "INSIGHT" | "RELEASE_NOTE" | "BRIEFING" | "KNOWLEDGE";
export type LibraryTypeValue = Exclude<ContentTypeValue, "INSIGHT">;
export type ContentStatusValue = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ContentAudienceValue = "PUBLIC" | "EMPLOYEE" | "CLIENT_ALL" | "CLIENT_ORGS";

export const LIBRARY_TYPES: LibraryTypeValue[] = ["KNOWLEDGE", "RELEASE_NOTE", "BRIEFING"];

export const CONTENT_TYPE_LABEL: Record<ContentTypeValue, string> = {
  INSIGHT: "Insight",
  RELEASE_NOTE: "Release note",
  BRIEFING: "Client briefing",
  KNOWLEDGE: "Knowledge",
};

export const CONTENT_TYPE_PLURAL: Record<LibraryTypeValue, string> = {
  KNOWLEDGE: "Knowledge library",
  RELEASE_NOTE: "Release notes",
  BRIEFING: "Client briefings",
};

export const CONTENT_STATUS_LABEL: Record<ContentStatusValue, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const CONTENT_AUDIENCE_LABEL: Record<ContentAudienceValue, string> = {
  PUBLIC: "Public",
  EMPLOYEE: "Employees only",
  CLIENT_ALL: "All clients",
  CLIENT_ORGS: "Single client organisation",
};

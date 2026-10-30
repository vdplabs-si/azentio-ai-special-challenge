import { AlarmClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CONTENT_AUDIENCE_LABEL, CONTENT_STATUS_LABEL, CONTENT_TYPE_LABEL,
  type ContentAudienceValue, type ContentStatusValue, type ContentTypeValue,
} from "@/components/portal/knowledge/labels";

export function ContentTypeBadge({ type }: { type: ContentTypeValue }) {
  return <Badge variant="secondary">{CONTENT_TYPE_LABEL[type]}</Badge>;
}

/** Audience is internal metadata — callers render it for employees only. */
export function ContentAudienceBadge({ audience, organisationName }: { audience: ContentAudienceValue; organisationName?: string | null }) {
  return (
    <Badge variant="outline">
      {audience === "CLIENT_ORGS" && organisationName ? organisationName : CONTENT_AUDIENCE_LABEL[audience]}
    </Badge>
  );
}

export function ContentStatusBadge({ status }: { status: ContentStatusValue }) {
  if (status === "PUBLISHED") return null;
  return <Badge variant={status === "ARCHIVED" ? "outline" : "default"}>{CONTENT_STATUS_LABEL[status]}</Badge>;
}

export function ReviewOverdueBadge() {
  return (
    <Badge className="bg-warning/15 text-warning">
      <AlarmClock aria-hidden /> Review overdue
    </Badge>
  );
}

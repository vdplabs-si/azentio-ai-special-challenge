import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AUDIENCE_LABEL, LIVE_STATUS_LABEL, type AudienceValue, type LiveStatusValue } from "@/components/portal/live/labels";

export function LiveStatusBadge({ status }: { status: LiveStatusValue }) {
  if (status === "LIVE") {
    return (
      <Badge className="bg-destructive text-white">
        <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden /> {LIVE_STATUS_LABEL.LIVE}
      </Badge>
    );
  }
  return (
    <Badge variant={status === "CANCELLED" ? "destructive" : "secondary"} className={cn(status === "ENDED" && "text-muted-foreground")}>
      {LIVE_STATUS_LABEL[status]}
    </Badge>
  );
}

export function AudienceBadge({ audience }: { audience: AudienceValue }) {
  return <Badge variant="outline">{AUDIENCE_LABEL[audience]}</Badge>;
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EXPERIMENT_STATUS_LABEL, type ExperimentStatusValue } from "@/components/portal/experiments/labels";

const TONE: Record<ExperimentStatusValue, string> = {
  SUBMITTED: "bg-brand-light text-brand-ink border-border",
  IN_REVIEW: "bg-warning/15 text-brand-ink",
  ACCEPTED: "bg-success/15 text-success",
  ARCHIVED: "bg-muted text-muted-foreground",
};

export function ExperimentStatusBadge({ status }: { status: ExperimentStatusValue }) {
  return <Badge className={cn("border", TONE[status])}>{EXPERIMENT_STATUS_LABEL[status]}</Badge>;
}

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { humanize } from "@/components/portal/admin/format";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_BY_STATUS: Record<string, Tone> = {
  ACTIVE: "success",
  PUBLISHED: "success",
  CLOSED: "neutral",
  DEACTIVATED: "danger",
  SUSPENDED: "danger",
  REVOKED: "danger",
  NEW: "info",
  IN_PROGRESS: "warning",
  PENDING_APPROVAL: "warning",
  INVITED_PENDING_TERMS: "warning",
  DRAFT: "neutral",
  ARCHIVED: "neutral",
  INTERNAL: "info",
  CLIENT: "neutral",
};

const TONES: Record<Tone, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-brand-navy/10 text-brand-navy",
  neutral: "bg-muted text-muted-foreground",
};

/** Consistent status pill for admin tables. */
export function StatusBadge({ status = "", label, tone }: { status?: string; label?: string; tone?: Tone }) {
  return (
    <Badge variant="secondary" className={cn("font-medium", TONES[tone ?? TONE_BY_STATUS[status] ?? "neutral"])}>
      {label ?? humanize(status)}
    </Badge>
  );
}

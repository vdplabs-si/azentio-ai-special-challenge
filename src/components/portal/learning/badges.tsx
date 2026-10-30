import { Lock, Users } from "lucide-react";
import type { IdeaStatus, ObservationStatus, SharedStatus, ThemeStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import {
  IDEA_STATUS_LABELS,
  OBSERVATION_STATUS_LABELS,
  OBSERVATION_STATUS_TONE,
  SHARED_STATUS_LABELS,
  THEME_STATUS_LABELS,
} from "@/server/learning/labels";
import type { CohortValue } from "@/server/learning/cohort";

const TONES = {
  neutral: "border-border bg-muted text-brand-ink",
  info: "border-brand-navy/20 bg-brand-navy/5 text-brand-navy",
  warning: "border-warning/40 bg-warning/10 text-brand-ink",
  success: "border-success/40 bg-success/10 text-success",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
} as const;

export function Chip({ tone = "neutral", className, children }: { tone?: keyof typeof TONES; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-xs font-medium", TONES[tone], className)}>
      {children}
    </span>
  );
}

export function ObservationStatusBadge({ status }: { status: ObservationStatus }) {
  return <Chip tone={OBSERVATION_STATUS_TONE[status]}>{OBSERVATION_STATUS_LABELS[status]}</Chip>;
}

const SHARED_TONE: Record<SharedStatus, keyof typeof TONES> = {
  PUBLISHED: "success",
  SUSPENDED: "warning",
  WITHDRAWN: "neutral",
  SUPERSEDED: "neutral",
  REMOVED: "danger",
};
export function SharedStatusBadge({ status }: { status: SharedStatus }) {
  return <Chip tone={SHARED_TONE[status]}>{SHARED_STATUS_LABELS[status]}</Chip>;
}

const IDEA_TONE: Record<IdeaStatus, keyof typeof TONES> = {
  PROPOSED: "neutral",
  UNDER_REVIEW: "info",
  PLANNED: "info",
  IN_PROGRESS: "warning",
  RELEASED: "success",
  NOT_PROCEEDING: "danger",
};
export function IdeaStatusBadge({ status }: { status: IdeaStatus }) {
  return <Chip tone={IDEA_TONE[status]}>{IDEA_STATUS_LABELS[status]}</Chip>;
}

const THEME_TONE: Record<ThemeStatus, keyof typeof TONES> = { DRAFT: "neutral", PUBLISHED: "success", ARCHIVED: "neutral" };
export function ThemeStatusBadge({ status }: { status: ThemeStatus }) {
  return <Chip tone={THEME_TONE[status]}>{THEME_STATUS_LABELS[status]}</Chip>;
}

/** Header badge for private organisation knowledge (navy accent). */
export function PrivateBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-brand-navy/25 bg-brand-navy px-3 py-1 text-xs font-semibold text-white", className)}>
      <Lock className="size-3.5" aria-hidden /> Private to your organisation
    </span>
  );
}

/** Header badge for the cross-client shared feed (green accent). */
export function SharedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success", className)}>
      <Users className="size-3.5" aria-hidden /> Shared with approved participants
    </span>
  );
}

/** Distinct-organisation count with small-cohort suppression. Never renders a suppressed number. */
export function CohortText({ value, noun = "organisations" }: { value: CohortValue; noun?: string }) {
  if (value.suppressed) {
    return <span className="text-muted-foreground">Fewer than {value.min} {noun} — count suppressed</span>;
  }
  return (
    <span>
      {value.value} {value.value === 1 ? noun.replace(/s$/, "") : noun}
    </span>
  );
}

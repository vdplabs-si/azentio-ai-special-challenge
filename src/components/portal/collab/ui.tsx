/**
 * Presentational building blocks for collaboration pages. No hooks — usable from server and
 * client components alike. Text is always rendered as text (never HTML).
 */
import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { tokenizeMentions } from "@/components/portal/collab/mention-tokens";
import { initials, TONE, type Tone } from "@/components/portal/collab/labels";
import { formatDate } from "@/components/portal/collab/dates";

export function ToneBadge({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn(TONE[tone], className)}>
      {children}
    </Badge>
  );
}

/** Label + tone lookup for an enum value. */
export function EnumBadge({ value, labels, tones, className }: { value: string; labels: Record<string, string>; tones: Record<string, Tone>; className?: string }) {
  return (
    <ToneBadge tone={tones[value] ?? "neutral"} className={className}>
      {labels[value] ?? value}
    </ToneBadge>
  );
}

export function PersonAvatar({ name, image, size = "sm" }: { name: string; image?: string | null; size?: "sm" | "default" | "lg" }) {
  return (
    <Avatar size={size}>
      {image ? <AvatarImage src={image} alt="" /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function Person({ name, email, image, className }: { name: string; email?: string | null; image?: string | null; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <PersonAvatar name={name} image={image} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-brand-ink">{name}</p>
        {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
      </div>
    </div>
  );
}

/** Due date with overdue highlighting. */
export function DueDate({ dueAt, overdue, className }: { dueAt: Date | string | null; overdue?: boolean; className?: string }) {
  if (!dueAt) return <span className={cn("text-xs text-muted-foreground", className)}>No due date</span>;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs", overdue ? "font-semibold text-destructive" : "text-muted-foreground", className)}
      title={overdue ? "Overdue" : undefined}
    >
      {overdue ? <AlertTriangle className="size-3.5" aria-hidden /> : <CalendarClock className="size-3.5" aria-hidden />}
      {formatDate(dueAt)}
      {overdue && <span className="sr-only">(overdue)</span>}
    </span>
  );
}

export function ProgressMeter({ done, total, percent, className }: { done: number; total: number; percent: number; className?: string }) {
  return (
    <div className={cn("min-w-28", className)}>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{total === 0 ? "No tasks yet" : `${done}/${total} done`}</span>
        <span className="font-medium text-brand-ink">{percent}%</span>
      </div>
      <Progress value={percent} aria-label={`${percent}% of tasks done`} className="h-1.5 [&>[data-slot=progress-indicator]]:bg-brand-green" />
    </div>
  );
}

export function RelativeTime({ value, className }: { value: Date | string; className?: string }) {
  const d = new Date(value);
  return (
    <time suppressHydrationWarning dateTime={d.toISOString()} title={d.toISOString()} className={cn("text-xs text-muted-foreground", className)}>
      {formatDistanceToNowStrict(d, { addSuffix: true })}
    </time>
  );
}

/** Body text with @mention tokens rendered as styled spans. Never uses HTML injection. */
export function RichText({ body, className }: { body: string; className?: string }) {
  const parts = tokenizeMentions(body);
  return (
    <div className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-ink", className)}>
      {parts.map((p, i) =>
        p.type === "text" ? (
          <Fragment key={i}>{p.value}</Fragment>
        ) : p.type === "mention" ? (
          <span key={i} className="rounded bg-brand-green/15 px-1 font-medium text-brand-ink">
            @{p.name}
          </span>
        ) : (
          <Fragment key={i}>@{p.email}</Fragment>
        ),
      )}
    </div>
  );
}

/** Free text that never went through mention normalisation (descriptions, announcements, tickets). */
export function PlainText({ body, className }: { body: string; className?: string }) {
  return <div className={cn("whitespace-pre-wrap break-words text-sm leading-relaxed text-brand-ink", className)}>{body}</div>;
}

/** Link-based tabs (server-rendered; each tab is a URL so it can be bookmarked and shared). */
export function TabNav({ tabs, active, label }: { tabs: { key: string; label: string; href: string; count?: number | null }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto">
      <ul className="inline-flex min-w-full gap-1 border-b px-1">
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={isActive ? "page" : undefined}
                scroll={false}
                className={cn(
                  "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "border-brand-green text-brand-ink" : "border-transparent text-muted-foreground hover:text-brand-ink",
                )}
              >
                {t.label}
                {typeof t.count === "number" && (
                  <span className="rounded-full bg-muted px-1.5 text-[0.7rem] font-semibold text-muted-foreground">{t.count}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Cursor pagination links: "First page" when paged, "Next" when more rows exist. */
export function CursorPager({ firstHref, nextHref, isFirstPage }: { firstHref: string; nextHref: string | null; isFirstPage: boolean }) {
  if (isFirstPage && !nextHref) return null;
  return (
    <div className="flex items-center justify-end gap-2 pt-4">
      {!isFirstPage && (
        <Button variant="outline" size="sm" asChild>
          <Link href={firstHref}>
            <ChevronLeft aria-hidden /> First page
          </Link>
        </Button>
      )}
      {nextHref && (
        <Button variant="outline" size="sm" asChild>
          <Link href={nextHref}>
            Next page <ChevronRight aria-hidden />
          </Link>
        </Button>
      )}
    </div>
  );
}

export function SectionHeading({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Small "label: value" pair for detail headers. */
export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-brand-ink">{children}</dd>
    </div>
  );
}

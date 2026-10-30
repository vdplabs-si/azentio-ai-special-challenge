import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { BellOff } from "lucide-react";
import type { OutboxStatus } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/authz/actor";
import { paginationSchema } from "@/lib/api/pagination";
import { listNotifications, unreadCount } from "@/server/services/notifications";
import { EmptyState, PageHeader } from "@/components/portal/page";
import { Pager } from "@/components/portal/dashboard/pager";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarkAllReadButton, MarkReadButton, OpenNotificationButton } from "@/components/portal/profile/notification-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notifications" };

/** Honest delivery labels: an email is only "sent" when the provider accepted it. */
const OUTBOX_LABEL: Record<OutboxStatus, { text: string; className: string }> = {
  PENDING: { text: "Email: queued", className: "border-border text-muted-foreground" },
  SENT: { text: "Email: sent", className: "border-success/50 text-success" },
  FAILED: { text: "Email: failed", className: "border-destructive/40 text-destructive" },
  SKIPPED_NO_PROVIDER: { text: "Email: not configured", className: "border-warning/50 text-warning" },
};

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ cursor?: string; unread?: string }> }) {
  const actor = await requireUser();
  const sp = await searchParams;
  const unreadOnly = sp.unread === "1";
  const parsed = paginationSchema.safeParse({ cursor: sp.cursor, limit: 25 });
  const page = parsed.success ? parsed.data : { limit: 25 };
  const [list, unread] = await Promise.all([listNotifications(actor, page, unreadOnly), unreadCount(actor)]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Overview"
        title="Notifications"
        description={`${unread} unread. In-app notifications are always recorded; email delivery is shown per item exactly as the outbox reports it.`}
        actions={<MarkAllReadButton disabled={unread === 0} />}
      />

      <nav aria-label="Filter notifications" className="flex gap-2 text-sm">
        <Link
          href="/portal/notifications"
          aria-current={!unreadOnly ? "page" : undefined}
          className={cn("rounded-full border px-3 py-1", !unreadOnly ? "border-brand-navy bg-brand-navy text-white" : "bg-card text-brand-ink")}
        >
          All
        </Link>
        <Link
          href="/portal/notifications?unread=1"
          aria-current={unreadOnly ? "page" : undefined}
          className={cn("rounded-full border px-3 py-1", unreadOnly ? "border-brand-navy bg-brand-navy text-white" : "bg-card text-brand-ink")}
        >
          Unread ({unread})
        </Link>
      </nav>

      {list.items.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={unreadOnly ? "No unread notifications" : "No notifications yet"}
          description={unreadOnly ? "You are all caught up." : "Assignments, mentions, moderation decisions and access changes will appear here."}
        />
      ) : (
        <ul className="grid gap-2">
          {list.items.map((n) => {
            const email = n.outbox.filter((o) => o.channel === "email");
            return (
              <li
                key={n.id}
                className={cn("flex flex-col gap-2 rounded-lg border bg-card p-4 sm:flex-row sm:items-start", !n.readAt && "border-l-4 border-l-brand-green")}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-brand-ink">{n.title}</p>
                    {!n.readAt && <Badge variant="secondary">Unread</Badge>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-brand-ink/80">{n.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <time dateTime={n.createdAt.toISOString()}>{format(n.createdAt, "d MMM yyyy, HH:mm")}</time>
                    <Badge variant="outline">In-app</Badge>
                    {email.length === 0 ? (
                      <span>No email requested</span>
                    ) : (
                      email.map((o, i) => (
                        <Badge key={i} variant="outline" className={OUTBOX_LABEL[o.status].className}>
                          {OUTBOX_LABEL[o.status].text}
                        </Badge>
                      ))
                    )}
                    {n.readAt && <span>Read {format(n.readAt, "d MMM, HH:mm")}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {n.link && n.link.startsWith("/") && !n.link.startsWith("//") && (
                    <OpenNotificationButton id={n.id} href={n.link} unread={!n.readAt} />
                  )}
                  {!n.readAt && <MarkReadButton id={n.id} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Pager
        basePath="/portal/notifications"
        params={{ unread: unreadOnly ? "1" : undefined }}
        cursor={parsed.success ? (parsed.data.cursor ?? null) : null}
        nextCursor={list.nextCursor}
        label="notifications"
      />
    </div>
  );
}

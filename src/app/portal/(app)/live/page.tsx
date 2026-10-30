import Link from "next/link";
import type { Metadata } from "next";
import { CalendarClock, Plus, Radio, Video } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import {
  listInvitableOrganisations,
  listLiveSessions,
  liveSessionCounts,
  type LiveScope,
  type LiveSessionListItem,
} from "@/server/services/live";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { Pager } from "@/components/portal/dashboard/pager";
import { LocalDateTime } from "@/components/portal/live/local-time";
import { AudienceBadge, LiveStatusBadge } from "@/components/portal/live/status-badge";
import { SessionFormDialog } from "@/components/portal/live/session-form-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live sessions" };

type Tab = Exclude<LiveScope, "live">;

const TAB_LABEL: Record<Tab, string> = {
  upcoming: "Upcoming",
  recordings: "Recordings",
  past: "Past sessions",
  manage: "Manage broadcasts",
};

const EMPTY: Record<Tab, { title: string; description: string }> = {
  upcoming: { title: "No upcoming sessions", description: "Scheduled webinars and broadcasts you are invited to will appear here." },
  recordings: { title: "No recordings yet", description: "Recordings appear here after a session ends and a recording is published." },
  past: { title: "No past sessions", description: "Sessions that ended without a published recording are listed here." },
  manage: { title: "No broadcasts yet", description: "Schedule a session to start building the broadcast calendar." },
};

function SessionRow({ s }: { s: LiveSessionListItem }) {
  return (
    <li>
      <Link
        href={`/portal/live/${s.id}`}
        className="flex flex-col gap-2 rounded-lg border bg-card p-4 transition-colors hover:border-brand-green/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0">
          <p className="truncate font-medium text-brand-ink">{s.title}</p>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{s.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            <LocalDateTime value={s.startsAt} />
            {s.endsAt && (
              <>
                {" – "}
                <LocalDateTime value={s.endsAt} />
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <LiveStatusBadge status={s.status} />
          <AudienceBadge audience={s.audience} />
          {s.invitedOrganisationCount !== null && s.audience === "CLIENT_ORGS" && (
            <span className="text-xs text-muted-foreground">{s.invitedOrganisationCount} org(s)</span>
          )}
          {s.hasRecording && <Video className="size-4 text-success" aria-label="Recording available" />}
        </div>
      </Link>
    </li>
  );
}

export default async function LiveSessionsPage({ searchParams }: { searchParams: Promise<{ tab?: string; cursor?: string }> }) {
  const actor = await requireUser();
  const sp = await searchParams;
  const publisher = can.publishBroadcasts(actor);
  const tabs: Tab[] = ["upcoming", "recordings", "past", ...(publisher ? (["manage"] as const) : [])];
  const tab: Tab = tabs.includes(sp.tab as Tab) ? (sp.tab as Tab) : "upcoming";
  const cursor = sp.cursor && sp.cursor.length <= 64 ? sp.cursor : undefined;

  const [counts, liveNow, list, organisations] = await Promise.all([
    liveSessionCounts(actor),
    listLiveSessions(actor, { scope: "live", limit: 10 }),
    listLiveSessions(actor, { scope: tab, cursor, limit: 12 }),
    publisher ? listInvitableOrganisations(actor) : Promise.resolve([]),
  ]);
  const tabCount: Partial<Record<Tab, number>> = { upcoming: counts.upcoming, recordings: counts.recordings, past: counts.past };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Innovation"
        title="Live sessions"
        description="Webinars, product briefings and broadcasts for your audience. Invitation-only sessions are visible only to the organisations invited."
        actions={
          publisher ? (
            <SessionFormDialog
              organisations={organisations}
              canTargetRestricted={actor.isEmployee}
              trigger={
                <Button>
                  <Plus aria-hidden /> Schedule session
                </Button>
              }
            />
          ) : undefined
        }
      />

      {liveNow.items.length > 0 && (
        <section aria-labelledby="live-now" className="grid gap-3">
          <h2 id="live-now" className="flex items-center gap-2 text-lg font-semibold text-brand-ink">
            <Radio className="size-5 text-destructive" aria-hidden /> Live now
          </h2>
          <ul className="grid gap-3">
            {liveNow.items.map((s) => (
              <SessionRow key={s.id} s={s} />
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Session views" className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <Link
            key={t}
            href={t === "upcoming" ? "/portal/live" : `/portal/live?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              t === tab ? "border-brand-green text-brand-ink" : "border-transparent text-muted-foreground hover:text-brand-ink",
            )}
          >
            {TAB_LABEL[t]}
            {tabCount[t] !== undefined && <span className="ml-1.5 text-xs text-muted-foreground">({tabCount[t]})</span>}
          </Link>
        ))}
      </nav>

      {tab === "manage" && (
        <Notice title="Broadcast management">
          Includes every session visible to you plus sessions you created in any status, including cancelled ones. Changes are
          audited.
        </Notice>
      )}

      {list.items.length === 0 ? (
        <EmptyState icon={tab === "recordings" ? Video : CalendarClock} title={EMPTY[tab].title} description={EMPTY[tab].description} />
      ) : (
        <ul className="grid gap-3">
          {list.items.map((s) => (
            <SessionRow key={s.id} s={s} />
          ))}
        </ul>
      )}
      <Pager basePath="/portal/live" params={{ tab: tab === "upcoming" ? undefined : tab }} cursor={cursor} nextCursor={list.nextCursor} label="sessions" />
    </div>
  );
}

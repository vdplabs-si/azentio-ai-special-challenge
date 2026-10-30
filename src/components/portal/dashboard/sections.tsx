import Link from "next/link";
import { format, formatDistanceStrict } from "date-fns";
import {
  Beaker, BookOpen, Building2, CircleUser, FlaskConical, Lightbulb, Radio, ShieldCheck, Sparkles, Trophy,
} from "lucide-react";
import type { DashboardData } from "@/server/services/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DueBadge, Meter, Panel, PanelEmpty, PriorityBadge, RankedBars, enumLabel } from "@/components/portal/dashboard/widgets";

const fmtDate = (d: Date) => format(d, "d MMM yyyy");
const fmtDateTime = (d: Date) => format(d, "d MMM yyyy, HH:mm");
const ago = (d: Date, now: Date) => `${formatDistanceStrict(d, now)} ago`;

// ── Shared (both personas) ────────────────────────────────────────────────

export function TasksPanel({ data }: { data: DashboardData }) {
  const { tasks } = data;
  return (
    <Panel
      title="My open tasks"
      description={`${tasks.openCount} open · ${tasks.overdueCount} overdue · ${tasks.dueSoonCount} due in 7 days — overdue first, then by priority`}
      href="/portal/tasks"
    >
      {tasks.items.length === 0 ? (
        <PanelEmpty>No open tasks are assigned to you in projects you can see.</PanelEmpty>
      ) : (
        <ul className="divide-y">
          {tasks.items.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <Link href={`/portal/projects/${t.project.id}?tab=tasks&task=${t.id}`} className="font-medium text-brand-ink hover:underline">
                  {t.title}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {t.project.name} · {enumLabel(t.status)}
                  {t.dueAt ? ` · due ${fmtDate(t.dueAt)}` : " · no due date"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <DueBadge overdue={t.overdue} dueSoon={t.dueSoon} />
                <PriorityBadge priority={t.priority} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {tasks.openCount > tasks.items.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          Showing {tasks.items.length} of {tasks.openCount}.{" "}
          <Link href="/portal/tasks" className="font-medium text-brand-navy hover:underline">
            See all tasks
          </Link>
        </p>
      )}
    </Panel>
  );
}

export function ProjectsPanel({ data }: { data: DashboardData }) {
  const { projects } = data;
  return (
    <Panel title="Active projects" description={`${projects.count} active, planning or on hold · progress = tasks done / total`} href="/portal/projects">
      {projects.items.length === 0 ? (
        <PanelEmpty>No active projects are visible to you yet.</PanelEmpty>
      ) : (
        <ul className="grid gap-4">
          {projects.items.map((p) => (
            <li key={p.id} className="grid gap-1.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <Link href={`/portal/projects/${p.id}`} className="font-medium text-brand-ink hover:underline">
                  {p.name}
                </Link>
                <span className="text-xs text-muted-foreground">
                  {p.organisationName} · {enumLabel(p.status)}
                  {p.dueAt ? ` · due ${fmtDate(p.dueAt)}` : ""}
                </span>
              </div>
              <Meter value={p.done} max={p.total} label={`${p.name} task progress`} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function PendingPanel({ data }: { data: DashboardData }) {
  return (
    <Panel title="Pending actions">
      {data.pending.length === 0 ? (
        <PanelEmpty>Nothing needs your attention right now.</PanelEmpty>
      ) : (
        <ul className="grid gap-2">
          {data.pending.map((p) => (
            <li key={p.key}>
              <Link
                href={p.href}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:border-brand-green/60 hover:bg-brand-light"
              >
                <span className="text-brand-ink">{p.label}</span>
                <Badge variant={p.tone === "warning" ? "outline" : "secondary"} className={p.tone === "warning" ? "border-warning/50 text-warning" : ""}>
                  {p.count}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data.returned.items.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Returned for amendment</p>
          <ul className="mt-1 grid gap-1">
            {data.returned.items.map((o) => (
              <li key={o.id} className="text-sm">
                <Link href={`/portal/observations/${o.id}`} className="text-brand-navy hover:underline">
                  {o.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export function ActivityPanel({ data }: { data: DashboardData }) {
  return (
    <Panel title="Recent activity" description="Your actions and collaboration updates in your workspaces (last 10)">
      {data.activity.length === 0 ? (
        <PanelEmpty>No recorded activity yet. Actions you and your colleagues take in projects will appear here.</PanelEmpty>
      ) : (
        <ol className="grid gap-2.5">
          {data.activity.map((a) => (
            <li key={a.id} className="flex items-start gap-3 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-green" aria-hidden />
              <p className="min-w-0 flex-1 text-brand-ink">
                <span className="font-medium">{a.actorName}</span> {a.verb} {a.entityLabel}
                {a.entityName &&
                  (a.href ? (
                    <>
                      {" "}
                      <Link href={a.href} className="text-brand-navy hover:underline">
                        {a.entityName}
                      </Link>
                    </>
                  ) : (
                    <> {a.entityName}</>
                  ))}
              </p>
              <time dateTime={a.createdAt.toISOString()} className="shrink-0 text-xs text-muted-foreground" title={fmtDateTime(a.createdAt)}>
                {ago(a.createdAt, data.now)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

export function ProfileCard({
  name,
  email,
  title,
  organisation,
  orgRole,
  roles,
}: {
  name: string;
  email: string;
  title: string | null;
  organisation: { name: string; type: "INTERNAL" | "CLIENT" } | null;
  orgRole: string | null;
  roles: string[];
}) {
  return (
    <Panel title="Your profile" href="/portal/profile" hrefLabel="Edit profile">
      <div className="flex items-start gap-3">
        <CircleUser className="mt-0.5 size-8 text-brand-muted" aria-hidden />
        <div className="min-w-0 text-sm">
          <p className="font-medium text-brand-ink">{name}</p>
          {title && <p className="text-muted-foreground">{title}</p>}
          <p className="truncate text-xs text-muted-foreground">{email}</p>
        </div>
      </div>
      {organisation && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <Building2 className="size-3.5 text-brand-muted" aria-hidden />
          <span className="text-brand-ink">{organisation.name}</span>
          <Badge variant="secondary">{organisation.type === "INTERNAL" ? "Internal" : "Client"}</Badge>
          {orgRole && <Badge variant="outline">{enumLabel(orgRole)}</Badge>}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {roles.length === 0 ? (
          <span className="text-xs text-muted-foreground">No platform roles</span>
        ) : (
          roles.map((r) => (
            <Badge key={r} variant="outline">
              {enumLabel(r)}
            </Badge>
          ))
        )}
      </div>
    </Panel>
  );
}

export function SessionsPanel({ data, title }: { data: DashboardData; title: string }) {
  return (
    <Panel title={title} href="/portal/live">
      {data.upcomingSessions.length === 0 ? (
        <PanelEmpty>No live or upcoming sessions are scheduled for your audience.</PanelEmpty>
      ) : (
        <ul className="grid gap-2.5">
          {data.upcomingSessions.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <Link href={`/portal/live/${s.id}`} className="font-medium text-brand-ink hover:underline">
                  {s.title}
                </Link>
                <p className="text-xs text-muted-foreground">{fmtDateTime(s.startsAt)}</p>
              </div>
              {s.status === "LIVE" ? (
                <Badge className="gap-1 bg-success text-white">
                  <Radio aria-hidden /> Live now
                </Badge>
              ) : (
                <Badge variant="outline">{s.audience === "EMPLOYEE" ? "Internal" : "Scheduled"}</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function ContributionsPanel({ data }: { data: DashboardData }) {
  const total = data.contributions.reduce((s, c) => s + c.count, 0);
  return (
    <Panel title="My contributions" description={`${total} observation${total === 1 ? "" : "s"} by status`} href="/portal/observations">
      {total === 0 ? (
        <PanelEmpty>
          You have not recorded any observations yet.{" "}
          <Link href="/portal/observations/new" className="font-medium text-brand-navy hover:underline">
            Record one
          </Link>
        </PanelEmpty>
      ) : (
        <RankedBars
          label="My contributions by status"
          rows={data.contributions.map((c) => ({ key: c.status, label: enumLabel(c.status), value: c.count }))}
        />
      )}
    </Panel>
  );
}

// ── Employee view ─────────────────────────────────────────────────────────

function QuickLink({ href, icon: Icon, title, detail }: { href: string; icon: typeof FlaskConical; title: string; detail: string }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-brand-green/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-brand-ink">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </Link>
  );
}

export function EmployeeQuickLinks({ data }: { data: DashboardData }) {
  const e = data.employee!;
  return (
    <section aria-label="Employee quick links" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <QuickLink
        href="/portal/playground"
        icon={FlaskConical}
        title="Playground"
        detail={`${data.scenarios.count} scenario${data.scenarios.count === 1 ? "" : "s"} incl. internal prototypes`}
      />
      <QuickLink href="/portal/live" icon={Radio} title="Internal live sessions" detail={`${e.internalSessions} live or upcoming for employees`} />
      <QuickLink
        href="/portal/experiments?mine=1"
        icon={Beaker}
        title="Experiments"
        detail={e.experimentTotal ? `${e.experimentTotal} submitted by you` : "Submit an experiment idea"}
      />
      <QuickLink href="/portal/knowledge" icon={BookOpen} title="Knowledge & releases" detail="Internal library and release notes" />
    </section>
  );
}

export function AssignedIdeasPanel({ data }: { data: DashboardData }) {
  const e = data.employee!;
  return (
    <Panel title="Improvement ideas assigned to you" description={`${e.assignedIdeaCount} open`} href="/portal/ideas">
      {e.assignedIdeas.length === 0 ? (
        <PanelEmpty>No open improvement ideas are assigned to you.</PanelEmpty>
      ) : (
        <ul className="grid gap-2.5">
          {e.assignedIdeas.map((i) => (
            <li key={i.id} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <Link href={`/portal/ideas/${i.id}`} className="font-medium text-brand-ink hover:underline">
                  <Lightbulb className="mr-1 inline size-3.5 text-success" aria-hidden />
                  {i.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {i.offering.name} · updated {fmtDate(i.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <Badge variant="secondary">{enumLabel(i.status)}</Badge>
                <PriorityBadge priority={i.priority} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function LearningWorkPanel({ data }: { data: DashboardData }) {
  const m = data.employee?.moderation ?? null;
  return (
    <Panel title="Collective learning" href="/portal/learning" hrefLabel="Shared learning">
      <div className="grid gap-3 text-sm">
        {m ? (
          <Link href="/portal/moderation" className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 hover:bg-brand-light">
            <span className="flex items-center gap-2 text-brand-ink">
              <ShieldCheck className="size-4 text-success" aria-hidden /> Moderation backlog
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {m.submitted} submitted · {m.openReports} open report{m.openReports === 1 ? "" : "s"}
            </span>
          </Link>
        ) : null}
        <Link href="/portal/aira" className="flex items-center gap-2 rounded-md border px-3 py-2 text-brand-ink hover:bg-brand-light">
          <Sparkles className="size-4 text-success" aria-hidden /> Ask AIRA about approved contributions
        </Link>
        <Link href="/portal/themes" className="flex items-center gap-2 rounded-md border px-3 py-2 text-brand-ink hover:bg-brand-light">
          <Lightbulb className="size-4 text-success" aria-hidden /> Themes and improvement ideas
        </Link>
      </div>
    </Panel>
  );
}

export function HackathonPanel({ data }: { data: DashboardData }) {
  const h = data.employee!.hackathon;
  return (
    <Panel title="Hackathon teams" description={`${h.count} active team${h.count === 1 ? "" : "s"} you can see`} href="/portal/hackathon">
      {h.items.length === 0 ? (
        <PanelEmpty>You are not part of an active hackathon team.</PanelEmpty>
      ) : (
        <ul className="grid gap-3">
          {h.items.map((p) => (
            <li key={p.id} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <Link href={`/portal/projects/${p.id}`} className="font-medium text-brand-ink hover:underline">
                  <Trophy className="mr-1 inline size-3.5 text-success" aria-hidden />
                  {p.name}
                </Link>
                {p.eventName && <span className="truncate text-xs text-muted-foreground">{p.eventName}</span>}
              </div>
              <Meter value={p.done} max={p.total} label={`${p.name} task progress`} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ── Client view ───────────────────────────────────────────────────────────

export function EntitlementsPanel({ data, organisationName }: { data: DashboardData; organisationName: string | null }) {
  const offerings = data.client?.offerings ?? [];
  return (
    <Panel title="Entitled offerings" description={organisationName ? `Enabled for ${organisationName} by Azentio` : undefined}>
      {offerings.length === 0 ? (
        <PanelEmpty>
          Your active workspace has no product entitlements yet. Entitlements are enabled by Azentio administrators — contact your
          account team to request access.
        </PanelEmpty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {offerings.map((o) => (
            <li key={o.id} className="rounded-md border p-3">
              <p className="text-sm font-medium text-brand-ink">{o.name}</p>
              <p className="text-xs text-muted-foreground">{o.category}</p>
              <p className="mt-1 text-xs text-brand-ink/80">{o.summary}</p>
              <p className="mt-2 text-xs text-muted-foreground">{o.expiresAt ? `Entitled until ${fmtDate(o.expiresAt)}` : "No expiry set"}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function DemonstrationsPanel({ data }: { data: DashboardData }) {
  const { scenarios } = data;
  return (
    <Panel title="Product demonstrations" description="Guided scenarios on synthetic data that your workspace can run" href="/portal/playground">
      {scenarios.items.length === 0 ? (
        <PanelEmpty>No demonstrations are available for your workspace&apos;s entitlements yet.</PanelEmpty>
      ) : (
        <ul className="grid gap-2">
          {scenarios.items.map((s) => (
            <li key={s.slug} className="flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-brand-ink">{s.name}</p>
                <p className="truncate text-xs text-muted-foreground">{s.offering.name}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/portal/playground/${s.slug}`}>Open</Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
      {scenarios.count > scenarios.items.length && (
        <p className="mt-2 text-xs text-muted-foreground">
          {scenarios.count - scenarios.items.length} more in the Playground.
        </p>
      )}
    </Panel>
  );
}

export function ClientIdeasPanel({ data }: { data: DashboardData }) {
  const ideas = data.client?.ideas ?? [];
  return (
    <Panel title="Improvement ideas — latest updates" description="Ideas Azentio has shared with participants" href="/portal/ideas">
      {ideas.length === 0 ? (
        <PanelEmpty>No improvement ideas have been shared with participants yet.</PanelEmpty>
      ) : (
        <ul className="grid gap-3">
          {ideas.map((i) => (
            <li key={i.id} className="text-sm">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/portal/ideas/${i.id}`} className="font-medium text-brand-ink hover:underline">
                  {i.title}
                </Link>
                <Badge variant="secondary" className="shrink-0">
                  {enumLabel(i.status)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {i.offering.name} · updated {fmtDate(i.updatedAt)}
              </p>
              {i.publicStatusNote && <p className="mt-1 whitespace-pre-wrap text-xs text-brand-ink/80">{i.publicStatusNote}</p>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

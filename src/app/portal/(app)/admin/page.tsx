import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Inbox, Network, ScrollText, Users } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import { adminOverview } from "@/server/services/admin";
import { Notice, PageHeader, StatTile } from "@/components/portal/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Administration" };

function Share({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="grid gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-brand-ink">
          {value} <span className="text-muted-foreground">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const SECTIONS = [
  { href: "/portal/admin/users", label: "Users & roles", body: "Directory, account status and explicit platform grants.", icon: Users },
  { href: "/portal/admin/organisations", label: "Organisations", body: "Workspaces, entitlements, employee approvals and support access.", icon: Network },
  { href: "/portal/admin/inquiries", label: "Inquiries", body: "Demo requests, hackathon registrations and events.", icon: Inbox },
  { href: "/portal/admin/audit", label: "Audit log", body: "Every privileged action, filterable and paginated.", icon: ScrollText },
];

export default async function AdminOverviewPage() {
  const actor = await requireUser();
  if (!can.manageUsers(actor)) {
    if (can.publishContent(actor)) redirect("/portal/admin/content");
    notFound();
  }
  const o = await adminOverview(actor);
  const totalUsers = o.users.active + o.users.deactivated;
  const totalOrgs = o.organisations.internal + o.organisations.client;

  return (
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Administration"
        title="Platform overview"
        description="Live counts from the database. Administrator access covers organisations, role grants, configuration and operational controls — private client content additionally requires an explicit, time-boxed support-access grant."
      />

      <section aria-labelledby="queue-heading" className="grid gap-3">
        <h2 id="queue-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Needs attention
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Employee approvals" value={o.pendingApprovals} hint="Pending internal memberships" href="/portal/admin/organisations?tab=approvals" />
          <StatTile label="Open demo requests" value={o.openDemoRequests} hint="New or in progress" href="/portal/admin/inquiries?tab=demo" />
          <StatTile label="Open hackathon registrations" value={o.openHackathonRegistrations} hint="New or in progress" href="/portal/admin/inquiries?tab=hackathon" />
          <StatTile
            label="Moderation backlog"
            value={o.moderationBacklog.submitted + o.moderationBacklog.openReports}
            hint={`${o.moderationBacklog.submitted} submitted · ${o.moderationBacklog.openReports} open reports (count only)`}
          />
        </div>
      </section>

      <section aria-labelledby="security-heading" className="grid gap-3">
        <h2 id="security-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Security & accountability
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Audit events (24h)" value={o.auditLast24h} href="/portal/admin/audit" />
          <StatTile label="Active support access" value={o.activeSupportGrants} hint="Unexpired, unrevoked grants" href="/portal/admin/organisations?tab=support" />
          <StatTile label="Administrator grants" value={o.activeAdminGrants} hint="Active super/portal admin grants" href="/portal/admin/users" />
          <StatTile label="Suspended organisations" value={o.organisations.suspended} href="/portal/admin/organisations?status=SUSPENDED" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="grid gap-4 rounded-lg border bg-card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-brand-ink">Users</h2>
            <span className="text-sm text-muted-foreground">{totalUsers} total</span>
          </div>
          <Share label="Active" value={o.users.active} total={totalUsers} tone="bg-success" />
          <Share label="Deactivated" value={o.users.deactivated} total={totalUsers} tone="bg-destructive" />
        </div>
        <div className="grid gap-4 rounded-lg border bg-card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold text-brand-ink">Organisations by type</h2>
            <span className="text-sm text-muted-foreground">{totalOrgs} total</span>
          </div>
          <Share label="Client workspaces" value={o.organisations.client} total={totalOrgs} tone="bg-brand-navy" />
          <Share label="Internal (Azentio)" value={o.organisations.internal} total={totalOrgs} tone="bg-brand-green" />
        </div>
      </section>

      <section aria-labelledby="sections-heading" className="grid gap-3">
        <h2 id="sections-heading" className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Administration areas
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-start gap-4 rounded-lg border bg-card p-4 transition-colors hover:border-brand-green/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <s.icon className="mt-0.5 size-5 text-brand-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-brand-ink">{s.label}</p>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </div>
      </section>

      {can.publishContent(actor) && (
        <Notice title="Website content">
          You also hold the content publisher role. Manage banners, media and public insights in{" "}
          <Link href="/portal/admin/content" className="font-medium underline underline-offset-2">
            Website content
          </Link>
          .
        </Notice>
      )}
    </div>
  );
}

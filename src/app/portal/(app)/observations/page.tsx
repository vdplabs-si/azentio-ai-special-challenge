import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, NotebookPen, Plus, Users } from "lucide-react";
import { canContributeInOrg } from "@/lib/authz/permissions";
import { cn } from "@/lib/utils";
import { learningPageActor } from "@/server/learning/guard";
import { OBSERVATION_TYPE_LABELS } from "@/server/learning/labels";
import {
  countOrgObservations,
  listMyObservations,
  listOrgObservations,
  myStatusCounts,
  type ObservationListItem,
} from "@/server/services/observations";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, StatTile } from "@/components/portal/page";
import { ObservationStatusBadge, PrivateBadge } from "@/components/portal/learning/badges";
import { formatDate } from "@/components/portal/learning/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Observations" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function ObservationRow({ item, showAuthor }: { item: ObservationListItem; showAuthor: boolean }) {
  return (
    <li className="rounded-lg border border-l-4 border-l-brand-navy bg-card p-4 transition-colors hover:border-brand-navy/40">
      <div className="flex flex-wrap items-center gap-2">
        <ObservationStatusBadge status={item.status} />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{OBSERVATION_TYPE_LABELS[item.type]}</span>
        {item.orgVisible && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" aria-hidden /> Visible in organisation
          </span>
        )}
        {item.sensitiveFlagCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="size-3.5" aria-hidden /> {item.sensitiveFlagCount} scan warning{item.sensitiveFlagCount === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <h3 className="mt-1.5 font-semibold text-brand-ink">
        <Link href={`/portal/observations/${item.id}`} className="hover:underline focus-visible:underline focus-visible:outline-none">
          {item.title}
        </Link>
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {showAuthor && <>{item.authorName} · </>}
        {item.region}
        {item.offering && <> · {item.offering}</>} · v{item.version} · updated {formatDate(item.updatedAt)}
      </p>
    </li>
  );
}

export default async function ObservationsPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await learningPageActor();
  const sp = await searchParams;
  const tab = sp.tab === "org" ? "org" : "mine";
  const cursor = typeof sp.cursor === "string" && sp.cursor.length <= 64 ? sp.cursor : undefined;
  const page = { cursor, limit: 25 };
  const org = actor.activeOrganisation;
  const orgName = org?.organisation.name ?? "your organisation";
  const canCreate = Boolean(org && canContributeInOrg(actor, org.organisationId));

  const [counts, orgCount, list] = await Promise.all([
    myStatusCounts(actor),
    countOrgObservations(actor),
    tab === "org" ? listOrgObservations(actor, page) : listMyObservations(actor, page),
  ]);
  const total = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);
  const c = (k: keyof typeof counts) => counts[k] ?? 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={orgName}
        title="Observations"
        description="Your private contributions and the observations your colleagues chose to share within your organisation. Nothing here is visible to other organisations."
        actions={
          <>
            <PrivateBadge />
            {canCreate && (
              <Button asChild>
                <Link href="/portal/observations/new">
                  <Plus aria-hidden /> New observation
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Private drafts" value={c("DRAFT")} />
        <StatTile label="In review" value={c("SUBMITTED")} hint="Awaiting a moderator" />
        <StatTile label="Clarification requested" value={c("RETURNED")} />
        <StatTile label="Published" value={c("PUBLISHED")} hint="Reviewed shared copy live" />
        <StatTile label="Closed" value={c("REJECTED") + c("SUSPENDED") + c("WITHDRAWN")} hint="Not published, suspended or withdrawn" />
      </div>

      <nav aria-label="Observation lists" className="flex gap-1 border-b">
        {(
          [
            ["mine", "My observations", total],
            ["org", "Our organisation's observations", orgCount],
          ] as const
        ).map(([key, label, n]) => (
          <Link
            key={key}
            href={key === "org" ? "/portal/observations?tab=org" : "/portal/observations"}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === key ? "border-brand-navy text-brand-ink" : "border-transparent text-muted-foreground hover:text-brand-ink",
            )}
          >
            {label} <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">{n}</span>
          </Link>
        ))}
      </nav>

      {tab === "org" && (
        <p className="text-sm text-muted-foreground">
          Read-only observations that members of {orgName} explicitly chose to make visible within the organisation. These are not moderated and
          are never shown to other organisations.
        </p>
      )}

      {list.items.length === 0 ? (
        tab === "org" ? (
          <EmptyState
            icon={Users}
            title="No observations shared within your organisation yet"
            description="When a colleague chooses “Within my organisation”, their observation appears here for you to read."
          />
        ) : (
          <EmptyState
            icon={NotebookPen}
            title="You haven't recorded any observations yet"
            description="Capture a market observation, trend, product gap or practice. It stays a private draft until you choose otherwise."
            action={
              canCreate ? (
                <Button asChild>
                  <Link href="/portal/observations/new">New observation</Link>
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <>
          <ul className="grid gap-3">
            {list.items.map((item) => (
              <ObservationRow key={item.id} item={item} showAuthor={tab === "org"} />
            ))}
          </ul>
          <div className="flex justify-between">
            {cursor ? (
              <Button asChild variant="outline" size="sm">
                <Link href={tab === "org" ? "/portal/observations?tab=org" : "/portal/observations"}>Back to first page</Link>
              </Button>
            ) : (
              <span />
            )}
            {list.nextCursor && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/portal/observations?${new URLSearchParams({ ...(tab === "org" ? { tab: "org" } : {}), cursor: list.nextCursor })}`}>
                  Next page
                </Link>
              </Button>
            )}
          </div>
        </>
      )}

      {!canCreate && (
        <p className="text-xs text-muted-foreground">
          Your role in {orgName} is read-only, so you can&apos;t create observations here. Ask a workspace administrator if you need contributor access.
        </p>
      )}
    </div>
  );
}

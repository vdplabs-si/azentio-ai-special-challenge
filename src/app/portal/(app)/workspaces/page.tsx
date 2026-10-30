import Link from "next/link";
import type { Metadata } from "next";
import { Building2, FolderKanban, Users } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { isPortalAdmin } from "@/lib/authz/permissions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { FilterBar } from "@/components/portal/collab/filter-bar";
import { NewWorkspaceDialog } from "@/components/portal/collab/workspace-actions";
import { CursorPager, ToneBadge } from "@/components/portal/collab/ui";
import { MEMBERSHIP_ROLE_LABEL, ORG_TYPE_LABEL } from "@/components/portal/collab/labels";
import { workspaceListQuery } from "@/components/portal/collab/schemas";
import { hrefWith, param, type SearchParamsRecord } from "@/components/portal/collab/url";
import { listWorkspaces } from "@/server/services/workspaces";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Workspaces" };

export default async function WorkspacesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  const actor = await requireUser();
  const sp = await searchParams;
  const parsed = workspaceListQuery.safeParse({ q: param(sp, "q") || undefined, cursor: param(sp, "cursor") || undefined, limit: 24 });
  const query = parsed.success ? parsed.data : { limit: 24 };
  const page = await listWorkspaces(actor, query);
  const admin = isPortalAdmin(actor);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Collaboration"
        title="Workspaces"
        description={
          admin
            ? "Every client workspace on the portal. As a portal administrator you see workspace metadata; project content stays private to each workspace's members."
            : "The workspaces you belong to. Each workspace's projects, documents and discussions are isolated from every other organisation."
        }
        actions={admin ? <NewWorkspaceDialog /> : undefined}
      />
      <FilterBar filters={[]} searchPlaceholder="Search workspaces" />
      {page.items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={query.q ? "No workspaces match your search" : "No workspaces yet"}
          description={admin ? "Create a client workspace to get started." : "Ask your administrator for an invitation."}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {page.items.map((w) => (
            <li key={w.id}>
              <Link href={`/portal/workspaces/${w.id}`} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Card className="h-full transition-colors hover:ring-brand-green/60">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-brand-ink">{w.name}</CardTitle>
                      <ToneBadge tone={w.type === "INTERNAL" ? "info" : "brand"}>{w.type === "INTERNAL" ? "Internal" : "Client"}</ToneBadge>
                    </div>
                    <CardDescription>
                      {[w.industry, w.region].filter(Boolean).join(" · ") || ORG_TYPE_LABEL[w.type]}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {w.description && <p className="line-clamp-2 text-sm text-muted-foreground">{w.description}</p>}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-4" aria-hidden /> {w.memberCount} {w.memberCount === 1 ? "member" : "members"}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <FolderKanban className="size-4" aria-hidden />
                        {w.activeProjectCount === null ? "Projects private" : `${w.activeProjectCount} active ${w.activeProjectCount === 1 ? "project" : "projects"}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {w.myRole ? (
                        <ToneBadge tone="neutral">Your role: {MEMBERSHIP_ROLE_LABEL[w.myRole]}</ToneBadge>
                      ) : (
                        <ToneBadge tone="neutral">Not a member</ToneBadge>
                      )}
                      {w.status === "SUSPENDED" && <ToneBadge tone="warning">Suspended</ToneBadge>}
                      {actor.activeOrganisation?.organisationId === w.id && <ToneBadge tone="success">Active workspace</ToneBadge>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {admin && (
        <Notice title="Tenant isolation">
          Portal administrators can manage membership and support for any workspace, but cannot read a client&apos;s private
          projects, documents or announcements without being a member or holding an explicit support-access grant.
        </Notice>
      )}
      <CursorPager
        isFirstPage={!query.cursor}
        firstHref={hrefWith("/portal/workspaces", sp, { cursor: undefined })}
        nextHref={page.nextCursor ? hrefWith("/portal/workspaces", sp, { cursor: page.nextCursor }) : null}
      />
    </div>
  );
}

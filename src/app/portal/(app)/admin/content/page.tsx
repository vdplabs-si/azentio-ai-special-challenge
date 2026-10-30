import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileText, Film, Megaphone } from "lucide-react";
import type { AuthedActor } from "@/lib/authz/actor";
import { requireUser } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import { contentListQuery, listBanners, listInsights, listMedia } from "@/server/services/content-admin";
import { EmptyState, PageHeader } from "@/components/portal/page";
import { Pager } from "@/components/portal/dashboard/pager";
import { StatusBadge } from "@/components/portal/admin/status-badge";
import { TabNav } from "@/components/portal/admin/tab-nav";
import { flatParams, fmtDate, fmtDateTime } from "@/components/portal/admin/format";
import { ApiDeleteButton, BannerDialog, InsightDialog, MediaDialog } from "@/components/portal/admin/content-actions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Website content" };

const TABS = ["banners", "media", "insights"] as const;
type Tab = (typeof TABS)[number];

const AUDIENCE_LABEL: Record<string, string> = {
  PUBLIC: "Public",
  EMPLOYEE: "Employees",
  CLIENT_ALL: "All clients",
  CLIENT_ORGS: "Selected clients",
};

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireUser();
  if (!can.publishContent(actor)) notFound();
  const params = flatParams(await searchParams);
  const tab: Tab = (TABS as readonly string[]).includes(params.tab ?? "") ? (params.tab as Tab) : "banners";
  const parsed = contentListQuery.safeParse({ cursor: params.cursor });
  const page = parsed.success ? parsed.data : contentListQuery.parse({});

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Content publishing"
        title="Website content"
        description="Homepage banners, video assets and public insight articles. Publishing rights cover website content and permitted video audiences only — not identity administration or private learning content. Every change is audited."
      />
      <TabNav
        basePath="/portal/admin/content"
        current={tab}
        tabs={[
          { key: "banners", label: "Banners" },
          { key: "media", label: "Media" },
          { key: "insights", label: "Insights" },
        ]}
      />
      {tab === "banners" && <BannersTab actor={actor} page={page} />}
      {tab === "media" && <MediaTab actor={actor} page={page} />}
      {tab === "insights" && <InsightsTab actor={actor} page={page} />}
    </div>
  );
}

type PageQuery = ReturnType<typeof contentListQuery.parse>;

async function BannersTab({ actor, page }: { actor: AuthedActor; page: PageQuery }) {
  const res = await listBanners(actor, page);
  const now = new Date();
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <BannerDialog />
      </div>
      {res.items.length === 0 ? (
        <EmptyState icon={Megaphone} title="No banners" description="Create a banner to announce events or releases on the homepage." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Message</TableHead>
                <TableHead>Link</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {res.items.map((b) => {
                const inWindow = (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt > now);
                const live = b.active && inWindow;
                return (
                  <TableRow key={b.id} className="align-top">
                    <TableCell className="max-w-96 whitespace-pre-wrap">
                      {b.message}
                      <p className="mt-1 text-[0.7rem] text-muted-foreground">
                        By {b.createdBy.name} · updated {fmtDate(b.updatedAt)}
                      </p>
                    </TableCell>
                    <TableCell className="max-w-48 whitespace-normal text-xs">
                      {b.linkHref ? (
                        <>
                          <p className="font-medium">{b.linkLabel ?? "Learn more"}</p>
                          <p className="break-all text-muted-foreground">{b.linkHref}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No link</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {b.startsAt || b.endsAt ? (
                        <>
                          <p>From {fmtDateTime(b.startsAt)}</p>
                          <p>Until {fmtDateTime(b.endsAt)}</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No window</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        tone={live ? "success" : b.active ? "warning" : "neutral"}
                        label={live ? "Live now" : b.active ? "Active, outside window" : "Inactive"}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-end gap-2">
                        <BannerDialog banner={b} />
                        <ApiDeleteButton
                          path={`/api/v1/admin/banners/${b.id}`}
                          title="Delete this banner?"
                          description="The banner is removed from the homepage and cannot be restored. The deletion is audited."
                          success="Banner deleted"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager basePath="/portal/admin/content" params={{ tab: "banners" }} cursor={page.cursor} nextCursor={res.nextCursor} label="banners" />
    </div>
  );
}

async function MediaTab({ actor, page }: { actor: AuthedActor; page: PageQuery }) {
  const res = await listMedia(actor, page);
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <MediaDialog />
      </div>
      {res.items.length === 0 ? (
        <EmptyState icon={Film} title="No media assets" description="Add product walkthroughs or event recordings and choose who can see them." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Video URL</TableHead>
                <TableHead>Audience</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {res.items.map((m) => (
                <TableRow key={m.id} className="align-top">
                  <TableCell className="max-w-80 whitespace-normal">
                    <p className="font-medium text-brand-ink">{m.title}</p>
                    {m.description && <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">{m.description}</p>}
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      By {m.createdBy.name} · updated {fmtDate(m.updatedAt)}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-56 whitespace-normal text-xs">
                    <a href={m.url} target="_blank" rel="noopener noreferrer" className="break-all text-brand-navy underline-offset-2 hover:underline">
                      {m.url}
                    </a>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={m.audience === "PUBLIC" ? "info" : "warning"} label={AUDIENCE_LABEL[m.audience] ?? m.audience} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={m.published ? "success" : "neutral"} label={m.published ? "Published" : "Unpublished"} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-end gap-2">
                      <MediaDialog media={m} />
                      <ApiDeleteButton
                        path={`/api/v1/admin/media/${m.id}`}
                        title="Delete this media asset?"
                        description="The asset is removed from every page that lists it. The deletion is audited."
                        success="Media deleted"
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager basePath="/portal/admin/content" params={{ tab: "media" }} cursor={page.cursor} nextCursor={res.nextCursor} label="media" />
    </div>
  );
}

async function InsightsTab({ actor, page }: { actor: AuthedActor; page: PageQuery }) {
  const res = await listInsights(actor, page);
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <InsightDialog />
      </div>
      {res.items.length === 0 ? (
        <EmptyState icon={FileText} title="No insights" description="Public insight articles you write here appear on the website once published." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insight</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Published</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {res.items.map((i) => (
                <TableRow key={i.id} className="align-top">
                  <TableCell className="max-w-96 whitespace-normal">
                    <p className="font-medium text-brand-ink">{i.title}</p>
                    <p className="text-xs text-muted-foreground">/{i.slug}</p>
                    <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{i.summary}</p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={i.status} />
                  </TableCell>
                  <TableCell className="text-xs">{fmtDate(i.publishedAt)}</TableCell>
                  <TableCell className="text-xs">
                    {fmtDate(i.updatedAt)}
                    <p className="text-muted-foreground">{i.owner.name}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <InsightDialog insight={i} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager basePath="/portal/admin/content" params={{ tab: "insights" }} cursor={page.cursor} nextCursor={res.nextCursor} label="insights" />
    </div>
  );
}

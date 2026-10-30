import Link from "next/link";
import type { Metadata } from "next";
import { BookOpen, Plus } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import { canAuthorContent, LIBRARY_TYPES, listBriefingOrganisations, listContent, type LibraryType } from "@/server/services/knowledge";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { Pager } from "@/components/portal/dashboard/pager";
import { LocalDateTime } from "@/components/portal/live/local-time";
import { NativeSelect } from "@/components/portal/experiments/native-select";
import { ContentFormDialog } from "@/components/portal/knowledge/content-form-dialog";
import { ContentAudienceBadge, ContentStatusBadge, ContentTypeBadge, ReviewOverdueBadge } from "@/components/portal/knowledge/badges";
import { CONTENT_STATUS_LABEL, CONTENT_TYPE_PLURAL } from "@/components/portal/knowledge/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Knowledge & releases" };

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
type Status = (typeof STATUSES)[number];

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string; status?: string; cursor?: string }>;
}) {
  const actor = await requireUser();
  const sp = await searchParams;
  const type = LIBRARY_TYPES.includes(sp.type as LibraryType) ? (sp.type as LibraryType) : undefined;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const author = canAuthorContent(actor);
  const publisher = can.publishContent(actor);
  const status = author && STATUSES.includes(sp.status as Status) ? (sp.status as Status) : undefined;
  const cursor = sp.cursor && sp.cursor.length <= 64 ? sp.cursor : undefined;

  const [page, organisations] = await Promise.all([
    listContent(actor, { type, q, status, cursor, limit: 20 }),
    publisher ? listBriefingOrganisations(actor) : Promise.resolve([]),
  ]);
  const filtered = Boolean(q || status);
  const tabHref = (t?: LibraryType) => {
    const p = new URLSearchParams();
    if (t) p.set("type", t);
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    const s = p.toString();
    return s ? `/portal/knowledge?${s}` : "/portal/knowledge";
  };

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Innovation"
        title="Knowledge & releases"
        description={
          actor.isEmployee
            ? "Internal knowledge library, release notes and client briefings. Each item shows who can see it."
            : "Release notes and briefings shared with your organisation."
        }
        actions={
          author ? (
            <ContentFormDialog
              publisher={publisher}
              isEmployee={actor.isEmployee}
              organisations={organisations}
              trigger={
                <Button>
                  <Plus aria-hidden /> {publisher ? "New item" : "New knowledge article"}
                </Button>
              }
            />
          ) : undefined
        }
      />

      <nav aria-label="Content types" className="flex flex-wrap gap-1 border-b">
        {[undefined, ...LIBRARY_TYPES].map((t) => (
          <Link
            key={t ?? "all"}
            href={tabHref(t)}
            aria-current={t === type ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              t === type ? "border-brand-green text-brand-ink" : "border-transparent text-muted-foreground hover:text-brand-ink",
            )}
          >
            {t ? CONTENT_TYPE_PLURAL[t] : "All"}
          </Link>
        ))}
      </nav>

      <form method="get" role="search" aria-label="Search knowledge and releases" className="flex flex-wrap items-end gap-3">
        {type && <input type="hidden" name="type" value={type} />}
        <div className="grid gap-1">
          <label htmlFor="k-q" className="text-xs font-medium text-muted-foreground">
            Search titles and summaries
          </label>
          <Input id="k-q" name="q" defaultValue={q} className="w-64" />
        </div>
        {author && (
          <div className="grid gap-1">
            <label htmlFor="k-status" className="text-xs font-medium text-muted-foreground">
              Status
            </label>
            <NativeSelect id="k-status" name="status" defaultValue={status ?? ""}>
              <option value="">Any</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {CONTENT_STATUS_LABEL[s]}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {filtered && (
          <Button asChild variant="ghost">
            <Link href={type ? `/portal/knowledge?type=${type}` : "/portal/knowledge"}>Clear</Link>
          </Button>
        )}
      </form>

      {author && (
        <Notice>
          {publisher
            ? "As a content publisher you also see drafts and archived items. Drafts are never visible to their audience until published."
            : "Your own draft and archived knowledge articles are listed alongside published content; only you and content publishers can see them."}
        </Notice>
      )}

      {page.items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={filtered ? "Nothing matches your search" : "Nothing published here yet"}
          description={filtered ? "Try different words or clear the filters." : "Published items for your audience will appear here."}
        />
      ) : (
        <ul className="grid gap-3">
          {page.items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/portal/knowledge/${item.slug}`}
                className="block rounded-lg border bg-card p-4 transition-colors hover:border-brand-green/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <ContentTypeBadge type={item.type} />
                  <ContentStatusBadge status={item.status} />
                  {item.audience && <ContentAudienceBadge audience={item.audience} organisationName={item.organisationName} />}
                  {item.reviewOverdue && <ReviewOverdueBadge />}
                </div>
                <p className="mt-2 font-medium text-brand-ink">{item.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {item.publishedAt ? (
                    <>
                      Published <LocalDateTime value={item.publishedAt} dateOnly />
                    </>
                  ) : (
                    <>
                      Updated <LocalDateTime value={item.updatedAt} dateOnly />
                    </>
                  )}
                  {item.ownerName && item.type === "KNOWLEDGE" && <> · Owner: {item.ownerName}</>}
                  {item.reviewDueAt && (
                    <>
                      {" "}
                      · Review due <LocalDateTime value={item.reviewDueAt} dateOnly />
                    </>
                  )}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pager basePath="/portal/knowledge" params={{ type, q, status }} cursor={cursor} nextCursor={page.nextCursor} label="items" />
    </div>
  );
}

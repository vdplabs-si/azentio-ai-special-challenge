import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, ExternalLink, Pencil, ThumbsDown, ThumbsUp } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import { getContentBySlug, listBriefingOrganisations, type LibraryType } from "@/server/services/knowledge";
import { Notice, PageHeader } from "@/components/portal/page";
import { LocalDateTime } from "@/components/portal/live/local-time";
import { ContentFormDialog } from "@/components/portal/knowledge/content-form-dialog";
import { ContentFeedbackForm } from "@/components/portal/knowledge/feedback-form";
import { ContentAudienceBadge, ContentStatusBadge, ContentTypeBadge, ReviewOverdueBadge } from "@/components/portal/knowledge/badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Knowledge & releases" };

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug || slug.length > 120) notFound();
  const actor = await requireUser();
  const item = await getContentBySlug(actor, slug);
  if (!item) notFound();
  const publisher = can.publishContent(actor);
  const organisations = item.canEdit && publisher ? await listBriefingOrganisations(actor) : [];

  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/portal/knowledge">
            <ArrowLeft aria-hidden /> Knowledge & releases
          </Link>
        </Button>
      </div>
      <PageHeader
        eyebrow={item.type === "KNOWLEDGE" ? "Knowledge library" : item.type === "RELEASE_NOTE" ? "Release note" : item.type === "BRIEFING" ? "Client briefing" : "Insight"}
        title={item.title}
        description={item.summary}
        actions={
          item.canEdit && item.editable && item.type !== "INSIGHT" ? (
            <ContentFormDialog
              publisher={publisher}
              isEmployee={actor.isEmployee}
              organisations={organisations}
              item={{
                id: item.id,
                type: item.type as LibraryType,
                title: item.title,
                slug: item.slug,
                summary: item.summary,
                body: item.body,
                sourceUrl: item.editable.sourceUrl,
                audience: item.editable.audience,
                organisationId: item.editable.organisationId,
                status: item.status,
                reviewDueAt: item.editable.reviewDueAt ? item.editable.reviewDueAt.toISOString() : null,
              }}
              trigger={
                <Button variant="outline">
                  <Pencil aria-hidden /> Edit
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <ContentTypeBadge type={item.type} />
        <ContentStatusBadge status={item.status} />
        {item.audience && <ContentAudienceBadge audience={item.audience} organisationName={item.organisationName} />}
        {item.reviewOverdue && <ReviewOverdueBadge />}
        {item.publishedAt ? (
          <span>
            Published <LocalDateTime value={item.publishedAt} dateOnly />
          </span>
        ) : (
          <span>Not published</span>
        )}
        <span>
          · Updated <LocalDateTime value={item.updatedAt} dateOnly />
        </span>
        {item.ownerName && item.type === "KNOWLEDGE" && <span>· Owner: {item.ownerName}</span>}
        {item.reviewDueAt && (
          <span>
            · Review due <LocalDateTime value={item.reviewDueAt} dateOnly />
          </span>
        )}
      </div>

      {item.status !== "PUBLISHED" && (
        <Notice tone="warning" title={item.status === "DRAFT" ? "Draft" : "Archived"}>
          This item is not visible to its audience. Only its owner and content publishers can see it.
        </Notice>
      )}
      {item.reviewOverdue && item.canEdit && (
        <Notice tone="warning" title="Review overdue">
          The scheduled review date has passed. Check the content is still accurate and set a new review date.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <article className="rounded-lg border bg-card p-5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-brand-ink">{item.body}</p>
          {item.sourceUrl && (
            <p className="mt-6 border-t pt-4 text-sm">
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-brand-ink underline-offset-4 hover:underline">
                Source <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </p>
          )}
        </article>

        <aside className="grid content-start gap-4">
          {item.canGiveFeedback && (
            <Card>
              <CardHeader>
                <CardTitle>Was this helpful?</CardTitle>
                <CardDescription>Your response goes to the content owner.</CardDescription>
              </CardHeader>
              <CardContent>
                <ContentFeedbackForm contentId={item.id} current={item.myFeedback ? { helpful: item.myFeedback.helpful, comment: item.myFeedback.comment } : null} />
              </CardContent>
            </Card>
          )}
          {item.feedbackSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Reader feedback</CardTitle>
                <CardDescription>Visible to the owner and content publishers only.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <div className="flex gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <ThumbsUp className="size-4 text-success" aria-hidden /> {item.feedbackSummary.helpful} helpful
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ThumbsDown className="size-4 text-muted-foreground" aria-hidden /> {item.feedbackSummary.notHelpful} not helpful
                  </span>
                </div>
                {item.feedbackSummary.comments.length > 0 ? (
                  <ul className="grid gap-2">
                    {item.feedbackSummary.comments.map((c) => (
                      <li key={c.id} className="rounded-md border bg-brand-light p-2">
                        <p className="text-xs text-muted-foreground">
                          {c.helpful ? "Helpful" : "Not helpful"} · <LocalDateTime value={c.createdAt} dateOnly />
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap">{c.comment}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No comments yet.</p>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { getExperiment, listOfferingOptions } from "@/server/services/experiments";
import { Notice, PageHeader } from "@/components/portal/page";
import { LocalDateTime } from "@/components/portal/live/local-time";
import { ExperimentFormDialog } from "@/components/portal/experiments/experiment-form-dialog";
import { ExperimentStatusBadge } from "@/components/portal/experiments/status-badge";
import { EXPERIMENT_STATUS_HINT } from "@/components/portal/experiments/labels";
import { ReviewPanel } from "@/components/portal/experiments/review-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Experiment" };

export default async function ExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireUser();
  const e = await getExperiment(actor, id);
  if (!e) notFound();
  const offerings = e.canEdit ? await listOfferingOptions(actor) : [];

  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/portal/experiments">
            <ArrowLeft aria-hidden /> All experiments
          </Link>
        </Button>
      </div>
      <PageHeader
        eyebrow="Experiment"
        title={e.title}
        description={
          <>
            Submitted by {e.isAuthor ? "you" : e.author.name} on <LocalDateTime value={e.createdAt} dateOnly />
            {e.offering && <> · {e.offering.name}</>}
          </>
        }
        actions={
          <>
            <ExperimentStatusBadge status={e.status} />
            {e.canEdit && (
              <ExperimentFormDialog
                offerings={offerings}
                experiment={{ id: e.id, title: e.title, hypothesis: e.hypothesis, approach: e.approach, offeringId: e.offering?.id ?? null }}
                trigger={
                  <Button variant="outline">
                    <Pencil aria-hidden /> Edit
                  </Button>
                }
              />
            )}
          </>
        }
      />

      {e.isAuthor && !e.canEdit && (
        <Notice>This experiment is {e.status === "IN_REVIEW" ? "in review" : "no longer open for edits"}; its content is locked.</Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Hypothesis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{e.hypothesis}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Approach</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{e.approach}</p>
            </CardContent>
          </Card>
        </div>
        <aside className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Review status</CardTitle>
              <CardDescription>{EXPERIMENT_STATUS_HINT[e.status]}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
                <dt>Submitted</dt>
                <dd>
                  <LocalDateTime value={e.createdAt} />
                </dd>
                <dt>Last change</dt>
                <dd>
                  <LocalDateTime value={e.updatedAt} />
                </dd>
              </dl>
              <div>
                <p className="font-medium text-brand-ink">Reviewer feedback</p>
                {e.feedback ? (
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed">{e.feedback}</p>
                ) : (
                  <p className="mt-1 text-muted-foreground">No feedback yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
          {e.canReview && (
            <Card>
              <CardHeader>
                <CardTitle>Review this experiment</CardTitle>
                <CardDescription>Your decision and feedback are audited and the author is notified.</CardDescription>
              </CardHeader>
              <CardContent>
                <ReviewPanel id={e.id} status={e.status} feedback={e.feedback} />
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

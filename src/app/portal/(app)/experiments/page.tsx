import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Beaker, Plus } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import {
  canReviewExperiments,
  EXPERIMENT_STATUSES,
  experimentStatusCounts,
  listExperiments,
  listOfferingOptions,
} from "@/server/services/experiments";
import { EmptyState, Notice, PageHeader, StatTile } from "@/components/portal/page";
import { Pager } from "@/components/portal/dashboard/pager";
import { LocalDateTime } from "@/components/portal/live/local-time";
import { ExperimentFormDialog } from "@/components/portal/experiments/experiment-form-dialog";
import { ExperimentStatusBadge } from "@/components/portal/experiments/status-badge";
import { EXPERIMENT_STATUS_LABEL } from "@/components/portal/experiments/labels";
import { NativeSelect } from "@/components/portal/experiments/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Experiments" };

type Status = (typeof EXPERIMENT_STATUSES)[number];

export default async function ExperimentsPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string; status?: string; offeringId?: string; q?: string; cursor?: string }>;
}) {
  const actor = await requireUser();
  if (!can.accessEmployeeArea(actor)) notFound();
  const sp = await searchParams;
  const status = EXPERIMENT_STATUSES.includes(sp.status as Status) ? (sp.status as Status) : undefined;
  const mine = sp.mine === "1" ? "1" : undefined;
  const q = sp.q?.trim().slice(0, 100) || undefined;
  const offeringId = sp.offeringId && sp.offeringId.length <= 64 ? sp.offeringId : undefined;
  const cursor = sp.cursor && sp.cursor.length <= 64 ? sp.cursor : undefined;

  const [page, counts, offerings] = await Promise.all([
    listExperiments(actor, { mine, status, offeringId, q, cursor, limit: 20 }),
    experimentStatusCounts(actor),
    listOfferingOptions(actor),
  ]);
  const filtered = Boolean(mine || status || offeringId || q);
  const reviewer = canReviewExperiments(actor);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Employee innovation"
        title="Experiments"
        description="Propose and track experiments on Azentio offerings. Reviewers respond with a status and feedback so every idea gets a clear answer."
        actions={
          <ExperimentFormDialog
            offerings={offerings}
            trigger={
              <Button>
                <Plus aria-hidden /> Submit experiment
              </Button>
            }
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {EXPERIMENT_STATUSES.map((s) => (
          <StatTile key={s} label={EXPERIMENT_STATUS_LABEL[s]} value={counts[s]} href={`/portal/experiments?status=${s}`} />
        ))}
        <StatTile label="Submitted by me" value={counts.mine} href="/portal/experiments?mine=1" />
      </div>

      {reviewer && (
        <Notice title="You are a reviewer">
          Open any experiment you did not author to set its status and leave feedback. The author is notified of every review.
        </Notice>
      )}

      <form method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3" role="search" aria-label="Filter experiments">
        <div className="grid gap-1">
          <label htmlFor="f-q" className="text-xs font-medium text-muted-foreground">
            Search
          </label>
          <Input id="f-q" name="q" defaultValue={q} placeholder="Title or hypothesis" className="w-56" />
        </div>
        <div className="grid gap-1">
          <label htmlFor="f-status" className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <NativeSelect id="f-status" name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            {EXPERIMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {EXPERIMENT_STATUS_LABEL[s]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-1">
          <label htmlFor="f-offering" className="text-xs font-medium text-muted-foreground">
            Offering
          </label>
          <NativeSelect id="f-offering" name="offeringId" defaultValue={offeringId ?? ""} className="max-w-60">
            <option value="">All offerings</option>
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <label className="flex h-8 items-center gap-2 text-sm">
          <input type="checkbox" name="mine" value="1" defaultChecked={mine === "1"} className="size-4 accent-brand-navy" /> Only mine
        </label>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {filtered && (
          <Button asChild variant="ghost">
            <Link href="/portal/experiments">Clear filters</Link>
          </Button>
        )}
      </form>

      {page.items.length === 0 ? (
        <EmptyState
          icon={Beaker}
          title={filtered ? "No experiments match these filters" : "No experiments yet"}
          description={filtered ? "Try clearing the filters." : "Be the first to submit an experiment for review."}
        />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Experiment</TableHead>
                <TableHead className="hidden md:table-cell">Offering</TableHead>
                <TableHead className="hidden sm:table-cell">Author</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-md whitespace-normal">
                    <Link href={`/portal/experiments/${e.id}`} className="font-medium text-brand-ink hover:underline">
                      {e.title}
                    </Link>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{e.hypothesis}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{e.offering?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {e.author.name}
                    {e.authorId === actor.user.id && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}
                  </TableCell>
                  <TableCell>
                    <ExperimentStatusBadge status={e.status} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    <LocalDateTime value={e.updatedAt} dateOnly />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager basePath="/portal/experiments" params={{ mine, status, offeringId, q }} cursor={cursor} nextCursor={page.nextCursor} label="experiments" />
    </div>
  );
}

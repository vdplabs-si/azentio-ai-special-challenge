import Link from "next/link";
import type { Metadata } from "next";
import { Lightbulb, Plus } from "lucide-react";
import { IdeaStatus } from "@/generated/prisma/enums";
import { can } from "@/lib/authz/permissions";
import { cn } from "@/lib/utils";
import { learningPageActor } from "@/server/learning/guard";
import { listIdeas, type ClientIdeaDTO, type InternalIdeaDTO } from "@/server/services/ideas";
import { IDEA_STATUS_EXPLANATIONS, IDEA_STATUS_LABELS, IDEA_VISIBILITY_LABELS, PRIORITY_LABELS } from "@/server/learning/labels";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { Chip, IdeaStatusBadge } from "@/components/portal/learning/badges";
import { formatDate } from "@/components/portal/learning/format";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Improvement ideas" };

const STATUSES = Object.values(IdeaStatus) as IdeaStatus[];

export default async function IdeasPage({ searchParams }: { searchParams: Promise<{ status?: string | string[] }> }) {
  const actor = await learningPageActor();
  const sp = await searchParams;
  const raw = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const status = STATUSES.find((s) => s === raw);
  const canManage = actor.isEmployee && can.manageIdeas(actor);
  const result = await listIdeas(actor, { status });

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Collective learning"
        title="Improvement ideas"
        description={
          result.audience === "internal"
            ? "Product ideas informed by approved shared learning. Internal fields (priority, notes, evidence) are never shown to clients."
            : "Ideas the Azentio product team is considering, informed by shared learning from participants."
        }
        actions={
          canManage ? (
            <Button asChild>
              <Link href="/portal/ideas/new">
                <Plus aria-hidden /> New idea
              </Link>
            </Button>
          ) : undefined
        }
      />

      <Notice title="What the statuses mean">
        “{IDEA_STATUS_LABELS.UNDER_REVIEW}” means the idea is being assessed — it is not a delivery commitment. “{IDEA_STATUS_LABELS.PLANNED}”
        plans can change and dates are not guaranteed.
      </Notice>

      <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
        <FilterChip href="/portal/ideas" active={!status}>
          All
        </FilterChip>
        {STATUSES.map((s) => (
          <FilterChip key={s} href={`/portal/ideas?status=${s}`} active={status === s}>
            {IDEA_STATUS_LABELS[s]}
          </FilterChip>
        ))}
      </nav>

      {result.items.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title={status ? `No ideas with status “${IDEA_STATUS_LABELS[status]}”` : "No improvement ideas yet"}
          description={
            result.audience === "internal"
              ? "Product owners can create ideas linked to approved shared evidence."
              : "When the product team shares ideas informed by community learning, they appear here."
          }
        />
      ) : result.audience === "internal" ? (
        <ul className="grid gap-3">
          {result.items.map((i) => (
            <InternalIdeaRow key={i.id} idea={i} />
          ))}
        </ul>
      ) : (
        <ul className="grid gap-3">
          {result.items.map((i) => (
            <ClientIdeaRow key={i.id} idea={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-brand-navy bg-brand-navy text-white" : "bg-card text-brand-ink hover:bg-accent",
      )}
    >
      {children}
    </Link>
  );
}

/** Participant view: ClientIdeaDTO fields only. */
function ClientIdeaRow({ idea }: { idea: ClientIdeaDTO }) {
  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-semibold text-brand-ink">
          <Link href={`/portal/ideas/${idea.id}`} className="hover:underline">
            {idea.title}
          </Link>
        </h2>
        <IdeaStatusBadge status={idea.status} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{idea.statusExplanation}</p>
      {idea.publicStatusNote && <p className="mt-2 whitespace-pre-wrap text-sm text-brand-ink">{idea.publicStatusNote}</p>}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{idea.offering.name}</span>
        <span>
          Owner: {idea.ownerName} · {idea.team}
        </span>
        {idea.themeTitle && <span>Theme: {idea.themeTitle}</span>}
        <span>Updated {formatDate(idea.updatedAt)}</span>
      </p>
    </li>
  );
}

function InternalIdeaRow({ idea }: { idea: InternalIdeaDTO }) {
  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-semibold text-brand-ink">
          <Link href={`/portal/ideas/${idea.id}`} className="hover:underline">
            {idea.title}
          </Link>
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <IdeaStatusBadge status={idea.status} />
          <Chip tone={idea.visibility === "INTERNAL" ? "neutral" : "success"}>{IDEA_VISIBILITY_LABELS[idea.visibility]}</Chip>
          <Chip tone={idea.priority === "URGENT" || idea.priority === "HIGH" ? "warning" : "neutral"}>Priority: {PRIORITY_LABELS[idea.priority]}</Chip>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{IDEA_STATUS_EXPLANATIONS[idea.status]}</p>
      {idea.publicStatusNote && <p className="mt-2 whitespace-pre-wrap text-sm text-brand-ink">{idea.publicStatusNote}</p>}
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{idea.offering.name}</span>
        <span>
          Owner: {idea.ownerName} · {idea.team}
        </span>
        {idea.theme && <span>Theme: {idea.theme.title}</span>}
        <span>Updated {formatDate(idea.updatedAt)}</span>
      </p>
    </li>
  );
}

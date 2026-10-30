import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import { airaStatus } from "@/server/services/aira";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { AiraAssistant } from "@/components/portal/aira/aira-assistant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AIRA assistant" };

export default async function AiraPage() {
  const actor = await requireUser();
  if (!can.useAira(actor)) notFound();
  const status = airaStatus(actor);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Collective learning"
        title="AIRA assistant"
        description="Ask questions about approved, de-identified shared contributions and published content. AIRA cites its sources so you can verify every claim."
      />

      <div className="grid gap-3 md:grid-cols-2">
        <Notice title="Retrieval scope">
          AIRA only reads approved shared contributions (the de-identified copies published after moderation) and published content
          your audience may see{actor.isEmployee ? ", including internal employee content" : ""}. Private observations, drafts,
          contributor identities and other workspaces&apos; data are never retrieved or sent to the AI provider.
        </Notice>
        <Notice title="Always current">
          Retrieval runs live for every question, so withdrawn, suspended or removed contributions are excluded immediately. AIRA
          does not make credit or business decisions, and the number of similar contributions is not evidence of prevalence.
        </Notice>
      </div>

      {status.configured ? (
        <AiraAssistant model={status.model} />
      ) : (
        <EmptyState icon={Sparkles} title="AIRA is unavailable" description={status.message} />
      )}
    </div>
  );
}

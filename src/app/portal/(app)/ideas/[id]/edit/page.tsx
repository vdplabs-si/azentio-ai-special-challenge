import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { can } from "@/lib/authz/permissions";
import { learningPageActor } from "@/server/learning/guard";
import { getIdeaForEdit, listIdeaOwnerOptions } from "@/server/services/ideas";
import { listThemeOptions } from "@/server/services/themes";
import { listOfferingOptions } from "@/server/services/observations";
import { PageHeader } from "@/components/portal/page";
import { IdeaForm } from "@/components/portal/learning/idea-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit improvement idea" };

export default async function EditIdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await learningPageActor();
  if (!(actor.isEmployee && can.manageIdeas(actor))) notFound();
  const { id } = await params;
  let idea;
  try {
    idea = await getIdeaForEdit(actor, id);
  } catch (e) {
    if (e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
  const [offerings, themes, owners] = await Promise.all([listOfferingOptions(), listThemeOptions(actor), listIdeaOwnerOptions(actor)]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Improvement ideas"
        title="Edit improvement idea"
        description="Status changes are recorded separately on the idea page so every change is logged and contributors can be informed."
      />
      <IdeaForm
        ideaId={idea.id}
        initial={idea.values}
        initialEvidence={idea.evidence}
        offerings={offerings.map((o) => ({ id: o.id, name: o.name }))}
        themes={themes}
        owners={owners}
      />
    </div>
  );
}

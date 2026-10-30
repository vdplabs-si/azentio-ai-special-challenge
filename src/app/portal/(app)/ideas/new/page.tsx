import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { can } from "@/lib/authz/permissions";
import { learningPageActor } from "@/server/learning/guard";
import { listIdeaOwnerOptions } from "@/server/services/ideas";
import { listThemeOptions } from "@/server/services/themes";
import { listOfferingOptions } from "@/server/services/observations";
import { PageHeader } from "@/components/portal/page";
import { IdeaForm } from "@/components/portal/learning/idea-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New improvement idea" };

export default async function NewIdeaPage({ searchParams }: { searchParams: Promise<{ theme?: string | string[] }> }) {
  const actor = await learningPageActor();
  if (!(actor.isEmployee && can.manageIdeas(actor))) notFound();
  const sp = await searchParams;
  const requestedTheme = Array.isArray(sp.theme) ? sp.theme[0] : sp.theme;

  const [offerings, themes, owners] = await Promise.all([listOfferingOptions(), listThemeOptions(actor), listIdeaOwnerOptions(actor)]);
  const themeId = themes.some((t) => t.id === requestedTheme) ? requestedTheme! : "";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Improvement ideas"
        title="New improvement idea"
        description="Capture a product improvement informed by approved shared learning. Ideas are internal until you share them with participants."
      />
      <IdeaForm
        initial={{
          title: "",
          problemStatement: "",
          proposedOutcome: "",
          offeringId: "",
          themeId,
          ownerId: owners.some((o) => o.id === actor.user.id) ? actor.user.id : "",
          team: "",
          priority: "MEDIUM",
          visibility: "INTERNAL",
          publicStatusNote: "",
          internalNotes: "",
          status: "PROPOSED",
        }}
        initialEvidence={[]}
        offerings={offerings.map((o) => ({ id: o.id, name: o.name }))}
        themes={themes}
        owners={owners}
      />
    </div>
  );
}

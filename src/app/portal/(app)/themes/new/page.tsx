import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { can } from "@/lib/authz/permissions";
import { learningPageActor } from "@/server/learning/guard";
import { listOfferingOptions } from "@/server/services/observations";
import { getSharedSummariesByIds } from "@/server/services/shared-feed";
import { PageHeader } from "@/components/portal/page";
import { ThemeForm } from "@/components/portal/learning/theme-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New theme" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewThemePage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await learningPageActor();
  if (!can.manageThemes(actor)) notFound();
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const evidenceIds = [...new Set(first(sp.evidence).split(",").map((s) => s.trim()).filter((s) => s && s.length <= 64))].slice(0, 100);
  const title = first(sp.title).slice(0, 150);

  const [offerings, evidence] = await Promise.all([
    listOfferingOptions(),
    // Pre-selected evidence from a suggested grouping: only copies currently visible in the shared feed.
    getSharedSummariesByIds(actor, evidenceIds),
  ]);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Themes"
        title="New theme"
        description="Group approved shared contributions into a theme. Draft themes are internal; publish to make a theme visible to client participants."
      />
      <ThemeForm
        initial={{ title, summary: "", limitations: "", status: "DRAFT", offeringIds: [] }}
        initialEvidence={evidence}
        offerings={offerings.map((o) => ({ id: o.id, name: o.name }))}
      />
    </div>
  );
}

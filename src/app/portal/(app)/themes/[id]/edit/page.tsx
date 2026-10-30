import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/api/errors";
import { can } from "@/lib/authz/permissions";
import { learningPageActor } from "@/server/learning/guard";
import { getThemeForEdit } from "@/server/services/themes";
import { listOfferingOptions } from "@/server/services/observations";
import { PageHeader } from "@/components/portal/page";
import { ThemeForm } from "@/components/portal/learning/theme-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit theme" };

export default async function EditThemePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await learningPageActor();
  if (!can.manageThemes(actor)) notFound();
  const { id } = await params;
  let theme;
  try {
    theme = await getThemeForEdit(actor, id);
  } catch (e) {
    if (e instanceof AppError && (e.code === "not_found" || e.code === "forbidden")) notFound();
    throw e;
  }
  const offerings = await listOfferingOptions();

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Themes"
        title="Edit theme"
        description="Evidence that has been withdrawn or unpublished is no longer listed and will be unlinked when you save."
      />
      <ThemeForm themeId={theme.id} initial={theme.values} initialEvidence={theme.evidence} offerings={offerings.map((o) => ({ id: o.id, name: o.name }))} />
    </div>
  );
}

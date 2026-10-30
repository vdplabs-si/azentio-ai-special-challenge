import type { Metadata } from "next";
import { learningPageActor, orNotFound } from "@/server/learning/guard";
import { getObservationForEdit, listOfferingOptions } from "@/server/services/observations";
import type { ObservationFormValues } from "@/server/learning/schemas";
import { PageHeader } from "@/components/portal/page";
import { ObservationStatusBadge, PrivateBadge } from "@/components/portal/learning/badges";
import { ObservationForm } from "@/components/portal/learning/observation-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit observation" };

export default async function EditObservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await learningPageActor();
  const [data, offerings] = await Promise.all([orNotFound(getObservationForEdit(actor, id)), listOfferingOptions()]);
  const amend = data.status === "PUBLISHED";
  const orgName = actor.activeOrganisation?.organisation.name ?? "your organisation";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={amend ? `Amend · creates version ${data.version + 1}` : `Edit · version ${data.version}`}
        title={amend ? "Amend published observation" : "Edit observation"}
        description={<ObservationStatusBadge status={data.status} />}
        actions={<PrivateBadge />}
      />
      <ObservationForm
        mode={amend ? "amend" : "edit"}
        observationId={data.id}
        status={data.status}
        initial={data.values as Partial<ObservationFormValues>}
        offerings={offerings.map((o) => ({ id: o.id, name: o.name }))}
        organisationName={orgName}
        initialConsent={data.latestConsent}
      />
    </div>
  );
}

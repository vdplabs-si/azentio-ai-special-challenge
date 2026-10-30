import type { Metadata } from "next";
import Link from "next/link";
import { canContributeInOrg } from "@/lib/authz/permissions";
import { learningPageActor } from "@/server/learning/guard";
import { listOfferingOptions } from "@/server/services/observations";
import { Button } from "@/components/ui/button";
import { Notice, PageHeader } from "@/components/portal/page";
import { PrivateBadge } from "@/components/portal/learning/badges";
import { ObservationForm } from "@/components/portal/learning/observation-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New observation" };

export default async function NewObservationPage() {
  const actor = await learningPageActor();
  const org = actor.activeOrganisation;
  const orgName = org?.organisation.name ?? "your organisation";

  if (!org || !canContributeInOrg(actor, org.organisationId)) {
    return (
      <div className="grid gap-6">
        <PageHeader eyebrow={orgName} title="New observation" actions={<PrivateBadge />} />
        <Notice tone="warning" title="You can't create observations in this workspace">
          Your role in {orgName} is read-only. Switch to a workspace where you are a contributor, or ask a workspace administrator for access.
        </Notice>
        <Button asChild variant="outline" className="w-fit">
          <Link href="/portal/observations">Back to observations</Link>
        </Button>
      </div>
    );
  }

  const offerings = await listOfferingOptions();
  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={`${orgName} · private draft`}
        title="New observation"
        description={`Saved to ${orgName} as a private draft. You decide whether it stays private, is shared within your organisation, or is proposed to the moderated learning community.`}
        actions={<PrivateBadge />}
      />
      <ObservationForm mode="create" offerings={offerings.map((o) => ({ id: o.id, name: o.name }))} organisationName={orgName} />
    </div>
  );
}

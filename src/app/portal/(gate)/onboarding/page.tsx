import Link from "next/link";
import type { Metadata } from "next";
import { getActor } from "@/lib/authz/actor";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Join workspace", robots: { index: false } };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  const actor = await getActor();
  const membership = actor.pendingMemberships.find((m) => m.organisationId === org && m.status === "INVITED_PENDING_TERMS");
  if (!membership) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Nothing to complete</h1>
        <p className="mt-2 text-sm text-muted-foreground">There is no pending invitation for this workspace on your account.</p>
        <Button asChild className="mt-6"><Link href="/portal/pending">View access status</Link></Button>
      </div>
    );
  }
  const name = membership.organisation.name;
  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">Joining {name}</p>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink">Before you enter the workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">Role: {membership.role.toLowerCase()}</p>
      </div>
      <section className="grid gap-3 rounded-lg border bg-card p-5 text-sm leading-relaxed">
        <h2 className="text-base font-semibold">Workspace terms</h2>
        <p>
          You will see only content your organisation is entitled to. Use synthetic or explicitly approved data in sandbox
          demonstrations — never real customer identities, account numbers, transaction-level data, credentials or
          confidential contractual terms. Your activity on privileged actions is audited.
        </p>
      </section>
      <section className="grid gap-3 rounded-lg border bg-card p-5 text-sm leading-relaxed">
        <h2 className="text-base font-semibold">How learning and sharing works</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Joining this workspace is <strong>not</strong> consent to share or to train on your organisation&apos;s data.</li>
          <li>Every observation starts as a private draft. Nothing becomes shared because you clicked Save.</li>
          <li>
            You choose who can see each contribution: only you, your organisation, or a proposal to the approved learning
            community. Community sharing always requires moderator review of a de-identified copy.
          </li>
          <li>
            Storing, publishing a reviewed shared version, organisation attribution and any future training programme are
            separate permissions you grant per contribution — and you can withdraw a shared contribution at any time.
          </li>
          <li>Withdrawal stops future visibility and retrieval; it cannot recall copies others have already viewed.</li>
        </ul>
      </section>
      <OnboardingForm organisationId={membership.organisationId} />
    </div>
  );
}

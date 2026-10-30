import Link from "next/link";
import type { Metadata } from "next";
import { previewInvitation } from "@/server/services/invitations";
import { getActor } from "@/lib/authz/actor";
import { AcceptInvitation } from "@/components/auth/accept-invitation";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [invite, actor] = await Promise.all([previewInvitation(token), getActor()]);

  if (!invite || invite.status !== "PENDING") {
    return (
      <div>
        <h1 className="text-2xl font-bold text-brand-ink">Invitation unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {invite?.status === "EXPIRED"
            ? "This invitation has expired. Ask your workspace administrator to send a new one."
            : invite?.status === "ACCEPTED"
              ? "This invitation has already been used."
              : "This invitation link is invalid or has been revoked."}
        </p>
        <Button asChild className="mt-6"><Link href="/">Go to azentio.ai</Link></Button>
      </div>
    );
  }

  const next = `/invite/${token}`;
  return (
    <div>
      <p className="eyebrow">Workspace invitation</p>
      <h1 className="mt-2 text-2xl font-bold text-brand-ink">Join {invite.organisation}</h1>
      <dl className="mt-6 grid grid-cols-[8rem_1fr] gap-y-2 rounded-lg border bg-card p-4 text-sm">
        <dt className="text-muted-foreground">Organisation</dt>
        <dd className="font-medium">{invite.organisation}</dd>
        <dt className="text-muted-foreground">Proposed role</dt>
        <dd className="font-medium">{invite.role.toLowerCase()}</dd>
        <dt className="text-muted-foreground">Issued to</dt>
        <dd className="font-medium">{invite.emailHint}</dd>
        <dt className="text-muted-foreground">Expires</dt>
        <dd className="font-medium">{invite.expiresAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}</dd>
      </dl>
      {!actor.user ? (
        <div className="mt-6 grid gap-3">
          <p className="text-sm text-muted-foreground">
            Sign in or create an account with the invited email address to continue. The invitation can only be accepted by
            that verified account.
          </p>
          <Button asChild size="lg" className="h-10"><Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></Button>
          <Button asChild variant="outline" size="lg" className="h-10"><Link href={`/register?next=${encodeURIComponent(next)}`}>Create account</Link></Button>
        </div>
      ) : (
        <AcceptInvitation token={token} signedInAs={actor.user.email} verified={actor.user.emailVerified} />
      )}
    </div>
  );
}

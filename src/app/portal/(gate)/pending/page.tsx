import Link from "next/link";
import type { Metadata } from "next";
import { getActor } from "@/lib/authz/actor";
import { isEmployeeDomain } from "@/lib/auth/accounts";
import { VerifyEmail } from "@/components/auth/verify-email";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Access status", robots: { index: false } };

export default async function PendingPage() {
  const actor = await getActor();
  const user = actor.user!;
  const awaitingTerms = actor.pendingMemberships.filter((m) => m.status === "INVITED_PENDING_TERMS");
  const awaitingApproval = actor.pendingMemberships.filter((m) => m.status === "PENDING_APPROVAL");
  const suspended = actor.pendingMemberships.filter((m) => m.status === "SUSPENDED");

  return (
    <div className="grid gap-6">
      <div>
        <p className="eyebrow">Your access</p>
        <h1 className="mt-2 text-2xl font-bold text-brand-ink">Welcome, {user.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Portal access is granted per workspace. Here is the current state of your account.
        </p>
      </div>

      {!user.emailVerified && (
        <Card>
          <CardHeader>
            <CardTitle>Verify your email address</CardTitle>
            <CardDescription>
              Required before you can accept invitations{isEmployeeDomain(user.email) ? " or request employee access" : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent><VerifyEmail email={user.email} /></CardContent>
        </Card>
      )}

      {awaitingTerms.map((m) => (
        <Card key={m.organisationId}>
          <CardHeader>
            <CardTitle>Finish joining {m.organisation.name}</CardTitle>
            <CardDescription>Review the workspace terms and how sharing works.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild><Link href={`/portal/onboarding?org=${m.organisationId}`}>Continue</Link></Button>
          </CardContent>
        </Card>
      ))}

      {awaitingApproval.map((m) => (
        <Card key={m.organisationId}>
          <CardHeader>
            <CardTitle>Awaiting approval — {m.organisation.name}</CardTitle>
            <CardDescription>
              Your verified work identity has been recorded. A portal administrator must approve employee access before the
              internal portal becomes available. You&apos;ll get a notification when that happens.
            </CardDescription>
          </CardHeader>
        </Card>
      ))}

      {suspended.map((m) => (
        <Card key={m.organisationId}>
          <CardHeader>
            <CardTitle>Access suspended — {m.organisation.name}</CardTitle>
            <CardDescription>Contact the workspace administrator if you believe this is a mistake.</CardDescription>
          </CardHeader>
        </Card>
      ))}

      {actor.memberships.length > 0 ? (
        <Button asChild size="lg"><Link href="/portal">Go to your portal</Link></Button>
      ) : (
        awaitingTerms.length === 0 &&
        awaitingApproval.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>No workspace access yet</CardTitle>
              <CardDescription>
                {isEmployeeDomain(user.email)
                  ? "Once your @azentio.com address is verified, an access request is sent to portal administrators."
                  : "Client organisations add members by invitation. Ask your organisation's azentio.ai administrator to invite this email address, then open the invitation link."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href="/connect">Contact Azentio</Link></Button>
              <Button asChild variant="ghost"><Link href="/">Back to the website</Link></Button>
            </CardContent>
          </Card>
        )
      )}
    </div>
  );
}

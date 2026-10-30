import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { providerStatus, safeNext } from "@/lib/auth/oauth";
import { getActor } from "@/lib/authz/actor";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const ERRORS: Record<string, string> = {
  oauth_state: "The sign-in attempt expired or was tampered with. Please try again.",
  oauth_config: "That sign-in provider isn't configured.",
  oauth_unverified: "Your provider account doesn't have a verified email address (employee addresses must belong to the Azentio Google Workspace).",
  oauth_email: "Your provider didn't share an email address.",
  oauth_failed: "We couldn't complete sign-in with that provider. Please try again.",
  account_deactivated: "This account has been deactivated.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const actor = await getActor();
  if (actor.user) redirect(next);
  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-ink">Sign in to azentio.ai</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Employees use their verified @azentio.com identity. Clients use the email address their invitation was sent to.
      </p>
      {sp.error && ERRORS[sp.error] && (
        <p role="alert" className="mt-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {ERRORS[sp.error]}
        </p>
      )}
      <div className="mt-6">
        <OAuthButtons status={providerStatus()} next={next} />
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <LoginForm next={next} />
      <p className="mt-8 text-sm text-muted-foreground">
        New here?{" "}
        <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-medium text-primary hover:underline">
          Create an account
        </Link>
        . Creating an account does not grant access to any workspace — clients join by invitation and employees after
        organiser approval.
      </p>
    </div>
  );
}

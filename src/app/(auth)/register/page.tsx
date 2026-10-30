import Link from "next/link";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { providerStatus, safeNext } from "@/lib/auth/oauth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <div>
      <h1 className="text-2xl font-bold text-brand-ink">Create your azentio.ai account</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        An account is an identity only. Access to a client workspace requires an invitation from that organisation;
        Azentio employees are approved by a portal administrator after verifying their @azentio.com address.
      </p>
      <div className="mt-6">
        <OAuthButtons status={providerStatus()} next={next} />
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
      </div>
      <RegisterForm next={next} />
      <p className="mt-8 text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

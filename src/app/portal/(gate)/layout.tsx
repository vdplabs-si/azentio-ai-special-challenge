import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/authz/actor";
import { Wordmark } from "@/components/brand/wordmark";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const dynamic = "force-dynamic";

export default async function GateLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor.user) redirect("/login?next=/portal");
  return (
    <div className="min-h-svh bg-brand-light/60">
      <header className="flex h-16 items-center justify-between border-b bg-background px-6">
        <Link href="/" aria-label="azentio.ai home"><Wordmark /></Link>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="hidden sm:inline">{actor.user.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-2xl px-6 py-12">{children}</main>
    </div>
  );
}

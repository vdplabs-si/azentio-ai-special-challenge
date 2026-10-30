import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getActor } from "@/lib/authz/actor";
import { serializeActor } from "@/lib/authz/serialize";
import { visibleNav } from "@/components/portal/shell/nav-config";
import { Sidebar } from "@/components/portal/shell/sidebar";
import { PortalHeader } from "@/components/portal/shell/header";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Portal", template: "%s · azentio.ai portal" }, robots: { index: false } };

/** Every portal page requires a signed-in user with at least one ACTIVE membership. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor.user) redirect("/login?next=/portal");
  if (actor.memberships.length === 0) redirect("/portal/pending");
  const view = serializeActor(actor);
  const sections = visibleNav(view);
  return (
    <div className="flex min-h-svh bg-brand-light/60">
      <Sidebar sections={sections} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader actor={view} sections={sections} />
        <main id="main-content" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

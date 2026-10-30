import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarDays, Trophy, Users } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { CreateTeamDialog, TeamMembershipButton } from "@/components/portal/collab/project-actions";
import { EnumBadge, SectionHeading, ToneBadge } from "@/components/portal/collab/ui";
import { PROJECT_ROLE_LABEL, PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE } from "@/components/portal/collab/labels";
import { formatDate } from "@/components/portal/collab/dates";
import { listHackathonEvents } from "@/server/services/projects";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Hackathon teams" };

/** Employee-only hackathon team spaces. Teams are internal projects; their pages reuse the project view. */
export default async function HackathonPage() {
  const actor = await requireUser();
  if (!actor.isEmployee) notFound();
  const events = await listHackathonEvents(actor);
  const now = new Date();

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Innovation"
        title="Hackathon teams"
        description="Form a team, invite colleagues and run your hackathon project with tasks, discussions and documents. Team spaces are visible to all Azentio employees."
      />
      {events.length === 0 ? (
        <EmptyState icon={Trophy} title="No hackathon events yet" description="Events are published by the Azentio Build Labs organisers. Check back soon." />
      ) : (
        events.map((e) => {
          const status = e.endsAt < now ? "Ended" : e.startsAt <= now ? "In progress" : "Upcoming";
          return (
            <section key={e.id} aria-labelledby={`ev-${e.id}`} className="rounded-xl border bg-card p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 id={`ev-${e.id}`} className="text-xl font-semibold text-brand-ink">
                    {e.name}
                  </h2>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="size-4" aria-hidden /> {formatDate(e.startsAt)} – {formatDate(e.endsAt)}
                  </p>
                  <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">{e.description}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <ToneBadge tone={status === "Ended" ? "neutral" : status === "In progress" ? "brand" : "info"}>{status}</ToneBadge>
                  <ToneBadge tone={e.open ? "success" : "neutral"}>{e.open ? "Teams open" : "Teams closed"}</ToneBadge>
                  {e.open && <CreateTeamDialog eventId={e.id} eventName={e.name} />}
                </div>
              </div>
              <div className="mt-5">
                <SectionHeading title={`Teams (${e.teams.length})`} />
                {e.teams.length === 0 ? (
                  <EmptyState icon={Users} title="No teams yet" description={e.open ? "Be the first to create a team for this event." : undefined} />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {e.teams.map((t) => (
                      <li key={t.id}>
                        <Card size="sm" className="h-full">
                          <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                              <CardTitle>
                                <Link href={`/portal/projects/${t.id}`} className="text-brand-ink hover:underline">
                                  {t.name}
                                </Link>
                              </CardTitle>
                              <EnumBadge value={t.status} labels={PROJECT_STATUS_LABEL} tones={PROJECT_STATUS_TONE} />
                            </div>
                            <CardDescription>Led by {t.owner.name}</CardDescription>
                          </CardHeader>
                          <CardContent className="grid gap-3">
                            {t.description && <p className="line-clamp-3 text-sm text-muted-foreground">{t.description}</p>}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Users className="size-3.5" aria-hidden /> {t.memberCount} {t.memberCount === 1 ? "member" : "members"}
                                {t.myRole && <ToneBadge tone="brand">You: {PROJECT_ROLE_LABEL[t.myRole]}</ToneBadge>}
                              </span>
                              <TeamMembershipButton projectId={t.id} joined={t.myRole !== null} isOwner={t.ownerId === actor.user.id} open={e.open} />
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          );
        })
      )}
      <Notice>Team spaces live in the internal Azentio workspace. Don&apos;t upload client data to hackathon teams.</Notice>
    </div>
  );
}

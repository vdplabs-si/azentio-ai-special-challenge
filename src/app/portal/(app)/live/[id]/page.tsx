import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, CalendarClock } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { getLiveSession, listInvitableOrganisations } from "@/server/services/live";
import { Notice, PageHeader } from "@/components/portal/page";
import { LocalDateTime } from "@/components/portal/live/local-time";
import { AudienceBadge, LiveStatusBadge } from "@/components/portal/live/status-badge";
import { VideoEmbed } from "@/components/portal/live/video-embed";
import { SessionActions } from "@/components/portal/live/session-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live session" };

export default async function LiveSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireUser();
  const session = await getLiveSession(actor, id);
  if (!session) notFound();
  const organisations = session.canManage ? await listInvitableOrganisations(actor) : [];

  const showStream = session.status === "LIVE" || session.status === "SCHEDULED";
  const now = new Date();
  const startsInFuture = session.startsAt.getTime() > now.getTime();

  return (
    <div className="grid gap-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/portal/live">
            <ArrowLeft aria-hidden /> All sessions
          </Link>
        </Button>
      </div>
      <PageHeader
        eyebrow="Live session"
        title={session.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <CalendarClock className="size-4" aria-hidden />
            <LocalDateTime value={session.startsAt} />
            {session.endsAt && (
              <>
                {" – "}
                <LocalDateTime value={session.endsAt} />
              </>
            )}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LiveStatusBadge status={session.status} />
            <AudienceBadge audience={session.audience} />
          </div>
        }
      />

      {session.status === "CANCELLED" && (
        <Notice tone="warning" title="This session was cancelled">
          It is hidden from every audience. Only broadcast publishers can see it, and it can be reinstated by editing its status.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid content-start gap-6">
          {showStream &&
            (session.streamUrl ? (
              <VideoEmbed embedUrl={session.streamEmbedUrl} url={session.streamUrl} title={`Live stream: ${session.title}`} linkLabel="Open stream" />
            ) : (
              <Notice title={session.status === "LIVE" ? "Stream link not yet available" : "Stream link coming soon"}>
                {startsInFuture
                  ? "The stream link will appear here before the session starts."
                  : "The broadcaster has not published a stream link for this session yet."}
              </Notice>
            ))}
          {session.status === "ENDED" &&
            (session.recordingUrl ? (
              <VideoEmbed embedUrl={session.recordingEmbedUrl} url={session.recordingUrl} title={`Recording: ${session.title}`} linkLabel="Watch recording" />
            ) : (
              <Notice title="No recording published">This session has ended and no recording has been published.</Notice>
            ))}
          <Card>
            <CardHeader>
              <CardTitle>About this session</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{session.description}</p>
            </CardContent>
          </Card>
        </div>

        {session.canManage && (
          <aside className="grid content-start gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Broadcast controls</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm">
                <SessionActions
                  organisations={organisations}
                  canTargetRestricted={actor.isEmployee}
                  session={{
                    id: session.id,
                    title: session.title,
                    description: session.description,
                    startsAt: session.startsAt.toISOString(),
                    endsAt: session.endsAt ? session.endsAt.toISOString() : null,
                    streamUrl: session.streamUrl,
                    recordingUrl: session.recordingUrl,
                    audience: session.audience,
                    status: session.status,
                    organisationIds: session.organisations?.map((o) => o.id) ?? [],
                  }}
                />
                {session.audience === "CLIENT_ORGS" && (
                  <div>
                    <p className="font-medium text-brand-ink">Invited organisations</p>
                    {session.organisations && session.organisations.length > 0 ? (
                      <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                        {session.organisations.map((o) => (
                          <li key={o.id}>{o.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-muted-foreground">No organisations invited.</p>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Last updated <LocalDateTime value={session.updatedAt} />. All changes are recorded in the audit log.
                </p>
              </CardContent>
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}

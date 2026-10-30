import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarDays, Inbox, Trophy } from "lucide-react";
import type { AuthedActor } from "@/lib/authz/actor";
import { requireUser } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import { inquiryListQuery, listDemoRequests, listHackathonEvents, listHackathonRegistrations } from "@/server/services/admin";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { Pager } from "@/components/portal/dashboard/pager";
import { FilterBar } from "@/components/portal/admin/filter-bar";
import { NativeSelect } from "@/components/portal/admin/native-select";
import { StatusBadge } from "@/components/portal/admin/status-badge";
import { TabNav } from "@/components/portal/admin/tab-nav";
import { flatParams, fmtDate, fmtDateTime, humanize } from "@/components/portal/admin/format";
import { HackathonEventDialog, InquiryStatusSelect, RegistrationToggle } from "@/components/portal/admin/inquiry-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inquiries" };

type Params = Record<string, string>;
const TABS = ["demo", "hackathon", "events"] as const;
type Tab = (typeof TABS)[number];

function StatusFilter({ value }: { value?: string }) {
  return (
    <div className="grid w-40 gap-1.5">
      <Label htmlFor="inq-status">Status</Label>
      <NativeSelect id="inq-status" name="status" defaultValue={value ?? ""}>
        <option value="">Any status</option>
        <option value="NEW">New</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="CLOSED">Closed</option>
      </NativeSelect>
    </div>
  );
}

function SearchFilter({ value, placeholder }: { value?: string; placeholder: string }) {
  return (
    <div className="grid min-w-56 flex-1 gap-1.5">
      <Label htmlFor="inq-q">Search</Label>
      <Input id="inq-q" name="q" defaultValue={value ?? ""} placeholder={placeholder} maxLength={100} />
    </div>
  );
}

export default async function AdminInquiriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireUser();
  if (!can.viewInquiries(actor)) notFound();
  const params = flatParams(await searchParams);
  const tab: Tab = (TABS as readonly string[]).includes(params.tab ?? "") ? (params.tab as Tab) : "demo";

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Inquiries"
        description="Demo requests and hackathon registrations submitted through the public website. Contact details are personal data: use them only for the purpose the person consented to."
      />
      <TabNav
        basePath="/portal/admin/inquiries"
        current={tab}
        tabs={[
          { key: "demo", label: "Demo requests" },
          { key: "hackathon", label: "Hackathon registrations" },
          { key: "events", label: "Hackathon events" },
        ]}
      />
      {tab === "demo" && <DemoTab actor={actor} params={params} />}
      {tab === "hackathon" && <HackathonTab actor={actor} params={params} />}
      {tab === "events" && <EventsTab actor={actor} />}
    </div>
  );
}

async function DemoTab({ actor, params }: { actor: AuthedActor; params: Params }) {
  const parsed = inquiryListQuery.safeParse({ ...params, kind: "demo" });
  const query = parsed.success ? parsed.data : inquiryListQuery.parse({ kind: "demo" });
  const page = await listDemoRequests(actor, query);
  const filtered = Boolean(query.status || query.q);
  return (
    <div className="grid gap-4">
      {!parsed.success && <Notice tone="warning">Some filters were invalid and have been ignored.</Notice>}
      <FilterBar action="/portal/admin/inquiries" hidden={{ tab: "demo" }} resetHref="/portal/admin/inquiries?tab=demo">
        <SearchFilter value={query.q} placeholder="Name, email or company" />
        <StatusFilter value={query.status} />
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filtered ? "No demo requests match these filters" : "No demo requests yet"}
          description={filtered ? "Try a different status or search." : "Requests submitted on the website's connect page appear here."}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Interest</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((r) => (
                <TableRow key={r.id} className="align-top">
                  <TableCell className="text-xs text-muted-foreground">{fmtDateTime(r.createdAt)}</TableCell>
                  <TableCell className="max-w-60 whitespace-normal text-xs">
                    <p className="text-sm font-medium text-brand-ink">{r.name}</p>
                    <a href={`mailto:${r.email}`} className="break-all text-brand-navy underline-offset-2 hover:underline">
                      {r.email}
                    </a>
                    <p className="text-muted-foreground">
                      {r.company}
                      {r.jobTitle ? ` · ${r.jobTitle}` : ""}
                      {r.country ? ` · ${r.country}` : ""}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">{r.consentContact ? "Consented to contact" : "No contact consent recorded"}</p>
                  </TableCell>
                  <TableCell className="text-xs">{r.interest}</TableCell>
                  <TableCell className="max-w-96 whitespace-pre-wrap text-xs">{r.message}</TableCell>
                  <TableCell>
                    <div className="grid gap-1">
                      <StatusBadge status={r.status} />
                      <InquiryStatusSelect key={r.status} kind="demo" id={r.id} status={r.status} label={r.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager basePath="/portal/admin/inquiries" params={{ ...params, tab: "demo" }} cursor={query.cursor} nextCursor={page.nextCursor} label="demo requests" />
    </div>
  );
}

async function HackathonTab({ actor, params }: { actor: AuthedActor; params: Params }) {
  const parsed = inquiryListQuery.safeParse({ ...params, kind: "hackathon" });
  const query = parsed.success ? parsed.data : inquiryListQuery.parse({ kind: "hackathon" });
  const [page, events] = await Promise.all([listHackathonRegistrations(actor, query), listHackathonEvents(actor)]);
  const filtered = Boolean(query.status || query.q || query.eventId);
  return (
    <div className="grid gap-4">
      {!parsed.success && <Notice tone="warning">Some filters were invalid and have been ignored.</Notice>}
      <FilterBar action="/portal/admin/inquiries" hidden={{ tab: "hackathon" }} resetHref="/portal/admin/inquiries?tab=hackathon">
        <SearchFilter value={query.q} placeholder="Name, email or team" />
        <div className="grid w-56 gap-1.5">
          <Label htmlFor="inq-event">Event</Label>
          <NativeSelect id="inq-event" name="eventId" defaultValue={query.eventId ?? ""}>
            <option value="">All events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <StatusFilter value={query.status} />
      </FilterBar>
      {page.items.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title={filtered ? "No registrations match these filters" : "No hackathon registrations yet"}
          description={filtered ? "Try a different event, status or search." : "Registrations from the public hackathon page appear here."}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Participant</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Team & idea</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((r) => (
                <TableRow key={r.id} className="align-top">
                  <TableCell className="text-xs text-muted-foreground">{fmtDateTime(r.createdAt)}</TableCell>
                  <TableCell className="max-w-60 whitespace-normal text-xs">
                    <p className="text-sm font-medium text-brand-ink">{r.name}</p>
                    <a href={`mailto:${r.email}`} className="break-all text-brand-navy underline-offset-2 hover:underline">
                      {r.email}
                    </a>
                    <p className="text-muted-foreground">
                      {humanize(r.participantType)}
                      {r.organisation ? ` · ${r.organisation}` : ""}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">{r.consentContact ? "Consented to contact" : "No contact consent recorded"}</p>
                  </TableCell>
                  <TableCell className="text-xs">{r.event.name}</TableCell>
                  <TableCell className="max-w-96 whitespace-normal text-xs">
                    {r.teamName && <p className="font-medium text-brand-ink">{r.teamName}</p>}
                    {r.ideaSummary ? <p className="whitespace-pre-wrap">{r.ideaSummary}</p> : <p className="text-muted-foreground">No idea summary</p>}
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-1">
                      <StatusBadge status={r.status} />
                      <InquiryStatusSelect key={r.status} kind="hackathon" id={r.id} status={r.status} label={r.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager basePath="/portal/admin/inquiries" params={{ ...params, tab: "hackathon" }} cursor={query.cursor} nextCursor={page.nextCursor} label="registrations" />
    </div>
  );
}

async function EventsTab({ actor }: { actor: AuthedActor }) {
  const events = await listHackathonEvents(actor);
  const now = new Date();
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <HackathonEventDialog />
      </div>
      {events.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No hackathon events" description="Create an event to open public registration." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Registration</TableHead>
                <TableHead className="text-right">Registrations</TableHead>
                <TableHead className="text-right">Teams</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => {
                const phase = e.endsAt < now ? "Ended" : e.startsAt <= now ? "Running" : "Upcoming";
                return (
                  <TableRow key={e.id} className="align-top">
                    <TableCell className="max-w-80 whitespace-normal">
                      <p className="font-medium text-brand-ink">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.slug}</p>
                      <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">{e.description}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {fmtDate(e.startsAt)} – {fmtDate(e.endsAt)}
                      <p className="text-muted-foreground">{phase}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge tone={e.registrationOpen ? "success" : "neutral"} label={e.registrationOpen ? "Open" : "Closed"} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.registrations}</TableCell>
                    <TableCell className="text-right tabular-nums">{e.teams}</TableCell>
                    <TableCell>
                      <div className="flex flex-col items-end gap-2">
                        <HackathonEventDialog event={e} />
                        <RegistrationToggle id={e.id} name={e.name} open={e.registrationOpen} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

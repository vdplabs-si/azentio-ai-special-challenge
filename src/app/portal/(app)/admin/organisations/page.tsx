import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Building2, KeyRound, UserCheck } from "lucide-react";
import type { AuthedActor } from "@/lib/authz/actor";
import { requireUser } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import {
  SUPPORT_ACCESS_MINUTES, listClientOrganisationOptions, listEmployeeApprovals, listOfferingsForEntitlements,
  listOrganisations, listSupportAccess, orgListQuery, organisationTabCounts,
} from "@/server/services/admin";
import { paginationSchema } from "@/lib/api/pagination";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { Pager } from "@/components/portal/dashboard/pager";
import { FilterBar } from "@/components/portal/admin/filter-bar";
import { NativeSelect } from "@/components/portal/admin/native-select";
import { StatusBadge } from "@/components/portal/admin/status-badge";
import { TabNav } from "@/components/portal/admin/tab-nav";
import { flatParams, fmtDate, fmtDateTime } from "@/components/portal/admin/format";
import {
  ApprovalButtons, EntitlementDialog, OrgStatusButton, RevokeEntitlementButton,
} from "@/components/portal/admin/organisation-actions";
import { RevokeSupportButton, SupportAccessDialog } from "@/components/portal/admin/support-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Organisations" };

type Params = Record<string, string>;
const TABS = ["organisations", "approvals", "support"] as const;
type Tab = (typeof TABS)[number];

export default async function AdminOrganisationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireUser();
  if (!can.manageOrganisations(actor)) notFound();
  const params = flatParams(await searchParams);
  const tab: Tab = (TABS as readonly string[]).includes(params.tab ?? "") ? (params.tab as Tab) : "organisations";
  const counts = await organisationTabCounts(actor);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Organisations"
        description="Workspace status, product entitlements, employee approvals and time-boxed support access. Organisation metadata is visible to administrators; private workspace content is not."
      />
      <TabNav
        basePath="/portal/admin/organisations"
        current={tab}
        tabs={[
          { key: "organisations", label: "Organisations" },
          { key: "approvals", label: "Employee approvals", count: counts.pendingApprovals },
          { key: "support", label: "Support access", count: counts.activeSupport },
        ]}
      />
      {tab === "organisations" && <OrganisationsTab actor={actor} params={params} />}
      {tab === "approvals" && <ApprovalsTab actor={actor} params={params} />}
      {tab === "support" && <SupportTab actor={actor} />}
    </div>
  );
}

async function OrganisationsTab({ actor, params }: { actor: AuthedActor; params: Params }) {
  const parsed = orgListQuery.safeParse(params);
  const query = parsed.success ? parsed.data : orgListQuery.parse({});
  const [page, offerings] = await Promise.all([listOrganisations(actor, query), listOfferingsForEntitlements(actor)]);
  const now = new Date();
  const filtered = Boolean(query.q || query.type || query.status);

  return (
    <div className="grid gap-4">
      {!parsed.success && <Notice tone="warning">Some filters were invalid and have been ignored.</Notice>}
      <FilterBar action="/portal/admin/organisations" hidden={{ tab: "organisations" }} resetHref="/portal/admin/organisations">
        <div className="grid min-w-56 flex-1 gap-1.5">
          <Label htmlFor="org-q">Search</Label>
          <Input id="org-q" name="q" defaultValue={query.q ?? ""} placeholder="Name or slug" maxLength={100} />
        </div>
        <div className="grid w-40 gap-1.5">
          <Label htmlFor="org-type">Type</Label>
          <NativeSelect id="org-type" name="type" defaultValue={query.type ?? ""}>
            <option value="">Any type</option>
            <option value="CLIENT">Client</option>
            <option value="INTERNAL">Internal</option>
          </NativeSelect>
        </div>
        <div className="grid w-40 gap-1.5">
          <Label htmlFor="org-status">Status</Label>
          <NativeSelect id="org-status" name="status" defaultValue={query.status ?? ""}>
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </NativeSelect>
        </div>
      </FilterBar>

      {page.items.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={filtered ? "No organisations match these filters" : "No organisations yet"}
          description={filtered ? "Try a different name, type or status." : "Organisations are created when workspaces are set up."}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Active members</TableHead>
                <TableHead>Entitlements</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((o) => {
                const isClient = o.type === "CLIENT";
                const activeOfferingIds = new Set(
                  o.entitlements.filter((e) => !e.expiresAt || e.expiresAt > now).map((e) => e.offering.id),
                );
                return (
                  <TableRow key={o.id} className="align-top">
                    <TableCell className="max-w-64 whitespace-normal">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-brand-ink">{o.name}</span>
                        <StatusBadge status={o.type} label={isClient ? "Client" : "Internal"} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {o.slug}
                        {o.industry ? ` · ${o.industry}` : ""}
                        {o.region ? ` · ${o.region}` : ""}
                      </p>
                      <p className="text-[0.7rem] text-muted-foreground">Created {fmtDate(o.createdAt)}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={o.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{o.activeMembers}</TableCell>
                    <TableCell className="max-w-80 whitespace-normal">
                      {!isClient ? (
                        <span className="text-xs text-muted-foreground">Employees use all sandbox offerings</span>
                      ) : o.entitlements.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No entitlements</span>
                      ) : (
                        <ul className="grid gap-1 text-xs">
                          {o.entitlements.map((e) => {
                            const expired = e.expiresAt !== null && e.expiresAt <= now;
                            return (
                              <li key={e.id} className="flex flex-wrap items-center gap-1">
                                <span className={expired ? "text-muted-foreground line-through" : "font-medium text-brand-ink"}>{e.offering.name}</span>
                                <span className="text-muted-foreground">
                                  {e.expiresAt ? (expired ? `expired ${fmtDate(e.expiresAt)}` : `until ${fmtDate(e.expiresAt)}`) : "no expiry"}
                                </span>
                                <RevokeEntitlementButton entitlementId={e.id} offeringName={e.offering.name} orgName={o.name} />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-end gap-2">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/portal/workspaces/${o.id}`}>Members</Link>
                        </Button>
                        {isClient && (
                          <>
                            <EntitlementDialog
                              orgId={o.id}
                              orgName={o.name}
                              offerings={offerings.filter((f) => !activeOfferingIds.has(f.id))}
                            />
                            {o.status === "ACTIVE" && (
                              <SupportAccessDialog
                                organisations={[{ id: o.id, name: o.name }]}
                                defaultOrganisationId={o.id}
                                minutes={SUPPORT_ACCESS_MINUTES}
                                triggerLabel="Support access"
                                triggerVariant="outline"
                              />
                            )}
                            <OrgStatusButton orgId={o.id} name={o.name} status={o.status} />
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager basePath="/portal/admin/organisations" params={params} cursor={query.cursor} nextCursor={page.nextCursor} label="organisations" />
    </div>
  );
}

async function ApprovalsTab({ actor, params }: { actor: AuthedActor; params: Params }) {
  const parsed = paginationSchema.safeParse({ cursor: params.cursor });
  const pageQuery = parsed.success ? parsed.data : paginationSchema.parse({});
  const page = await listEmployeeApprovals(actor, pageQuery);
  return (
    <div className="grid gap-4">
      <Notice>
        Employee access requires a verified <strong>@{page.domain}</strong> identity and an
        administrator&apos;s approval. Approval unlocks employee-only areas; it never grants an administrator role.
      </Notice>
      {page.items.length === 0 ? (
        <EmptyState icon={UserCheck} title="No pending employee approvals" description="New requests from verified employee identities will appear here." />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requester</TableHead>
                <TableHead>Identity checks</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="text-right">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((m) => {
                const e = m.eligibility;
                const reason = m.isSelf
                  ? "You cannot decide your own request."
                  : !e.verified
                    ? "Email not verified yet."
                    : !e.onDomain
                      ? `Not an @${e.domain} address.`
                      : undefined;
                return (
                  <TableRow key={m.id} className="align-top">
                    <TableCell className="max-w-64 whitespace-normal">
                      <p className="font-medium text-brand-ink">{m.user.name}</p>
                      <p className="break-all text-xs text-muted-foreground">{m.user.email}</p>
                      {m.user.title && <p className="text-xs text-muted-foreground">{m.user.title}</p>}
                      <p className="text-[0.7rem] text-muted-foreground">
                        {m.organisation.name} · requested role {m.role.toLowerCase()}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge tone={e.verified ? "success" : "warning"} label={e.verified ? "Email verified" : "Unverified"} />
                        <StatusBadge tone={e.onDomain ? "success" : "danger"} label={e.onDomain ? `@${e.domain}` : "Other domain"} />
                        {m.user.status !== "ACTIVE" && <StatusBadge status={m.user.status} />}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDateTime(m.createdAt)}</TableCell>
                    <TableCell>
                      {m.isSelf ? (
                        <p className="text-right text-xs text-muted-foreground">{reason}</p>
                      ) : (
                        <ApprovalButtons membershipId={m.id} name={m.user.name} eligible={e.eligible && m.user.status === "ACTIVE"} ineligibleReason={reason} />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager basePath="/portal/admin/organisations" params={{ tab: "approvals" }} cursor={pageQuery.cursor} nextCursor={page.nextCursor} label="approvals" />
    </div>
  );
}

async function SupportTab({ actor }: { actor: AuthedActor }) {
  const [{ active, history }, clientOrgs] = await Promise.all([listSupportAccess(actor), listClientOrganisationOptions(actor)]);
  const now = new Date();
  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Notice title="Explicit authorisation, not a broad role">
          Portal administrators cannot read a client&apos;s private content by default. A support-access grant is personal, lasts{" "}
          {SUPPORT_ACCESS_MINUTES} minutes, requires a reason, is recorded in the audit log and notifies the client&apos;s workspace
          administrators.
        </Notice>
        <div className="shrink-0">
          <SupportAccessDialog organisations={clientOrgs} minutes={SUPPORT_ACCESS_MINUTES} />
        </div>
      </div>

      <section className="grid gap-3" aria-labelledby="support-active">
        <h2 id="support-active" className="font-semibold text-brand-ink">
          Active grants
        </h2>
        {active.length === 0 ? (
          <EmptyState icon={KeyRound} title="No active support access" description="Nobody currently holds support access to a client organisation." />
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Grantee</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((g) => (
                  <TableRow key={g.id} className="align-top">
                    <TableCell className="font-medium text-brand-ink">{g.organisation.name}</TableCell>
                    <TableCell className="text-xs">
                      {g.grantee.name} {g.mine && <span className="text-muted-foreground">(you)</span>}
                      <p className="text-muted-foreground">{g.grantee.email}</p>
                    </TableCell>
                    <TableCell className="max-w-80 whitespace-pre-wrap text-xs">{g.reason}</TableCell>
                    <TableCell className="text-xs">
                      {fmtDateTime(g.expiresAt)}
                      <p className="text-muted-foreground">in {formatDistanceToNow(g.expiresAt, { includeSeconds: false })}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <RevokeSupportButton grantId={g.id} orgName={g.organisation.name} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="support-history">
        <h2 id="support-history" className="font-semibold text-brand-ink">
          Recent history
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No expired or revoked grants yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Grantee</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Ended</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((g) => (
                  <TableRow key={g.id} className="align-top">
                    <TableCell>{g.organisation.name}</TableCell>
                    <TableCell className="text-xs">{g.grantee.name}</TableCell>
                    <TableCell className="max-w-80 whitespace-pre-wrap text-xs">{g.reason}</TableCell>
                    <TableCell className="text-xs">{fmtDateTime(g.createdAt)}</TableCell>
                    <TableCell className="text-xs">
                      {g.revokedAt && g.revokedAt < g.expiresAt ? (
                        <>Revoked {fmtDateTime(g.revokedAt)}</>
                      ) : (
                        <>Expired {fmtDateTime(g.expiresAt < now ? g.expiresAt : g.revokedAt)}</>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

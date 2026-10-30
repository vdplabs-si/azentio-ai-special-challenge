import "server-only";
import Link from "next/link";
import { ArrowRight, FolderKanban, LifeBuoy, Megaphone, Pin, Users } from "lucide-react";
import type { AuthedActor } from "@/lib/authz/actor";
import { canAssignMembershipRole, canContributeInOrg } from "@/lib/authz/permissions";
import { env } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Notice, StatTile } from "@/components/portal/page";
import { FilterBar } from "@/components/portal/collab/filter-bar";
import {
  DeleteWorkspaceDialog,
  InviteMemberDialog,
  LeaveWorkspaceButton,
  MemberActions,
  RevokeInvitationButton,
  WorkspaceSettingsForm,
} from "@/components/portal/collab/workspace-actions";
import {
  DeleteAnnouncementButton,
  NewAnnouncementDialog,
  NewTicketDialog,
  TicketStatusSelect,
} from "@/components/portal/collab/workspace-content";
import { UploadDocumentButton } from "@/components/portal/collab/documents-actions";
import { DocumentsTable } from "@/components/portal/collab/documents-table";
import {
  CursorPager,
  DueDate,
  EnumBadge,
  Person,
  ProgressMeter,
  PlainText,
  RelativeTime,
  SectionHeading,
  ToneBadge,
} from "@/components/portal/collab/ui";
import {
  INVITATION_STATUS_LABEL,
  INVITATION_STATUS_TONE,
  MEMBERSHIP_ROLE_LABEL,
  MEMBERSHIP_STATUS_LABEL,
  MEMBERSHIP_STATUS_TONE,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUS_TONE,
  TICKET_STATUS_LABEL,
  TICKET_STATUS_TONE,
} from "@/components/portal/collab/labels";
import {
  INVITATION_STATUSES,
  MEMBERSHIP_ROLES,
  MEMBERSHIP_STATUSES,
  TICKET_STATUSES,
} from "@/components/portal/collab/schemas";
import { formatDate, formatDateTime } from "@/components/portal/collab/dates";
import { hrefWith, oneOf, param, type SearchParamsRecord } from "@/components/portal/collab/url";
import type { WorkspaceDetail } from "@/server/services/workspaces";
import { listInvitations, listMembers } from "@/server/services/workspaces";
import { listAnnouncements } from "@/server/services/announcements";
import { listProjects } from "@/server/services/projects";
import { listWorkspaceDocuments } from "@/server/services/documents";
import { listTickets } from "@/server/services/support-tickets";

type Ctx = { actor: AuthedActor; detail: WorkspaceDetail; sp: SearchParamsRecord; basePath: string };
const cursorOf = (sp: SearchParamsRecord) => {
  const c = param(sp, "cursor");
  return c && c.length <= 64 ? c : undefined;
};

// ── Overview ───────────────────────────────────────────────────────────────────

export async function OverviewTab({ actor, detail }: Ctx) {
  const { workspace: ws, permissions: perms } = detail;
  if (!perms.isMember) {
    return (
      <div className="grid gap-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Active members" value={ws.memberCount} href={`/portal/workspaces/${ws.id}?tab=members`} />
          <StatTile label="Type" value={ws.type === "INTERNAL" ? "Internal" : "Client"} />
          <StatTile label="Created" value={formatDate(ws.createdAt)} />
        </div>
        <Notice title="Private workspace content">
          You can manage membership{ws.type === "CLIENT" ? ", support tickets" : ""} and settings for this workspace. Its projects, documents and
          announcements are private to its members; viewing them requires membership or an explicit, time-boxed support-access grant.
        </Notice>
      </div>
    );
  }
  const [announcements, projects] = await Promise.all([
    listAnnouncements(actor, ws.id, { limit: 10 }),
    listProjects(actor, { workspaceId: ws.id, limit: 6 }),
  ]);
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section>
        <SectionHeading
          title="Announcements"
          description="Pinned announcements stay at the top."
          actions={announcements.canManage ? <NewAnnouncementDialog workspaceId={ws.id} /> : undefined}
        />
        {announcements.items.length === 0 ? (
          <EmptyState icon={Megaphone} title="No announcements" description={announcements.canManage ? "Share news or guidance with everyone in this workspace." : "Workspace administrators post updates here."} />
        ) : (
          <ul className="grid gap-3">
            {announcements.items.map((a) => (
              <li key={a.id}>
                <Card size="sm" className={a.pinned ? "ring-brand-green/50" : undefined}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-brand-ink">
                        {a.pinned && <Pin className="size-4 text-brand-green" aria-label="Pinned" />}
                        {a.title}
                      </CardTitle>
                      {announcements.canManage && <DeleteAnnouncementButton announcementId={a.id} title={a.title} />}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {a.author.name} · <RelativeTime value={a.createdAt} />
                    </p>
                  </CardHeader>
                  <CardContent>
                    <PlainText body={a.body} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <SectionHeading
          title="Projects"
          description={`${ws.activeProjectCount ?? 0} active`}
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href={`/portal/projects?workspaceId=${ws.id}`}>
                All projects <ArrowRight aria-hidden />
              </Link>
            </Button>
          }
        />
        {projects.items.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description={canContributeInOrg(actor, ws.id) ? "Create a project from the Projects page." : "Projects you can view will appear here."}
          />
        ) : (
          <ul className="grid gap-3">
            {projects.items.map((p) => (
              <li key={p.id}>
                <Link href={`/portal/projects/${p.id}`} className="block rounded-lg border bg-card p-4 transition-colors hover:border-brand-green/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-brand-ink">{p.name}</p>
                    <EnumBadge value={p.status} labels={PROJECT_STATUS_LABEL} tones={PROJECT_STATUS_TONE} />
                  </div>
                  <div className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_auto]">
                    <ProgressMeter {...p.progress} />
                    <DueDate dueAt={p.dueAt} overdue={p.isOverdue} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ── Members ────────────────────────────────────────────────────────────────────

export async function MembersTab({ actor, detail, sp, basePath }: Ctx) {
  const { workspace: ws, permissions: perms } = detail;
  const status = perms.canManageMembers ? oneOf(param(sp, "status"), MEMBERSHIP_STATUSES) : undefined;
  const q = param(sp, "q")?.slice(0, 100) || undefined;
  const cursor = cursorOf(sp);
  const page = await listMembers(actor, ws.id, { limit: 50, cursor, status, q });
  const assignable = MEMBERSHIP_ROLES.filter((r) => canAssignMembershipRole(actor, ws.id, r));
  const canInvite = perms.canManageMembers && (ws.type === "CLIENT" || perms.isPortalAdmin);
  const myRole = perms.myRole;

  return (
    <section>
      <SectionHeading
        title="Members"
        description={perms.canManageMembers ? "Directory with membership states. Changes are audited and the person is notified." : "People with active access to this workspace."}
        actions={
          <>
            {perms.isMember && ws.type === "CLIENT" && myRole !== null && (
              <LeaveWorkspaceButton workspaceId={ws.id} userId={actor.user.id} workspaceName={ws.name} />
            )}
            {canInvite && <InviteMemberDialog workspaceId={ws.id} roles={assignable} workspaceType={ws.type} />}
          </>
        }
      />
      <div className="mb-4">
        <FilterBar
          searchPlaceholder="Search name or email"
          filters={
            perms.canManageMembers
              ? [{ key: "status", label: "Status", allLabel: "All states", options: MEMBERSHIP_STATUSES.map((s) => ({ value: s, label: MEMBERSHIP_STATUS_LABEL[s]! })) }]
              : []
          }
        />
      </div>
      {page.items.length === 0 ? (
        <EmptyState icon={Users} title="No members found" description="Try a different search or filter." />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                {perms.canManageMembers && <TableHead className="text-right">Manage</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((m) => {
                const self = m.user.id === actor.user.id;
                const manageable = perms.canManageMembers && !self && canAssignMembershipRole(actor, ws.id, m.role);
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Person name={m.user.name} email={m.user.email} image={m.user.image} />
                        {self && <ToneBadge tone="info">You</ToneBadge>}
                      </div>
                    </TableCell>
                    <TableCell>{MEMBERSHIP_ROLE_LABEL[m.role]}</TableCell>
                    <TableCell>
                      <EnumBadge value={m.status} labels={MEMBERSHIP_STATUS_LABEL} tones={MEMBERSHIP_STATUS_TONE} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{formatDate(m.termsAcceptedAt ?? m.createdAt)}</TableCell>
                    {perms.canManageMembers && (
                      <TableCell className="text-right">
                        {manageable ? (
                          <MemberActions
                            workspaceId={ws.id}
                            member={{ userId: m.user.id, name: m.user.name, role: m.role, status: m.status }}
                            roles={assignable}
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground">{self ? "You can't change your own access" : "Requires higher role"}</span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <CursorPager
        isFirstPage={!cursor}
        firstHref={hrefWith(basePath, sp, { cursor: undefined })}
        nextHref={page.nextCursor ? hrefWith(basePath, sp, { cursor: page.nextCursor }) : null}
      />
    </section>
  );
}

// ── Invitations ────────────────────────────────────────────────────────────────

export async function InvitationsTab({ actor, detail, sp, basePath }: Ctx) {
  const { workspace: ws, permissions: perms } = detail;
  const status = oneOf(param(sp, "status"), INVITATION_STATUSES);
  const cursor = cursorOf(sp);
  const page = await listInvitations(actor, ws.id, { limit: 50, cursor, status });
  const assignable = MEMBERSHIP_ROLES.filter((r) => canAssignMembershipRole(actor, ws.id, r));
  const canInvite = perms.canManageMembers && (ws.type === "CLIENT" || perms.isPortalAdmin);
  return (
    <section>
      <SectionHeading
        title="Invitations"
        description="Single-use links that expire after 7 days. Only pending invitations can be revoked."
        actions={canInvite ? <InviteMemberDialog workspaceId={ws.id} roles={assignable} workspaceType={ws.type} /> : undefined}
      />
      <div className="mb-4">
        <FilterBar
          showSearch={false}
          filters={[{ key: "status", label: "Status", allLabel: "All invitations", options: INVITATION_STATUSES.map((s) => ({ value: s, label: INVITATION_STATUS_LABEL[s]! })) }]}
        />
      </div>
      {page.items.length === 0 ? (
        <EmptyState title="No invitations" description={canInvite ? "Invite people by email from this tab or the Members tab." : undefined} />
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Invited by</TableHead>
                <TableHead className="hidden md:table-cell">Sent</TableHead>
                <TableHead className="hidden lg:table-cell">Expires / accepted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium text-brand-ink">{i.email}</TableCell>
                  <TableCell>{MEMBERSHIP_ROLE_LABEL[i.role]}</TableCell>
                  <TableCell>
                    <EnumBadge value={i.status} labels={INVITATION_STATUS_LABEL} tones={INVITATION_STATUS_TONE} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{i.invitedBy.name}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{formatDateTime(i.createdAt)}</TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {i.status === "ACCEPTED" ? `Accepted ${formatDate(i.acceptedAt)}` : formatDateTime(i.expiresAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    {i.status === "PENDING" ? <RevokeInvitationButton workspaceId={ws.id} invitationId={i.id} email={i.email} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <CursorPager
        isFirstPage={!cursor}
        firstHref={hrefWith(basePath, sp, { cursor: undefined })}
        nextHref={page.nextCursor ? hrefWith(basePath, sp, { cursor: page.nextCursor }) : null}
      />
    </section>
  );
}

// ── Documents (workspace-level) ───────────────────────────────────────────────

export async function WorkspaceDocumentsTab({ actor, detail, sp, basePath }: Ctx) {
  const { workspace: ws } = detail;
  const cursor = cursorOf(sp);
  const page = await listWorkspaceDocuments(actor, ws.id, { limit: 50, cursor });
  return (
    <section>
      <SectionHeading
        title="Workspace documents"
        description="Files shared with the whole workspace. Project files live in each project's Documents tab."
        actions={page.canUpload ? <UploadDocumentButton workspaceId={ws.id} maxMb={env().MAX_UPLOAD_MB} /> : undefined}
      />
      <DocumentsTable documents={page.items} emptyHint={page.canUpload ? "Upload a file to share it with every member of this workspace." : "Files shared with this workspace will appear here."} />
      <CursorPager
        isFirstPage={!cursor}
        firstHref={hrefWith(basePath, sp, { cursor: undefined })}
        nextHref={page.nextCursor ? hrefWith(basePath, sp, { cursor: page.nextCursor }) : null}
      />
    </section>
  );
}

// ── Support ────────────────────────────────────────────────────────────────────

export async function SupportTab({ actor, detail, sp, basePath }: Ctx) {
  const { workspace: ws, permissions: perms } = detail;
  const status = oneOf(param(sp, "status"), TICKET_STATUSES);
  const cursor = cursorOf(sp);
  const page = await listTickets(actor, ws.id, { limit: 25, cursor, status });
  return (
    <section>
      <SectionHeading
        title="Support"
        description="Tickets go to the Azentio support team and are visible to members of this workspace."
        actions={perms.canCreateTicket ? <NewTicketDialog workspaceId={ws.id} /> : undefined}
      />
      <div className="mb-4">
        <FilterBar
          showSearch={false}
          filters={[{ key: "status", label: "Status", allLabel: "All tickets", options: TICKET_STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_LABEL[s]! })) }]}
        />
      </div>
      {page.items.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="No support tickets" description={perms.canCreateTicket ? "Open a ticket if you need help from Azentio." : undefined} />
      ) : (
        <ul className="grid gap-3">
          {page.items.map((t) => (
            <li key={t.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-brand-ink">{t.subject}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t.author.name} · opened {formatDateTime(t.createdAt)}
                    {t.updatedAt.getTime() !== t.createdAt.getTime() && <> · updated <RelativeTime value={t.updatedAt} /></>}
                  </p>
                </div>
                {page.canUpdate ? (
                  <TicketStatusSelect ticketId={t.id} status={t.status} subject={t.subject} />
                ) : (
                  <EnumBadge value={t.status} labels={TICKET_STATUS_LABEL} tones={TICKET_STATUS_TONE} />
                )}
              </div>
              <details className="mt-3 group">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-brand-ink">Show details</summary>
                <PlainText body={t.body} className="mt-2 rounded-md bg-muted/50 p-3" />
              </details>
            </li>
          ))}
        </ul>
      )}
      <CursorPager
        isFirstPage={!cursor}
        firstHref={hrefWith(basePath, sp, { cursor: undefined })}
        nextHref={page.nextCursor ? hrefWith(basePath, sp, { cursor: page.nextCursor }) : null}
      />
    </section>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────────

export function SettingsTab({ detail }: Ctx) {
  const { workspace: ws, permissions: perms } = detail;
  return (
    <div className="grid gap-10">
      {perms.canEdit && (
        <section>
          <SectionHeading title="Workspace settings" description="Changes are audited." />
          <WorkspaceSettingsForm workspace={ws} canEditSlug={perms.canEditSlug} />
        </section>
      )}
      <section className="rounded-lg border border-destructive/30 p-5">
        <h2 className="text-lg font-semibold text-brand-ink">Danger zone</h2>
        {ws.type === "INTERNAL" ? (
          <p className="mt-1 text-sm text-muted-foreground">The internal Azentio workspace cannot be deleted.</p>
        ) : perms.canDelete ? (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-sm text-muted-foreground">
              Permanently delete this workspace and everything in it. You will be asked to type the workspace name to confirm.
            </p>
            <DeleteWorkspaceDialog workspaceId={ws.id} name={ws.name} />
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Only the workspace owner or a portal administrator can delete this workspace.</p>
        )}
      </section>
    </div>
  );
}

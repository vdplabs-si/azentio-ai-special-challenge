import type { Metadata } from "next";
import { requireUser } from "@/lib/authz/actor";
import { PageHeader } from "@/components/portal/page";
import { Meta, TabNav, ToneBadge } from "@/components/portal/collab/ui";
import { MEMBERSHIP_ROLE_LABEL } from "@/components/portal/collab/labels";
import { formatDate } from "@/components/portal/collab/dates";
import { orNotFound } from "@/components/portal/collab/page-utils";
import { param, type SearchParamsRecord } from "@/components/portal/collab/url";
import {
  InvitationsTab,
  MembersTab,
  OverviewTab,
  SettingsTab,
  SupportTab,
  WorkspaceDocumentsTab,
} from "@/components/portal/collab/workspace-tabs";
import { getWorkspace } from "@/server/services/workspaces";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Workspace" };

type TabKey = "overview" | "members" | "invitations" | "documents" | "support" | "settings";

export default async function WorkspacePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParamsRecord> }) {
  const [{ id }, sp, actor] = await Promise.all([params, searchParams, requireUser()]);
  const detail = await orNotFound(getWorkspace(actor, id));
  const { workspace: ws, permissions: perms } = detail;
  const basePath = `/portal/workspaces/${ws.id}`;

  const tabs: { key: TabKey; label: string; count?: number | null }[] = [
    { key: "overview", label: "Overview" },
    ...(perms.canViewMembers ? [{ key: "members" as const, label: "Members", count: ws.memberCount }] : []),
    ...(perms.canManageMembers ? [{ key: "invitations" as const, label: "Invitations" }] : []),
    ...(perms.isMember ? [{ key: "documents" as const, label: "Documents" }] : []),
    ...(perms.canViewSupport ? [{ key: "support" as const, label: "Support" }] : []),
    ...(perms.canEdit || perms.canDelete ? [{ key: "settings" as const, label: "Settings" }] : []),
  ];
  const requested = param(sp, "tab");
  const active: TabKey = tabs.find((t) => t.key === requested)?.key ?? "overview";
  // Pagers rebuild URLs from basePath + current params; keep the active tab in them.
  const tabCtx = { actor, detail, basePath, sp: { ...sp, tab: active } };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={ws.type === "INTERNAL" ? "Internal workspace" : "Client workspace"}
        title={ws.name}
        description={ws.description ?? undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            {perms.myRole ? <ToneBadge tone="brand">Your role: {MEMBERSHIP_ROLE_LABEL[perms.myRole]}</ToneBadge> : <ToneBadge tone="neutral">Not a member</ToneBadge>}
            {perms.isPortalAdmin && <ToneBadge tone="info">Portal admin</ToneBadge>}
            {ws.status === "SUSPENDED" && <ToneBadge tone="warning">Suspended</ToneBadge>}
          </div>
        }
      />
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Meta label="Slug">
          <span className="font-mono text-xs">{ws.slug}</span>
        </Meta>
        <Meta label="Industry">{ws.industry ?? "—"}</Meta>
        <Meta label="Region">{ws.region ?? "—"}</Meta>
        <Meta label="Created">{formatDate(ws.createdAt)}</Meta>
      </dl>
      <TabNav
        label="Workspace sections"
        active={active}
        tabs={tabs.map((t) => ({ ...t, href: t.key === "overview" ? basePath : `${basePath}?tab=${t.key}` }))}
      />
      <div>
        {active === "overview" && <OverviewTab {...tabCtx} />}
        {active === "members" && <MembersTab {...tabCtx} />}
        {active === "invitations" && <InvitationsTab {...tabCtx} />}
        {active === "documents" && <WorkspaceDocumentsTab {...tabCtx} />}
        {active === "support" && <SupportTab {...tabCtx} />}
        {active === "settings" && <SettingsTab {...tabCtx} />}
      </div>
    </div>
  );
}

import Link from "next/link";
import type { Metadata } from "next";
import { Lock, Trophy, Users } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { PageHeader } from "@/components/portal/page";
import { DueDate, EnumBadge, Meta, Person, ProgressMeter, TabNav, ToneBadge } from "@/components/portal/collab/ui";
import { PROJECT_ROLE_LABEL, PROJECT_STATUS_LABEL, PROJECT_STATUS_TONE, VISIBILITY_HINT, VISIBILITY_LABEL } from "@/components/portal/collab/labels";
import { formatDate } from "@/components/portal/collab/dates";
import { orNotFound } from "@/components/portal/collab/page-utils";
import { param, type SearchParamsRecord } from "@/components/portal/collab/url";
import { ActivityTab, DiscussionsTab, DocumentsTab, MembersTab, SettingsTab, TasksTab } from "@/components/portal/collab/project-tabs";
import { TeamMembershipButton } from "@/components/portal/collab/project-actions";
import { getProjectDetail } from "@/server/services/projects";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Project" };

type TabKey = "tasks" | "discussions" | "documents" | "members" | "activity" | "settings";

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParamsRecord> }) {
  const [{ id }, sp, actor] = await Promise.all([params, searchParams, requireUser()]);
  const detail = await orNotFound(getProjectDetail(actor, id));
  const { project, access } = detail;
  const basePath = `/portal/projects/${project.id}`;
  const isTeam = project.kind === "HACKATHON_TEAM";
  const teamOpen = Boolean(project.hackathonEvent?.registrationOpen && project.hackathonEvent.endsAt > new Date());

  const tabs: { key: TabKey; label: string; count?: number | null }[] = [
    { key: "tasks", label: "Tasks", count: project.progress.total },
    { key: "discussions", label: "Discussions" },
    { key: "documents", label: "Documents" },
    { key: "members", label: isTeam ? "Team" : "Members", count: project._count.members },
    { key: "activity", label: "Activity" },
    ...(access.manage ? [{ key: "settings" as const, label: "Settings" }] : []),
  ];
  const requested = param(sp, "tab");
  const active: TabKey = tabs.find((t) => t.key === requested)?.key ?? "tasks";
  const ctx = { actor, detail, basePath, sp: { ...sp, tab: active } };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isTeam ? `Hackathon team · ${project.hackathonEvent?.name ?? "Event"}` : project.organisation.name}
        title={project.name}
        description={project.description ? <span className="line-clamp-3 whitespace-pre-wrap">{project.description}</span> : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <EnumBadge value={project.status} labels={PROJECT_STATUS_LABEL} tones={PROJECT_STATUS_TONE} />
            <ToneBadge tone="neutral">
              {project.visibility === "PRIVATE" ? <Lock aria-hidden /> : <Users aria-hidden />}
              <span title={VISIBILITY_HINT[project.visibility]}>{VISIBILITY_LABEL[project.visibility]}</span>
            </ToneBadge>
            {isTeam && (
              <ToneBadge tone="info">
                <Trophy aria-hidden /> Team
              </ToneBadge>
            )}
            {detail.myProjectRole && <ToneBadge tone="brand">You: {PROJECT_ROLE_LABEL[detail.myProjectRole]}</ToneBadge>}
            {!access.contribute && <ToneBadge tone="neutral">View only</ToneBadge>}
            {isTeam && (
              <TeamMembershipButton projectId={project.id} joined={detail.myProjectRole !== null} isOwner={project.ownerId === actor.user.id} open={teamOpen} />
            )}
          </div>
        }
      />
      <div className="grid gap-6 rounded-lg border bg-card p-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Meta label="Workspace">
            <Link href={`/portal/workspaces/${project.organisation.id}`} className="hover:underline">
              {project.organisation.name}
            </Link>
          </Meta>
          <Meta label="Owner">
            <Person name={project.owner.name} />
          </Meta>
          <Meta label="Start">{formatDate(project.startsAt)}</Meta>
          <Meta label="Deadline">
            <DueDate dueAt={project.dueAt} overdue={project.isOverdue} className="text-sm" />
          </Meta>
        </dl>
        <div className="grid content-center gap-2">
          <ProgressMeter {...project.progress} />
          {project.overdueTasks > 0 && (
            <p className="text-xs font-medium text-destructive">
              {project.overdueTasks} overdue {project.overdueTasks === 1 ? "task" : "tasks"}
            </p>
          )}
        </div>
      </div>
      <TabNav
        label="Project sections"
        active={active}
        tabs={tabs.map((t) => ({ ...t, href: t.key === "tasks" ? basePath : `${basePath}?tab=${t.key}` }))}
      />
      <div>
        {active === "tasks" && <TasksTab {...ctx} />}
        {active === "discussions" && <DiscussionsTab {...ctx} />}
        {active === "documents" && <DocumentsTab {...ctx} />}
        {active === "members" && <MembersTab {...ctx} />}
        {active === "activity" && <ActivityTab {...ctx} />}
        {active === "settings" && <SettingsTab {...ctx} />}
      </div>
    </div>
  );
}

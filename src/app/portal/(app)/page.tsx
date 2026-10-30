import type { Metadata } from "next";
import { requireUser } from "@/lib/authz/actor";
import { getDashboard } from "@/server/services/dashboard";
import { Notice, PageHeader, StatTile } from "@/components/portal/page";
import { Badge } from "@/components/ui/badge";
import {
  ActivityPanel, AssignedIdeasPanel, ClientIdeasPanel, ContributionsPanel, DemonstrationsPanel, EmployeeQuickLinks,
  EntitlementsPanel, HackathonPanel, LearningWorkPanel, PendingPanel, ProfileCard, ProjectsPanel, SessionsPanel, TasksPanel,
} from "@/components/portal/dashboard/sections";
import { enumLabel } from "@/components/portal/dashboard/widgets";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard" };

/** Persona-aware dashboard — every figure is computed from records the actor may see. */
export default async function DashboardPage() {
  const actor = await requireUser();
  const data = await getDashboard(actor);
  const org = actor.activeOrganisation;
  const firstName = actor.user.name.split(/\s+/)[0] || actor.user.name;
  const roles = [...actor.roles];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow={data.persona === "employee" ? "Employee dashboard" : data.persona === "client" ? "Client dashboard" : "Dashboard"}
        title={`Welcome back, ${firstName}`}
        description={
          <span className="flex flex-wrap items-center gap-1.5">
            {org ? (
              <>
                <span>
                  Working in <strong className="text-brand-ink">{org.organisation.name}</strong>
                </span>
                <Badge variant="secondary">{org.organisation.type === "INTERNAL" ? "Internal" : "Client"}</Badge>
                <Badge variant="outline">{enumLabel(org.role)}</Badge>
              </>
            ) : (
              <span>No active workspace selected.</span>
            )}
            {roles.map((r) => (
              <Badge key={r} variant="outline" className="border-brand-navy/30">
                {enumLabel(r)}
              </Badge>
            ))}
          </span>
        }
      />

      <Notice title="Summary">{data.summary}</Notice>

      <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Open tasks" value={data.tasks.openCount} href="/portal/tasks" />
        <StatTile label="Overdue" value={data.tasks.overdueCount} hint={data.tasks.overdueCount ? "Past due date" : "None overdue"} />
        <StatTile label="Due in 7 days" value={data.tasks.dueSoonCount} />
        <StatTile label="Active projects" value={data.projects.count} href="/portal/projects" />
        <StatTile label="Unread notifications" value={data.unread} href="/portal/notifications" />
      </section>

      {data.persona === "employee" && <EmployeeQuickLinks data={data} />}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid content-start gap-6 lg:col-span-2">
          <TasksPanel data={data} />
          <ProjectsPanel data={data} />
          {data.persona === "employee" ? (
            <>
              <AssignedIdeasPanel data={data} />
              <HackathonPanel data={data} />
            </>
          ) : (
            <>
              <EntitlementsPanel data={data} organisationName={org?.organisation.name ?? null} />
              <DemonstrationsPanel data={data} />
              {data.isParticipant && <ClientIdeasPanel data={data} />}
            </>
          )}
          <ActivityPanel data={data} />
        </div>
        <div className="grid content-start gap-6">
          <ProfileCard
            name={actor.user.name}
            email={actor.user.email}
            title={actor.user.title}
            organisation={org ? { name: org.organisation.name, type: org.organisation.type } : null}
            orgRole={org?.role ?? null}
            roles={roles}
          />
          <PendingPanel data={data} />
          {data.persona === "employee" && <LearningWorkPanel data={data} />}
          <SessionsPanel data={data} title={data.persona === "employee" ? "Live & upcoming sessions" : "Sessions for you"} />
          {data.isParticipant && <ContributionsPanel data={data} />}
        </div>
      </div>
    </div>
  );
}

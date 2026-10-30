import type { Metadata } from "next";
import { format } from "date-fns";
import { requireUser } from "@/lib/authz/actor";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/portal/page";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Panel, PanelEmpty, enumLabel } from "@/components/portal/dashboard/widgets";
import { PasswordForm, ProfileDetailsForm } from "@/components/portal/profile/profile-forms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Profile" };

const PROVIDER_LABEL: Record<string, string> = { google: "Google", github: "GitHub" };
const fmt = (d: Date) => format(d, "d MMM yyyy");

/** The signed-in user's own profile, sign-in methods, memberships and platform grants. */
export default async function ProfilePage() {
  const actor = await requireUser();
  const me = actor.user.id;
  const [user, memberships, grants] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: me },
      select: {
        name: true,
        email: true,
        title: true,
        createdAt: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        passwordHash: true,
        accounts: { select: { id: true, provider: true, email: true, createdAt: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    db.membership.findMany({
      where: { userId: me },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        organisation: { select: { id: true, name: true, type: true, status: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.roleGrant.findMany({
      where: { userId: me, revokedAt: null },
      select: { id: true, role: true, reason: true, createdAt: true, grantedBy: { select: { name: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const hasPassword = Boolean(user.passwordHash);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description={
          <>
            {user.email} · {user.emailVerifiedAt ? "email verified" : "email not verified"} · member since {fmt(user.createdAt)}
            {user.lastLoginAt ? ` · last sign-in ${format(user.lastLoginAt, "d MMM yyyy, HH:mm")}` : ""}
            {actor.isEmployee ? " · verified Azentio employee" : ""}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Your details">
          <ProfileDetailsForm name={user.name} title={user.title} />
        </Panel>
        <Panel
          title={hasPassword ? "Change password" : "Set a password"}
          description={hasPassword ? "You will need your current password." : "Your account currently signs in without a password (email code or a linked provider)."}
        >
          <PasswordForm hasPassword={hasPassword} />
        </Panel>
      </div>

      <Panel title="Sign-in methods" description="Linked identity providers store your identity only — no provider access tokens are kept.">
        <ul className="grid gap-2 text-sm">
          <li className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
            <span className="text-brand-ink">Email &amp; password</span>
            <Badge variant={hasPassword ? "secondary" : "outline"}>{hasPassword ? "Enabled" : "No password set"}</Badge>
          </li>
          {user.accounts.length === 0 ? (
            <li className="text-muted-foreground">No external providers are linked.</li>
          ) : (
            user.accounts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
                <span className="text-brand-ink">
                  {PROVIDER_LABEL[a.provider] ?? enumLabel(a.provider)}
                  {a.email && <span className="text-muted-foreground"> · {a.email}</span>}
                </span>
                <span className="text-xs text-muted-foreground">Linked {fmt(a.createdAt)}</span>
              </li>
            ))
          )}
        </ul>
      </Panel>

      <Panel title="Workspace memberships" description="Your role in each organisation. Only active memberships grant access.">
        {memberships.length === 0 ? (
          <PanelEmpty>You have no workspace memberships.</PanelEmpty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organisation</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.organisation.name}
                    {actor.activeOrganisation?.organisationId === m.organisation.id && (
                      <Badge variant="outline" className="ml-2">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{m.organisation.type === "INTERNAL" ? "Internal" : "Client"}</TableCell>
                  <TableCell>{enumLabel(m.role)}</TableCell>
                  <TableCell>
                    <Badge variant={m.status === "ACTIVE" ? "secondary" : "outline"}>{enumLabel(m.status)}</Badge>
                    {m.organisation.status === "SUSPENDED" && (
                      <Badge variant="destructive" className="ml-1">
                        Organisation suspended
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmt(m.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel title="Platform role grants" description="Explicit, audited grants. Employee status never implies administrative rights.">
        {grants.length === 0 ? (
          <PanelEmpty>You hold no platform roles.</PanelEmpty>
        ) : (
          <ul className="grid gap-2 text-sm">
            {grants.map((g) => (
              <li key={g.id} className="flex flex-wrap items-start justify-between gap-3 rounded-md border px-3 py-2">
                <div>
                  <Badge variant="outline">{enumLabel(g.role)}</Badge>
                  {g.reason && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{g.reason}</p>}
                </div>
                <span className="text-xs text-muted-foreground">
                  Granted {fmt(g.createdAt)}
                  {g.grantedBy ? ` by ${g.grantedBy.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

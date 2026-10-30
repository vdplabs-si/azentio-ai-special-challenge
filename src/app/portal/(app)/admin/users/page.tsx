import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserX } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import { listUsers, userListQuery } from "@/server/services/admin";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { Pager } from "@/components/portal/dashboard/pager";
import { FilterBar } from "@/components/portal/admin/filter-bar";
import { NativeSelect } from "@/components/portal/admin/native-select";
import { StatusBadge } from "@/components/portal/admin/status-badge";
import { flatParams, fmtDate, fmtDateTime, humanize } from "@/components/portal/admin/format";
import { GrantRoleDialog, RevokeGrantButton, UserStatusButton } from "@/components/portal/admin/user-actions";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Users & roles" };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireUser();
  if (!can.manageUsers(actor)) notFound();
  const params = flatParams(await searchParams);
  const parsed = userListQuery.safeParse(params);
  const query = parsed.success ? parsed.data : userListQuery.parse({});
  const page = await listUsers(actor, query);

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Users & roles"
        description="Account status and explicit platform grants. Workspace membership never confers platform roles, employee status never implies administrator rights, and nobody can change their own grants."
      />
      {!parsed.success && <Notice tone="warning">Some filters were invalid and have been ignored.</Notice>}

      <FilterBar action="/portal/admin/users" resetHref="/portal/admin/users">
        <div className="grid min-w-56 flex-1 gap-1.5">
          <Label htmlFor="user-q">Search</Label>
          <Input id="user-q" name="q" defaultValue={query.q ?? ""} placeholder="Name or email" maxLength={100} />
        </div>
        <div className="grid w-44 gap-1.5">
          <Label htmlFor="user-status">Status</Label>
          <NativeSelect id="user-status" name="status" defaultValue={query.status ?? ""}>
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="DEACTIVATED">Deactivated</option>
          </NativeSelect>
        </div>
      </FilterBar>

      {page.items.length === 0 ? (
        <EmptyState
          icon={UserX}
          title={query.q || query.status ? "No users match these filters" : "No users yet"}
          description={query.q || query.status ? "Try a different name, email or status." : "Users appear here once they register or accept an invitation."}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Memberships</TableHead>
                <TableHead>Platform roles</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((u) => (
                <TableRow key={u.id} className="align-top">
                  <TableCell className="max-w-64 whitespace-normal">
                    <p className="font-medium text-brand-ink">
                      {u.name} {u.isSelf && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                    </p>
                    <p className="break-all text-xs text-muted-foreground">{u.email}</p>
                    {u.title && <p className="text-xs text-muted-foreground">{u.title}</p>}
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">
                      {u.emailVerifiedAt ? "Email verified" : "Email not verified"} · Joined {fmtDate(u.createdAt)} · Last sign-in{" "}
                      {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "never"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={u.status} />
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {u.memberships.length === 0 ? (
                      <span className="text-xs text-muted-foreground">No memberships</span>
                    ) : (
                      <ul className="grid gap-1 text-xs">
                        {u.memberships.map((m) => (
                          <li key={m.id} className="flex flex-wrap items-center gap-1">
                            <span className="font-medium text-brand-ink">{m.organisation.name}</span>
                            <span className="text-muted-foreground">
                              {m.organisation.type === "INTERNAL" ? "internal" : "client"} · {m.role.toLowerCase()}
                            </span>
                            {m.status !== "ACTIVE" && <StatusBadge status={m.status} />}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell className="max-w-72 whitespace-normal">
                    {u.roleGrants.length === 0 ? (
                      <span className="text-xs text-muted-foreground">None</span>
                    ) : (
                      <ul className="grid gap-1.5">
                        {u.roleGrants.map((g) => (
                          <li key={g.id} className="text-xs">
                            <div className="flex items-center gap-1">
                              <Badge variant="outline">{humanize(g.role)}</Badge>
                              {g.revocable && <RevokeGrantButton grantId={g.id} role={g.role} name={u.name} />}
                            </div>
                            <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
                              {fmtDate(g.createdAt)}
                              {g.grantedBy ? ` by ${g.grantedBy.name}` : ""}
                              {g.reason ? ` — ${g.reason}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-end gap-2">
                      {u.status === "ACTIVE" && <GrantRoleDialog userId={u.id} name={u.name} roles={u.grantableRoles} />}
                      {u.canChangeStatus ? (
                        <UserStatusButton userId={u.id} name={u.name} status={u.status} />
                      ) : (
                        <span className="max-w-40 text-right text-[0.7rem] text-muted-foreground">
                          {u.isSelf ? "You cannot change your own account." : "Only a super administrator can change this account."}
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager basePath="/portal/admin/users" params={params} cursor={query.cursor} nextCursor={page.nextCursor} label="users" />
    </div>
  );
}

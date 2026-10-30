import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScrollText } from "lucide-react";
import { requireUser } from "@/lib/authz/actor";
import { can } from "@/lib/authz/permissions";
import { auditEntityTypes, auditQuery, listAuditEvents } from "@/server/services/admin";
import { EmptyState, Notice, PageHeader } from "@/components/portal/page";
import { Pager } from "@/components/portal/dashboard/pager";
import { FilterBar } from "@/components/portal/admin/filter-bar";
import { NativeSelect } from "@/components/portal/admin/native-select";
import { flatParams } from "@/components/portal/admin/format";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Audit log" };

const FILTER_KEYS = ["action", "entityType", "actor", "from", "to"] as const;

function MetadataCell({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-xs text-muted-foreground">—</span>;
  const compact = JSON.stringify(value);
  if (compact === "{}") return <span className="text-xs text-muted-foreground">—</span>;
  if (compact.length <= 80) return <code className="break-all text-[0.7rem] text-muted-foreground">{compact}</code>;
  return (
    <details className="text-[0.7rem]">
      <summary className="cursor-pointer text-muted-foreground">
        <code className="break-all">{compact.slice(0, 80)}…</code>
      </summary>
      <pre className="mt-1 max-h-60 max-w-96 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireUser();
  if (!can.viewAuditLog(actor)) notFound();
  const params = flatParams(await searchParams);
  const parsed = auditQuery.safeParse(params);
  const query = parsed.success ? parsed.data : auditQuery.parse({});
  const [page, entityTypes] = await Promise.all([listAuditEvents(actor, query), auditEntityTypes(actor)]);
  const filterParams = Object.fromEntries(FILTER_KEYS.filter((k) => parsed.success && params[k]).map((k) => [k, params[k]]));
  const filtered = Object.keys(filterParams).length > 0;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Administration"
        title="Audit log"
        description="Append-only record of privileged and sensitive actions: role grants, account and organisation status, entitlements, support access, moderation, publishing and more. Metadata never contains passwords or private content bodies."
      />
      {!parsed.success && <Notice tone="warning">Some filters were invalid and have been ignored.</Notice>}

      <FilterBar action="/portal/admin/audit" resetHref="/portal/admin/audit">
        <div className="grid w-48 gap-1.5">
          <Label htmlFor="audit-action">Action starts with</Label>
          <Input id="audit-action" name="action" defaultValue={parsed.success ? (query.action ?? "") : ""} placeholder="e.g. role. or support_access" maxLength={80} />
        </div>
        <div className="grid w-48 gap-1.5">
          <Label htmlFor="audit-entity">Entity type</Label>
          <NativeSelect id="audit-entity" name="entityType" defaultValue={parsed.success ? (query.entityType ?? "") : ""}>
            <option value="">Any entity</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid w-56 gap-1.5">
          <Label htmlFor="audit-actor">Actor email</Label>
          <Input id="audit-actor" name="actor" defaultValue={parsed.success ? (query.actor ?? "") : ""} placeholder="name@company.com" maxLength={200} />
        </div>
        <div className="grid w-40 gap-1.5">
          <Label htmlFor="audit-from">From</Label>
          <Input id="audit-from" name="from" type="date" defaultValue={parsed.success ? (params.from ?? "") : ""} />
        </div>
        <div className="grid w-40 gap-1.5">
          <Label htmlFor="audit-to">To (inclusive, UTC)</Label>
          <Input id="audit-to" name="to" type="date" defaultValue={parsed.success ? (params.to ?? "") : ""} />
        </div>
      </FilterBar>

      {page.items.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? "No audit events match these filters" : "No audit events yet"}
          description={filtered ? "Widen the date range or clear a filter." : "Privileged actions will be recorded here as they happen."}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time (UTC)</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Organisation</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.items.map((e) => (
                <TableRow key={e.id} className="align-top">
                  <TableCell className="text-xs tabular-nums">{e.createdAt.toISOString().slice(0, 16).replace("T", " ")}</TableCell>
                  <TableCell className="max-w-52 whitespace-normal text-xs">
                    {e.actor ? (
                      <>
                        <p className="font-medium text-brand-ink">{e.actor.name}</p>
                        <p className="break-all text-muted-foreground">{e.actor.email}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">System</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-[0.7rem]">
                      {e.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <p>{e.entityType}</p>
                    {e.entityId && <p className="font-mono text-[0.65rem] text-muted-foreground">{e.entityId}</p>}
                  </TableCell>
                  <TableCell className="text-xs">{e.organisation?.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <MetadataCell value={e.metadata} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pager basePath="/portal/admin/audit" params={filterParams} cursor={query.cursor} nextCursor={page.nextCursor} label="audit events" />
    </div>
  );
}

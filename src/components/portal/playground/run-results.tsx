import { ArrowDownRight, ArrowRight, ArrowUpRight, ListChecks, ScrollText } from "lucide-react";
import type { EngineResult, Metric } from "@/server/playground/engines/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { SyntheticLabel } from "./synthetic-label";
import { cellTone, formatDelta, formatValue } from "./format";

function MetricTile({ m }: { m: Metric }) {
  const numeric = typeof m.value === "number" && typeof m.before === "number";
  const delta = numeric ? (m.value as number) - (m.before as number) : 0;
  const favourable = !m.better || delta === 0 ? null : (m.better === "higher") === delta > 0;
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : ArrowRight;
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{m.label}</p>
      <p className={cn("mt-1 font-heading font-bold text-brand-ink", m.format === "text" ? "text-base leading-snug" : "text-2xl")}>
        {formatValue(m.value, m.format, m.unit)}
      </p>
      {m.before !== undefined && (
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span>
            {m.beforeLabel ?? "Before"}: <span className="font-medium text-brand-ink">{formatValue(m.before, m.format, m.unit)}</span>
          </span>
          {numeric && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                favourable === true && "text-success",
                favourable === false && "text-destructive",
              )}
            >
              <Icon className="size-3" aria-hidden />
              {formatDelta(m.before as number, m.value as number, m.format, m.unit)}
            </span>
          )}
        </p>
      )}
      {m.hint && <p className="mt-1 text-xs text-muted-foreground">{m.hint}</p>}
    </div>
  );
}

/** Presentational view of an engine result: summary, metrics, rows, explanation and evidence. */
export function RunResults({ result, runLabel }: { result: EngineResult; runLabel?: string }) {
  const { rows } = result;
  return (
    <section aria-labelledby="run-results-heading" className="grid gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="run-results-heading" className="text-lg font-semibold text-brand-ink">
          Simulated result
        </h2>
        {runLabel && <p className="text-xs text-muted-foreground">{runLabel}</p>}
      </div>
      <SyntheticLabel />
      <p className="rounded-lg border border-brand-navy/15 bg-brand-light px-4 py-3 text-sm leading-relaxed text-brand-ink">{result.summary}</p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {result.metrics.map((m) => (
          <MetricTile key={m.key} m={m} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rows.title}</CardTitle>
          <CardDescription>
            {rows.data.length} row{rows.data.length === 1 ? "" : "s"} · amounts in synthetic currency units (thousands)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.data.length === 0 ? (
            <p className="rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {rows.emptyMessage ?? "No rows."}
            </p>
          ) : (
            <div className="max-h-[28rem] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    {rows.columns.map((c) => (
                      <TableHead key={c.key} className={cn(c.format && c.format !== "text" && "text-right")}>
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.data.map((row, i) => (
                    <TableRow key={i}>
                      {rows.columns.map((c) => {
                        const v = row[c.key] ?? null;
                        const tone = cellTone(v);
                        return (
                          <TableCell
                            key={c.key}
                            className={cn(
                              c.format && c.format !== "text" ? "text-right tabular-nums" : "max-w-[22rem] whitespace-normal",
                              tone === "good" && "font-medium text-success",
                              tone === "bad" && "font-medium text-destructive",
                              tone === "warn" && "font-medium text-warning",
                            )}
                          >
                            {formatValue(v, c.format, c.unit)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="size-4 text-success" aria-hidden /> How to read this result
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
              {result.explanation.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScrollText className="size-4 text-success" aria-hidden /> Evidence and assumptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
              {result.evidence.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

import { Award } from "lucide-react";
import { RECOGNITIONS } from "@/content/site";

/** Verified 2026 recognitions (source: azentio.com). Do not add entries that are not on that list. */
export function RecognitionList({ headingLevel = "h3" }: { headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {RECOGNITIONS.map((r) => (
        <li key={`${r.title}-${r.detail}`} className="flex flex-col gap-3 rounded-lg border border-border bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <Award aria-hidden="true" className="size-5 text-success" />
            {r.product ? (
              <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-medium text-brand-ink">{r.product}</span>
            ) : null}
          </div>
          <Heading className="text-base font-semibold text-brand-ink">{r.title}</Heading>
          <p className="text-sm text-muted-foreground">{r.detail}</p>
        </li>
      ))}
    </ul>
  );
}

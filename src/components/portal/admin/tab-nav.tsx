import Link from "next/link";
import { cn } from "@/lib/utils";

/** Link-based tabs driven by a `tab` search parameter (server-rendered, shareable URLs). */
export function TabNav({
  basePath,
  current,
  tabs,
}: {
  basePath: string;
  current: string;
  tabs: { key: string; label: string; count?: number }[];
}) {
  return (
    <nav aria-label="Sections" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1 text-sm">
      {tabs.map((t) => {
        const active = t.key === current;
        return (
          <Link
            key={t.key}
            href={`${basePath}?tab=${t.key}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-background text-brand-ink shadow-sm" : "text-muted-foreground hover:text-brand-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-brand-green/25 text-brand-ink" : "bg-background/70")}>
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

import Link from "next/link";
import { cn } from "@/lib/utils";

/** Tabs between the submission queue and the reports queue (server-rendered links). */
export function ModerationNav({ active, queue, reports }: { active: "queue" | "reports"; queue: number; reports: number }) {
  const tabs = [
    { key: "queue", href: "/portal/moderation", label: "Submission queue", n: queue },
    { key: "reports", href: "/portal/moderation/reports", label: "Reports", n: reports },
  ] as const;
  return (
    <nav aria-label="Moderation" className="flex gap-1 border-b">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={active === t.key ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
            active === t.key ? "border-brand-navy text-brand-ink" : "border-transparent text-muted-foreground hover:text-brand-ink",
          )}
        >
          {t.label} <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">{t.n}</span>
        </Link>
      ))}
    </nav>
  );
}

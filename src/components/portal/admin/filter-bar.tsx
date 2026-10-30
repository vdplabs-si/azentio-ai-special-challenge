import type { ReactNode } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Plain GET filter form: submitting rewrites the search params (resetting the cursor). */
export function FilterBar({ action, children, hidden, resetHref }: { action: string; children: ReactNode; hidden?: Record<string, string>; resetHref?: string }) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3" role="search">
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {children}
      <div className="flex gap-2">
        <Button type="submit" size="lg">
          <Search aria-hidden /> Apply
        </Button>
        {resetHref && (
          <Button asChild type="button" variant="ghost" size="lg">
            <Link href={resetHref}>Reset</Link>
          </Button>
        )}
      </div>
    </form>
  );
}

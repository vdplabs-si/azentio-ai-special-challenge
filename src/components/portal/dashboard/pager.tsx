import Link from "next/link";
import { ChevronRight, ChevronsLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Cursor pagination controls for server-rendered lists. Preserves the current filters
 * (`params`) and swaps only the `cursor` parameter.
 */
export function Pager({
  basePath,
  params = {},
  cursor,
  nextCursor,
  label = "results",
}: {
  basePath: string;
  params?: Record<string, string | undefined>;
  cursor?: string | null;
  nextCursor: string | null;
  label?: string;
}) {
  if (!cursor && !nextCursor) return null;
  const href = (c: string | null) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "cursor") sp.set(k, v);
    if (c) sp.set("cursor", c);
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  return (
    <nav aria-label={`Pagination for ${label}`} className="flex items-center justify-between gap-2 pt-2">
      {cursor ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(null)}>
            <ChevronsLeft aria-hidden /> First page
          </Link>
        </Button>
      ) : (
        <span />
      )}
      {nextCursor ? (
        <Button asChild variant="outline" size="sm">
          <Link href={href(nextCursor)}>
            Next page <ChevronRight aria-hidden />
          </Link>
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">End of {label}</span>
      )}
    </nav>
  );
}

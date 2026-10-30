import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholders for collaboration routes (loading.tsx). */
export function HeaderSkeleton() {
  return (
    <div className="border-b pb-6" aria-hidden>
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-lg border bg-card" aria-hidden>
      <div className="border-b p-3">
        <Skeleton className="h-4 w-48" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b p-3 last:border-0">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="rounded-xl border bg-card p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-24" />
          <Skeleton className="mt-6 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton({ variant = "table" }: { variant?: "table" | "cards" | "board" }) {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <HeaderSkeleton />
      <div className="flex gap-2" aria-hidden>
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-40" />
      </div>
      {variant === "cards" ? (
        <CardGridSkeleton />
      ) : variant === "board" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-3 rounded-lg border bg-card p-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <TableSkeleton />
      )}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

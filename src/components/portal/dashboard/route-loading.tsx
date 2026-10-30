import { Skeleton } from "@/components/ui/skeleton";

/** Shared skeleton for route-level loading.tsx files. */
export function RouteLoading({ rows = 5, tiles = 0 }: { rows?: number; tiles?: number }) {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading">
      <div className="grid gap-2 border-b pb-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      {tiles > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: tiles }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      )}
      <div className="grid gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

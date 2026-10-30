import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholder used by learning `loading.tsx` files. */
export function PageSkeleton({ rows = 4, withAside = false }: { rows?: number; withAside?: boolean }) {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading">
      <div className="grid gap-3 border-b pb-6">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-80 max-w-full" />
        <Skeleton className="h-4 w-[32rem] max-w-full" />
      </div>
      <div className={withAside ? "grid gap-6 lg:grid-cols-[16rem_1fr]" : "grid gap-6"}>
        {withAside && (
          <div className="hidden gap-3 lg:grid">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        )}
        <div className="grid gap-3">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

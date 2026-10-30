import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native <select> styled like the design-system inputs — used in GET filter forms (works without JS). */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  );
}

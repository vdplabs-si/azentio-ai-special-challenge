import { ArrowUpRight } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Outbound link: new tab, no opener/referrer leakage, announced to screen readers. */
export function ExternalLink({
  href,
  children,
  className,
  icon = true,
  ...props
}: Omit<ComponentProps<"a">, "target" | "rel"> & { href: string; children: ReactNode; icon?: boolean }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {children}
      {icon ? <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0" /> : null}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

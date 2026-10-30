import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VARIANTS = {
  /** Brand-green fill — primary action on navy surfaces. */
  green: "bg-brand-green text-brand-ink hover:bg-brand-mint",
  /** Navy fill — primary action on light surfaces. */
  navy: "bg-brand-navy text-white hover:bg-brand-navy-deep",
  /** Outline on navy surfaces. */
  "outline-dark": "border-white/30 bg-transparent text-white hover:border-white/60 hover:bg-white/5 hover:text-white",
  /** Outline on light surfaces. */
  "outline-light": "border-border bg-white text-brand-ink hover:border-brand-navy/40 hover:bg-brand-light",
} as const;

export type CtaVariant = keyof typeof VARIANTS;

export function ctaClasses(variant: CtaVariant = "navy", size: "md" | "lg" = "lg", className?: string) {
  return cn(
    buttonVariants({ variant: "default" }),
    "rounded-lg font-semibold",
    size === "lg" ? "h-11 gap-2 px-5 text-sm" : "h-9 gap-1.5 px-3.5 text-sm",
    VARIANTS[variant],
    className,
  );
}

/** Button-styled link. External links open in a new tab and are announced to screen readers. */
export function CtaLink({
  href,
  children,
  variant = "navy",
  size = "lg",
  className,
  external = false,
  arrow = true,
}: {
  href: string;
  children: ReactNode;
  variant?: CtaVariant;
  size?: "md" | "lg";
  className?: string;
  external?: boolean;
  arrow?: boolean;
}) {
  const classes = ctaClasses(variant, size, className);
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
        {arrow ? <ArrowUpRight aria-hidden="true" /> : null}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
      {arrow ? <ArrowRight aria-hidden="true" /> : null}
    </Link>
  );
}

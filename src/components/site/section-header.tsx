import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Eyebrow + heading + description used at the top of every content band. */
export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
  tone = "light",
  as: Heading = "h2",
  id,
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  as?: "h1" | "h2" | "h3";
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  const dark = tone === "dark";
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        align === "center" ? "mx-auto max-w-3xl items-center text-center" : "max-w-3xl",
        className,
      )}
    >
      {eyebrow ? <p className={cn("eyebrow", dark && "text-brand-green")}>{eyebrow}</p> : null}
      <Heading
        id={id}
        className={cn(
          "text-3xl font-semibold text-balance sm:text-4xl",
          dark ? "text-white" : "text-brand-ink",
        )}
      >
        {title}
      </Heading>
      {description ? (
        <p className={cn("text-base text-pretty sm:text-lg", dark ? "text-slate-300" : "text-muted-foreground")}>
          {description}
        </p>
      ) : null}
      {children}
    </div>
  );
}

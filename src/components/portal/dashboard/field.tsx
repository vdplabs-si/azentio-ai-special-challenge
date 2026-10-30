import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** Form field wrapper: label, control, optional hint and validation message. Usable from client forms. */
export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className ? `grid gap-1.5 ${className}` : "grid gap-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

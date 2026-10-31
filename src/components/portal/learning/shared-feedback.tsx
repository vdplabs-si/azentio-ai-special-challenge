"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileQuestion, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import type { FeedbackKind } from "@/generated/prisma/enums";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Counts = Record<FeedbackKind, number>;

/** Quality feedback: one signal per user, aggregate counts only (no rankings or leaderboards). */
export function SharedFeedback({ id, counts: initialCounts, mine: initialMine }: { id: string; counts: Counts; mine: FeedbackKind | null }) {
  const router = useRouter();
  const [counts, setCounts] = useState(initialCounts);
  const [mine, setMine] = useState(initialMine);
  const [busy, setBusy] = useState(false);

  async function choose(kind: FeedbackKind) {
    const next = mine === kind ? null : kind;
    setBusy(true);
    try {
      const res = await apiFetch<{ counts: Counts; mine: FeedbackKind | null }>(`/api/v1/shared-observations/${id}/feedback`, {
        method: "PUT",
        body: { kind: next },
      });
      setCounts(res.counts);
      setMine(res.mine);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const option = (kind: FeedbackKind, label: string, Icon: typeof ThumbsUp) => (
    <Button
      type="button"
      variant="outline"
      aria-pressed={mine === kind}
      disabled={busy}
      onClick={() => choose(kind)}
      className={cn("justify-between", mine === kind && "border-success bg-success/10 text-success hover:bg-success/15")}
    >
      <span className="inline-flex items-center gap-1.5">
        <Icon aria-hidden /> {label}
      </span>
      <span className="tabular-nums text-xs">{counts[kind]}</span>
    </Button>
  );

  return (
    <div className="grid gap-2">
      <p className="text-xs font-semibold text-muted-foreground">Was this useful?</p>
      <div className="grid gap-2">
        {option("USEFUL", "Useful", ThumbsUp)}
        {option("NEEDS_EVIDENCE", "Needs evidence", FileQuestion)}
      </div>
      <p className="text-xs text-muted-foreground">Your choice is private; only totals are shown. Select again to clear it.</p>
    </div>
  );
}

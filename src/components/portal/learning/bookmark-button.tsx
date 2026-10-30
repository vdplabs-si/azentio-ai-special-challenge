"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

/** Toggle a private bookmark on an approved shared copy. */
export function BookmarkButton({ sharedObservationId, bookmarkId: initial }: { sharedObservationId: string; bookmarkId: string | null }) {
  const router = useRouter();
  const [bookmarkId, setBookmarkId] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      if (bookmarkId) {
        await apiFetch(`/api/v1/bookmarks/${bookmarkId}`, { method: "DELETE" });
        setBookmarkId(null);
        toast.success("Bookmark removed");
      } else {
        const res = await apiFetch<{ id: string }>("/api/v1/bookmarks", { body: { sharedObservationId } });
        setBookmarkId(res.id);
        toast.success("Bookmarked");
      }
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={toggle} disabled={busy} aria-pressed={Boolean(bookmarkId)} className="w-full justify-start">
      {bookmarkId ? <BookmarkCheck className="text-success" aria-hidden /> : <Bookmark aria-hidden />}
      {bookmarkId ? "Bookmarked" : "Bookmark"}
    </Button>
  );
}

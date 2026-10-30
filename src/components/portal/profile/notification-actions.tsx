"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

/** Mark one notification read — PATCH /api/v1/notifications/[id]. */
export function MarkReadButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/notifications/${id}`, { method: "PATCH" });
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="ghost" size="sm" onClick={run} disabled={busy} aria-label="Mark as read">
      <Check aria-hidden /> Mark read
    </Button>
  );
}

/** Mark every notification read — POST /api/v1/notifications/read-all. */
export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const res = await apiFetch<{ updated: number }>("/api/v1/notifications/read-all", { method: "POST" });
      toast.success(res.updated ? `Marked ${res.updated} notification${res.updated === 1 ? "" : "s"} as read` : "Everything was already read");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="outline" onClick={run} disabled={disabled || busy}>
      <CheckCheck aria-hidden /> {busy ? "Marking…" : "Mark all read"}
    </Button>
  );
}

/** Opening a linked notification marks it read first, then navigates. */
export function OpenNotificationButton({ id, href, unread }: { id: string; href: string; unread: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      if (unread) await apiFetch(`/api/v1/notifications/${id}`, { method: "PATCH" });
    } catch {
      /* navigation still proceeds; the read state can be retried */
    }
    router.push(href);
  }
  return (
    <Button variant="outline" size="sm" onClick={open} disabled={busy}>
      Open
    </Button>
  );
}

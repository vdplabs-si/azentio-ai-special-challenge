"use client";

import { useRouter } from "next/navigation";
import { Pencil, XCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { SessionFormDialog, type EditableSession } from "@/components/portal/live/session-form-dialog";
import { Button } from "@/components/ui/button";

/** Publisher controls on the session detail page. */
export function SessionActions({
  session,
  organisations,
  canTargetRestricted,
}: {
  session: EditableSession;
  organisations: { id: string; name: string }[];
  canTargetRestricted: boolean;
}) {
  const router = useRouter();
  async function cancel() {
    try {
      await apiFetch(`/api/v1/live-sessions/${session.id}`, { method: "DELETE" });
      toast.success("Session cancelled");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <SessionFormDialog
        session={session}
        organisations={organisations}
        canTargetRestricted={canTargetRestricted}
        trigger={
          <Button variant="outline">
            <Pencil aria-hidden /> {session.status === "CANCELLED" ? "Edit / reinstate" : "Edit session"}
          </Button>
        }
      />
      {session.status !== "CANCELLED" && (
        <ConfirmButton
          title="Cancel this session?"
          description="The session will be hidden from every audience. The record is kept for the audit trail and can be reinstated by editing its status."
          confirmLabel="Cancel session"
          onConfirm={cancel}
        >
          <XCircle aria-hidden /> Cancel session
        </ConfirmButton>
      )}
    </div>
  );
}

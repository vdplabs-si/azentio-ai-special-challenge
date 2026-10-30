"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2, Upload } from "lucide-react";
import { ApiError, apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/portal/confirm-button";
import { useMutation } from "@/components/portal/collab/form-bits";
import { ACCEPT_ATTRIBUTE, ALLOWED_SUMMARY, precheckFile } from "@/components/portal/collab/file-rules";

/**
 * Upload with a client-side pre-check (type/size) for fast feedback. The server re-validates
 * everything (allow-list, magic bytes, UTF-8, size) and its errors are shown verbatim.
 */
export function UploadDocumentButton({ workspaceId, projectId, maxMb }: { workspaceId: string; projectId?: string; maxMb: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    const pre = precheckFile(file, maxMb);
    if (pre) {
      setError(pre);
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("workspaceId", workspaceId);
    if (projectId) form.set("projectId", projectId);
    setBusy(true);
    try {
      await apiFetch("/api/v1/documents", { method: "POST", body: form });
      toast.success(`Uploaded ${file.name}`);
      router.refresh();
    } catch (e) {
      const msg = e instanceof ApiError ? (e.fieldErrors.file?.[0] ?? e.message) : errorMessage(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <input
        ref={input}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <Button onClick={() => input.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
        {busy ? "Uploading…" : "Upload document"}
      </Button>
      <p className="text-xs text-muted-foreground">
        {ALLOWED_SUMMARY} · up to {maxMb} MB
      </p>
      {error && (
        <p role="alert" className="max-w-sm text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function DeleteDocumentButton({ documentId, filename }: { documentId: string; filename: string }) {
  const { run, busy } = useMutation();
  return (
    <ConfirmButton
      variant="ghost"
      size="sm"
      disabled={busy}
      title="Delete document?"
      description={`“${filename}” will be permanently deleted for everyone.`}
      confirmLabel="Delete"
      onConfirm={async () => {
        await run(`/api/v1/documents/${documentId}`, { method: "DELETE" }, "Document deleted");
      }}
    >
      <Trash2 aria-hidden />
      <span className="sr-only">Delete {filename}</span>
    </ConfirmButton>
  );
}

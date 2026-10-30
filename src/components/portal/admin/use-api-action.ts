"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { errorMessage } from "@/lib/client/api";

/** Run an API mutation with busy state, toasts and a server refresh. Resolves to success. */
export function useApiAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(success);
      router.refresh();
      return true;
    } catch (e) {
      toast.error(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

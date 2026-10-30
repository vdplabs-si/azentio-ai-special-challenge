"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/client/api";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await apiFetch("/api/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        } catch (e) {
          toast.error(errorMessage(e));
        }
      }}
    >
      Sign out
    </Button>
  );
}

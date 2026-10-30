import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/portal/page";

export default function WorkspaceNotFound() {
  return (
    <EmptyState
      icon={Building2}
      title="Workspace not found"
      description="It doesn't exist, or you don't have access to it."
      action={
        <Button asChild variant="outline">
          <Link href="/portal/workspaces">All workspaces</Link>
        </Button>
      }
    />
  );
}

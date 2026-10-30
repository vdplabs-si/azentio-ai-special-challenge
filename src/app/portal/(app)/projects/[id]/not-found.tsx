import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/portal/page";

export default function ProjectNotFound() {
  return (
    <EmptyState
      icon={FolderKanban}
      title="Project not found"
      description="It doesn't exist, it was deleted, or you don't have access to it."
      action={
        <Button asChild variant="outline">
          <Link href="/portal/projects">All projects</Link>
        </Button>
      }
    />
  );
}

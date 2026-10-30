"use client";

import { RouteError } from "@/components/portal/collab/route-states";

export default function WorkspaceError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} title="This workspace couldn't be loaded" backHref="/portal/workspaces" backLabel="All workspaces" />;
}

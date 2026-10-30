"use client";

import { RouteError } from "@/components/portal/collab/route-states";

export default function WorkspacesError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} title="Workspaces couldn't be loaded" backHref="/portal" backLabel="Back to dashboard" />;
}

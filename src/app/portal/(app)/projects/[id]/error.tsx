"use client";

import { RouteError } from "@/components/portal/collab/route-states";

export default function ProjectError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} title="This project couldn't be loaded" backHref="/portal/projects" backLabel="All projects" />;
}

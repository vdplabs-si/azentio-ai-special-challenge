"use client";

import { RouteError } from "@/components/portal/collab/route-states";

export default function HackathonError({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} title="Hackathon teams couldn't be loaded" backHref="/portal" backLabel="Back to dashboard" />;
}

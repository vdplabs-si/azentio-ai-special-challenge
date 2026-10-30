"use client";

import { RouteError } from "@/components/portal/learning/route-states";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} title="Shared learning couldn't be loaded" />;
}

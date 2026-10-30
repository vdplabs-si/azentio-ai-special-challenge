"use client";

import { RouteError } from "@/components/portal/dashboard/route-error";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError error={error} retry={reset} />;
}

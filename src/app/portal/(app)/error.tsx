"use client";

import { RouteError } from "@/components/portal/dashboard/route-error";

export default function PortalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError error={error} retry={retry} />;
}

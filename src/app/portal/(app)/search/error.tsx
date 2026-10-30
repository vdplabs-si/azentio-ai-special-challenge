"use client";

import { RouteError } from "@/components/portal/dashboard/route-error";

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  return <RouteError error={error} retry={retry} />;
}

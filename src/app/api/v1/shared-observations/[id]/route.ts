import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { getSharedDetail } from "@/server/services/shared-feed";

export const dynamic = "force-dynamic";

/** A single approved shared copy (DTO only) with aggregate feedback and comments. */
export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return getSharedDetail(actor, params.id);
});

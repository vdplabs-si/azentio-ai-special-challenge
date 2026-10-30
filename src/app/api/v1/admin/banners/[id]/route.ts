import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { bannerPatchSchema, deleteBanner, updateBanner } from "@/server/services/content-admin";

export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  return updateBanner(actor, params.id, await parseBody(req, bannerPatchSchema));
});

export const DELETE = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return deleteBanner(actor, params.id);
});

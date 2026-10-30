import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { themeSchema } from "@/server/learning/schemas";
import { getTheme, updateTheme } from "@/server/services/themes";

export const dynamic = "force-dynamic";

export const GET = withApi<{ id: string }>(async ({ params }) => {
  const actor = await requireUser();
  return getTheme(actor, params.id);
});

export const PATCH = withApi<{ id: string }>(async ({ req, params }) => {
  const actor = await requireUser();
  const input = await parseBody(req, themeSchema);
  return updateTheme(actor, params.id, input);
});

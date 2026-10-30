import { withApi, parseBody } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { themeSchema } from "@/server/learning/schemas";
import { createTheme, listThemes } from "@/server/services/themes";

export const dynamic = "force-dynamic";

/** Themes visible to the actor (participants: PUBLISHED only) with cohort-suppressed metrics. */
export const GET = withApi(async () => {
  const actor = await requireUser();
  return { items: await listThemes(actor) };
});

export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const input = await parseBody(req, themeSchema);
  return createTheme(actor, input);
});

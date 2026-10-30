import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { themeSuggestions } from "@/server/services/themes";

export const dynamic = "force-dynamic";

/** "Suggested groupings (keyword similarity)" over PUBLISHED shared copies — hints, not findings. */
export const GET = withApi(async () => {
  const actor = await requireUser();
  return {
    method: "keyword similarity (topic and title overlap) — verify manually; not a measure of market prevalence or causation",
    items: await themeSuggestions(actor),
  };
});

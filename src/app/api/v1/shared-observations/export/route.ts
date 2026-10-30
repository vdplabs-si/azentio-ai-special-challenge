import { withApi, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { sharedFiltersSchema } from "@/server/learning/schemas";
import { exportSharedCsv } from "@/server/services/shared-feed";

export const dynamic = "force-dynamic";

/** CSV of approved shared copies with the same visibility and filters as the feed (DTO fields only). */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  const filters = parseQuery(req, sharedFiltersSchema);
  const { csv, count, truncated } = await exportSharedCsv(actor, filters);
  const date = new Date().toISOString().slice(0, 10);
  return new Response("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="shared-learning-${date}.csv"`,
      "Cache-Control": "no-store",
      "X-Row-Count": String(count),
      "X-Truncated": truncated ? "1" : "0",
    },
  });
});

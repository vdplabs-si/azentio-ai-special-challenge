import { withApi } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { listScenarios } from "@/server/services/playground";

/** Scenarios the caller may run (employees: all; clients: entitled CLIENT_ENTITLED only). */
export const GET = withApi(async () => {
  const actor = await requireUser();
  const items = await listScenarios(actor);
  return { items };
});

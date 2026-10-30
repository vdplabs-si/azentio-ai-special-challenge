import { NextResponse } from "next/server";
import { withApi, parseBody, parseQuery } from "@/lib/api/handler";
import { requireUser } from "@/lib/authz/actor";
import { projectCreateSchema, projectListQuery } from "@/components/portal/collab/schemas";
import { createProject, listProjects } from "@/server/services/projects";

/** GET: visible projects. Filters: workspaceId, status, kind, q. Cursor-paginated. */
export const GET = withApi(async ({ req }) => {
  const actor = await requireUser();
  return listProjects(actor, parseQuery(req, projectListQuery));
});

/**
 * POST: create a project in the active workspace (or `workspaceId`, verified server-side).
 * `kind: "HACKATHON_TEAM"` + `hackathonEventId` creates an employee team space.
 */
export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const input = await parseBody(req, projectCreateSchema);
  return NextResponse.json({ project: await createProject(actor, input) }, { status: 201 });
});

import { NextResponse } from "next/server";
import { withApi } from "@/lib/api/handler";
import { AppError, badRequest } from "@/lib/api/errors";
import { requireUser } from "@/lib/authz/actor";
import { env } from "@/lib/env";
import { documentUploadFields } from "@/components/portal/collab/schemas";
import { maxUploadBytes, uploadDocument } from "@/server/services/documents";

/** Multipart form overhead allowance on top of the file size limit. */
const FORM_OVERHEAD = 64 * 1024;

/**
 * POST multipart/form-data: `file`, `workspaceId`, optional `projectId`.
 * Size, allow-list, magic bytes and UTF-8 checks happen server-side in the documents service.
 */
export const POST = withApi(async ({ req }) => {
  const actor = await requireUser();
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxUploadBytes() + FORM_OVERHEAD) {
    throw new AppError("payload_too_large", `Files must be ${env().MAX_UPLOAD_MB} MB or smaller.`);
  }
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("multipart/form-data")) {
    throw badRequest("Upload documents as multipart/form-data.");
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw badRequest("The upload could not be read. Please try again.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("validation_failed", "Choose a file to upload.", { file: ["Choose a file to upload."] });
  const fields = documentUploadFields.parse({
    workspaceId: form.get("workspaceId") ?? undefined,
    projectId: form.get("projectId") ?? undefined,
  });
  const document = await uploadDocument(actor, { file, workspaceId: fields.workspaceId, projectId: fields.projectId || null });
  return NextResponse.json({ document }, { status: 201 });
});
